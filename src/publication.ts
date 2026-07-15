import { canonicalSourceUrl, classifySource } from "./intelligence";
import { normalizeLocation } from "./events";
import type {
  OutageEvent,
  OutageFact,
  OutageSource,
  PublicationDecision,
  PublicCanonicalSource,
  PublicFeedItem,
  PublicTrust
} from "./types";

const NON_CONCRETE_LOCATIONS = new Set([
  "",
  "unknown",
  "unbekannt",
  "schweiz",
  "suisse",
  "svizzera",
  "switzerland"
]);

const NEGATIVE_EVIDENCE = [
  /kein(?:e|en)?\s+(?:aktuell(?:e[ns]?)?\s+)?stromausfall/i,
  /kein(?:e|en)?\b.{0,40}\bstromausf[aä]ll/i,
  /keine\s+(?:aktuellen?\s+)?st[oö]rungen/i,
  /no\s+(?:current\s+)?(?:power\s+)?outages?/i,
  /aucune\s+(?:panne|perturbation)/i,
  /nessun(?:a|o)\s+(?:interruzione|guasto)/i
];

const NON_INCIDENT_EVIDENCE = [
  /\b(?:r[uü]ckblick|historisch|archiv|marktbericht|marktanalyse|ratgeber)\b/i,
  /\bwas\s+tun\s+bei\s+einem\s+stromausfall\b/i,
  /\bnach\s+dem\s+letzten\s+stromausfall\b/i,
  /\bim\s+jahr\s+20\d{2}\b/i,
  /\b(?:retour|r[eé]trospective|historique|archives?|analyse du march[eé]|conseils?)\b/i,
  /\bque faire (?:en cas|lors) (?:de|d['’]une?) panne de courant\b/i,
  /\b(?:retrospettiva|storico|archivio|analisi di mercato|guida)\b/i,
  /\bcosa fare in caso di (?:interruzione|blackout)\b/i
];

function concreteSwissLocation(event: OutageEvent): boolean {
  const location = normalizeLocation(event.location_text);
  return (
    event.country === "CH" &&
    !NON_CONCRETE_LOCATIONS.has(location) &&
    !/netzgebiet|versorgungsgebiet|westschweiz|ostschweiz|nordwestschweiz|zentralschweiz|schweizweit|^(?:grossraum|r[eé]gion\b|regione\b|gebiet$|umgebung$)/i.test(location) &&
    ["address", "street", "municipality", "district", "region"].includes(event.location_granularity || "unknown")
  );
}

function provesOutage(fact: OutageFact): boolean {
  if (!['outage_happened', 'planned_outage_notice'].includes(fact.fact_type)) return false;
  if (!fact.evidence_excerpt.trim()) return false;
  if (NEGATIVE_EVIDENCE.some((pattern) => pattern.test(fact.evidence_excerpt))) return false;
  if (NON_INCIDENT_EVIDENCE.some((pattern) => pattern.test(fact.evidence_excerpt))) return false;
  return fact.value_text.trim().toLowerCase() === "true" || fact.fact_type === "planned_outage_notice";
}

function canonicalPublicSource(source: OutageSource, authorityHosts?: ReadonlySet<string>): {
  publicSource: PublicCanonicalSource;
  trust: PublicTrust | null;
  independenceKey: string;
} | null {
  const canonicalUrl = canonicalSourceUrl(source.source_url);
  if (!canonicalUrl) return null;

  const intelligence = classifySource({
    url: canonicalUrl,
    title: source.source_title,
    sourceName: source.source_name
  });
  const domain = new URL(canonicalUrl).hostname.replace(/^www\./, "").toLowerCase();
  const isOfficial = authorityHosts ? authorityHosts.has(domain) : intelligence.is_official === 1;
  if (!isOfficial && !["local_media", "national_media"].includes(intelligence.source_kind)) return null;
  if (authorityHosts && ["official", "operator"].includes(intelligence.source_kind) && !isOfficial) return null;
  return {
    publicSource: {
      publisher: source.source_name?.trim() || domain,
      url: canonicalUrl,
      domain
    },
    trust: isOfficial ? "official" : null,
    independenceKey: domain
  };
}

function outageCenteredSource(source: OutageSource): boolean {
  const canonicalUrl = canonicalSourceUrl(source.source_url) ?? source.source_url;
  let decodedUrl = canonicalUrl;
  try {
    decodedUrl = decodeURIComponent(canonicalUrl);
  } catch {
    // Keep the original URL when malformed percent encoding cannot be decoded.
  }
  const text = normalizeLocation(`${source.source_title} ${decodedUrl}`);
  return /\b(?:stromausfall|stromunterbruch|netzunterbruch|ohne strom|kappt strom|panne de courant|coupure de courant|privees delectricite|blackout|interruzione di corrente|senza corrente|power outage)\b/.test(text);
}

function publicSummary(event: OutageEvent): string | null {
  const summary = event.research_summary_de?.trim() || event.summary?.trim() || null;
  if (
    !summary ||
    NEGATIVE_EVIDENCE.some((pattern) => pattern.test(summary)) ||
    NON_INCIDENT_EVIDENCE.some((pattern) => pattern.test(summary))
  ) return null;
  const sentences = summary.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2).join(" ");
  return sentences.length <= 320 ? sentences : `${sentences.slice(0, 317).trimEnd()}…`;
}

function contradictoryFacts(event: OutageEvent, facts: OutageFact[]): boolean {
  const values = (type: OutageFact["fact_type"]) => new Set(
    facts
      .filter((fact) => fact.fact_type === type && fact.confidence >= 0.65)
      .map((fact) => normalizeLocation(fact.value_text))
      .filter((value) => value && value !== "unknown" && value !== "unbekannt")
  );
  const outageClaims = values("outage_happened");
  if (outageClaims.has("true") && outageClaims.has("false")) return true;
  if (values("status").size > 1 || values("cause").size > 1 || values("planned_nature").size > 1) return true;

  const summary = normalizeLocation(event.research_summary_de || event.summary);
  const plannedFacts = values("planned_nature");
  if (summary.includes("geplant") && plannedFacts.has("unplanned")) return true;
  if (summary.includes("ungeplant") && plannedFacts.has("planned")) return true;
  const hasKnownCause = values("cause").size > 0 || Boolean(event.cause_text?.trim());
  if (hasKnownCause && /ursache (?:ist )?(?:unklar|unbekannt|nicht bekannt)/.test(summary)) return true;
  return false;
}

export function evaluatePublicEvent(
  event: OutageEvent,
  sources: OutageSource[],
  facts: OutageFact[],
  options: { authorityHosts?: ReadonlySet<string> } = {}
): PublicationDecision {
  const reasons: string[] = [];
  if (!concreteSwissLocation(event)) reasons.push("no_concrete_swiss_location");
  const positiveFacts = facts.filter((fact) => fact.confidence >= 0.65 && provesOutage(fact));
  if (positiveFacts.length === 0) reasons.push("no_positive_outage_evidence");
  if (contradictoryFacts(event, facts)) reasons.push("contradictory_evidence");

  const summary = publicSummary(event);
  if (!summary) reasons.push("no_coherent_public_summary");

  const credibleSources = sources
    .map((source) => {
      const canonical = canonicalPublicSource(source, options.authorityHosts);
      return canonical ? { ...canonical, sourceId: source.id } : null;
    })
    .filter((source) => source !== null);
  const evidencedSourceIds = new Set(positiveFacts.flatMap((fact) =>
    typeof fact.outage_source_id === "number" ? [fact.outage_source_id] : []
  ));
  const evidencedObservationIds = new Set(positiveFacts.flatMap((fact) =>
    typeof fact.source_observation_id === "number" ? [fact.source_observation_id] : []
  ));
  const evidencedAlertItemIds = new Set(positiveFacts.flatMap((fact) =>
    typeof fact.alert_item_id === "number" ? [fact.alert_item_id] : []
  ));
  const evidencedSources = credibleSources.filter((source) => {
    const original = sources.find((item) => item.id === source.sourceId);
    return evidencedSourceIds.has(source.sourceId) || (
      typeof original?.source_observation_id === "number" &&
      evidencedObservationIds.has(original.source_observation_id)
    ) || evidencedAlertItemIds.has(original?.alert_item_id ?? -1);
  });
  const official = evidencedSources.find((source) => source.trust === "official");
  const independentDomains = new Set(evidencedSources.map((source) => source.independenceKey));
  const centeredReport = evidencedSources.find((source) => {
    const original = sources.find((item) => item.id === source.sourceId);
    return original ? outageCenteredSource(original) : false;
  });
  const trust: PublicTrust | null = official
    ? "official"
    : independentDomains.size >= 2
      ? "corroborated"
      : evidencedSources.length === 1 && centeredReport
        ? "reported"
        : null;
  if (!trust) reasons.push("insufficient_source_authority");

  const primary = official || evidencedSources.find((candidate) => {
    const source = sources.find((item) => canonicalSourceUrl(item.source_url) === candidate.publicSource.url);
    return source?.is_primary === 1;
  }) || evidencedSources[0];

  return {
    publishable: reasons.length === 0,
    trust,
    reasons,
    summary,
    primary_source: primary?.publicSource || null
  };
}

export function publicFeedCursor(item: Pick<PublicFeedItem, "id" | "received_at">): string {
  return `${item.received_at}|${item.id}`;
}

export function parsePublicFeedCursor(cursor: string | null | undefined): { receivedAt: string; id: number } | null {
  if (!cursor) return null;
  const separator = cursor.lastIndexOf("|");
  if (separator <= 0) return null;
  const receivedAt = cursor.slice(0, separator);
  const id = Number(cursor.slice(separator + 1));
  return receivedAt && Number.isInteger(id) && id > 0 ? { receivedAt, id } : null;
}

export function toPublicFeedItem(event: OutageEvent, decision: PublicationDecision): PublicFeedItem | null {
  if (!decision.publishable || !decision.trust || !decision.primary_source || !decision.summary || !event.received_at) {
    return null;
  }

  return {
    id: event.id,
    location: event.location_text?.trim() || "",
    received_at: event.received_at,
    started_at: null,
    resolved_at: null,
    status: null,
    summary: decision.summary,
    trust: decision.trust,
    source: decision.primary_source
  };
}
