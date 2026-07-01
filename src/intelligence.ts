import { normalizeLocation } from "./events";
import type {
  EvidenceLevel,
  FactSheet,
  OutageEvent,
  OutageSource,
  ResearchAssessment,
  SourceKind,
  SourceSnapshot
} from "./types";

export interface SourceIntelligence {
  source_kind: SourceKind;
  source_weight: number;
  is_official: number;
  independence_key: string;
}

export interface EventScore {
  event_score: number;
  evidence_level: EvidenceLevel;
  reason: string;
}

export interface MailDecision {
  send: boolean;
  reason: string;
}

function canonicalUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const nested = url.searchParams.get("url");
    if (url.hostname.includes("google.") && nested) return new URL(nested);
    return url;
  } catch {
    return null;
  }
}

function hostOf(value: string | null | undefined): string {
  return canonicalUrl(value)?.hostname.replace(/^www\./, "").toLowerCase() ?? "";
}

function normalizedText(...values: Array<string | null | undefined>): string {
  return normalizeLocation(values.filter(Boolean).join(" "));
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeLocation(term)));
}

function concreteLocation(event: OutageEvent): boolean {
  const value = normalizeLocation(event.location_text);
  return !["unknown", "schweiz", "suisse", "svizzera", "switzerland", "aargau", "bern"].includes(value);
}

export function classifySource(input: {
  url: string;
  title: string;
  sourceName?: string | null;
}): SourceIntelligence {
  const host = hostOf(input.url);
  const text = normalizedText(input.title, input.sourceName, host);
  let source_kind: SourceKind = "other";
  let source_weight = 0.35;
  let is_official = 0;

  const operatorHost = includesAny(host, [
    "aew",
    "bkw",
    "ewz",
    "primeo",
    "ibw",
    "ewl",
    "groupe-e",
    "romande-energie",
    "axpo",
    "swissgrid",
    "ckw",
    "strom",
    "energie"
  ]);
  const publicHost = includesAny(host, ["admin.ch", "polizei", "feuerwehr", "alertswiss"]);
  const municipalContext = includesAny(text, ["gemeinde", "stadt", "kanton", "verwaltung"]);

  if (operatorHost || publicHost || municipalContext) {
    source_kind = operatorHost ? "operator" : "official";
    source_weight = 1;
    is_official = 1;
  } else if (includesAny(text, ["nau.ch", "aargauerzeitung", "tagblatt", "bote", "neo1", "freiburger-nachrichten", "baernerbaer", "march24"])) {
    source_kind = "local_media";
    source_weight = 0.65;
  } else if (includesAny(text, ["srf", "20min", "blick", "watson", "tagesanzeiger"])) {
    source_kind = "national_media";
    source_weight = 0.6;
  } else if (host.includes("google.") || input.sourceName === "Exa Search") {
    source_kind = "aggregator";
    source_weight = 0.3;
  }

  if (host.includes("swisscom")) {
    source_kind = "other";
    source_weight = 0.25;
    is_official = 0;
  }

  return {
    source_kind,
    source_weight,
    is_official,
    independence_key: host || normalizeLocation(input.sourceName || input.title).slice(0, 60)
  };
}

function sourceIntelligence(source: OutageSource): SourceIntelligence {
  if (source.source_kind && source.source_weight !== null && source.is_official !== null && source.independence_key) {
    return {
      source_kind: source.source_kind,
      source_weight: source.source_weight,
      is_official: source.is_official,
      independence_key: source.independence_key
    };
  }
  return classifySource({
    url: source.source_url,
    title: source.source_title,
    sourceName: source.source_name
  });
}

export function independentSourceCount(sources: OutageSource[]): number {
  return new Set(sources.map((source) => sourceIntelligence(source).independence_key).filter(Boolean)).size;
}

export function officialSourceCount(sources: OutageSource[]): number {
  return sources.filter((source) => sourceIntelligence(source).is_official === 1).length;
}

export function scoreEvent(event: OutageEvent, sources: OutageSource[]): EventScore {
  const officialCount = officialSourceCount(sources);
  const independentCount = independentSourceCount(sources);
  const maxWeight = sources.reduce((max, source) => Math.max(max, sourceIntelligence(source).source_weight), 0);
  const sourceCount = sources.length || event.source_count || 0;

  const aiSignal = Math.min(35, Math.max(0, Number(event.confidence ?? 0) * 35));
  const sourceQuality = Math.min(25, maxWeight * 18 + Math.min(7, officialCount * 7));
  const corroboration = Math.min(
    25,
    (independentCount >= 2 ? 16 + (independentCount - 2) * 4 : sourceCount >= 2 ? 8 : 0) +
      Math.min(9, officialCount * 6)
  );
  const lastSeenMs = new Date(event.last_seen_at).getTime();
  const ageDays = Number.isFinite(lastSeenMs) ? Math.abs(Date.now() - lastSeenMs) / 864e5 : 99;
  const localityRecency = (concreteLocation(event) ? 8 : 2) + (ageDays <= 3 ? 7 : ageDays <= 14 ? 4 : 0);

  let score = aiSignal + sourceQuality + corroboration + localityRecency;
  const firstSourceKind = sources[0] ? sourceIntelligence(sources[0]).source_kind : "other";
  const hasOfficial = officialCount > 0;

  if (sourceCount <= 1 && !hasOfficial) score = Math.min(score, 75);
  if (sourceCount <= 1 && firstSourceKind === "local_media" && !hasOfficial) score = Math.min(score, 82);
  if (score > 90 && !hasOfficial && independentCount < 2) score = 90;
  if (score > 95 && !(hasOfficial && concreteLocation(event) && sourceCount >= 2)) score = 95;

  score = Math.round(Math.max(0, Math.min(100, score)));

  const evidence_level: EvidenceLevel =
    hasOfficial && score >= 70
      ? "official"
      : independentCount >= 2 && score >= 75
        ? "corroborated"
        : score >= 65
          ? "plausible"
          : "weak";

  return {
    event_score: score,
    evidence_level,
    reason: `AI ${Math.round(aiSignal)}/35, Quellen ${Math.round(sourceQuality)}/25, Belege ${Math.round(corroboration)}/25, Lokalität ${Math.round(localityRecency)}/15`
  };
}

function durationLabel(start: string, end: string): string {
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return "unklar";
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} Minuten`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} Stunden`;
  return `${Math.floor(seconds / 86400)} Tage`;
}

export function buildFactSheet(
  event: OutageEvent,
  sources: OutageSource[],
  snapshots: SourceSnapshot[],
  assessment?: ResearchAssessment | null,
  now = new Date().toISOString()
): FactSheet {
  const officialCount = officialSourceCount(sources);
  const independentCount = independentSourceCount(sources);
  const successfulSnapshots = snapshots.filter((snapshot) => snapshot.fetch_status === "success").length;
  const summary =
    assessment?.research_summary_de ||
    event.research_summary_de ||
    event.summary ||
    "Die Akte enthält Hinweise auf einen möglichen Stromausfall oder Netzunterbruch. Die Quellenlage muss geprüft werden.";

  return {
    location: event.location_text || "Ort unklar",
    time_window: {
      first_seen_at: event.first_seen_at,
      last_seen_at: event.last_seen_at,
      duration_label: durationLabel(event.first_seen_at, event.last_seen_at)
    },
    outage_nature: assessment?.outage_nature ?? event.outage_nature ?? "unknown",
    cause_category: assessment?.cause_category ?? event.cause_category ?? "unknown",
    cause_text: assessment?.cause_text ?? event.cause_text ?? "",
    status: assessment?.status ?? (event.status === "resolved" ? "resolved" : "unknown"),
    confirmed_facts: [
      sources.length > 0 ? `${sources.length} Quelle(n) gespeichert` : "Keine Quelle gespeichert",
      independentCount > 1 ? `${independentCount} unabhängige Quellen` : "",
      officialCount > 0 ? `${officialCount} offizielle/betreibernahe Quelle(n)` : "",
      successfulSnapshots > 0 ? `${successfulSnapshots} Snapshot-Auszug/züge vorhanden` : ""
    ].filter(Boolean),
    open_questions: [
      (assessment?.outage_nature ?? event.outage_nature) === "unknown" ? "Geplant oder ungeplant ist noch unklar." : "",
      (assessment?.cause_category ?? event.cause_category) === "unknown" ? "Ursache ist noch nicht belastbar ableitbar." : "",
      assessment?.status === "unknown" || !assessment ? "Aktueller Status ist nicht sicher bekannt." : ""
    ].filter(Boolean),
    summary_de: summary,
    source_assessment:
      officialCount > 0
        ? "Offizielle oder betreibernahe Quelle vorhanden."
        : independentCount >= 2
          ? "Mehrere unabhängige Quellen vorhanden."
          : "Quellenlage noch schwach oder nur einfach belegt.",
    source_count: sources.length,
    independent_source_count: independentCount,
    official_source_count: officialCount,
    generated_at: now
  };
}

export function decideNewEventMail(event: OutageEvent, sources: OutageSource[]): MailDecision {
  const score = Number(event.event_score ?? 0);
  const officialCount = officialSourceCount(sources);
  if (score >= 80) return { send: true, reason: `send: event_score ${score} >= 80` };
  if (officialCount > 0 && score >= 70) {
    return { send: true, reason: `send: official source and event_score ${score} >= 70` };
  }
  return { send: false, reason: `hold: event_score ${score}, official_sources ${officialCount}` };
}

export function decideUpdateMail(event: OutageEvent, sources: OutageSource[], now: string): MailDecision {
  if (!event.email_sent_at) return { send: false, reason: "hold: no initial event mail sent" };
  const firstMailMs = new Date(event.email_sent_at).getTime();
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(firstMailMs) || !Number.isFinite(nowMs) || nowMs - firstMailMs < 30 * 60 * 1000) {
    return { send: false, reason: "hold: update cooldown" };
  }
  if (event.update_email_sent_at) {
    const updateMs = new Date(event.update_email_sent_at).getTime();
    if (Number.isFinite(updateMs) && nowMs - updateMs < 6 * 60 * 60 * 1000) {
      return { send: false, reason: "hold: recent update mail already sent" };
    }
  }

  const score = Number(event.event_score ?? 0);
  const officialCount = officialSourceCount(sources);
  const independentCount = independentSourceCount(sources);
  const factConfidence = Number(event.fact_confidence ?? 0);
  if (officialCount > 0) return { send: true, reason: "send update: official source added/present" };
  if (independentCount >= 2) return { send: true, reason: "send update: second independent source" };
  if (event.status === "corroborated") return { send: true, reason: "send update: event corroborated" };
  if (score >= 70 && factConfidence >= 0.65) return { send: true, reason: "send update: fact sheet confidence improved" };
  return { send: false, reason: `hold update: score ${score}, independent_sources ${independentCount}` };
}

function tokenSet(value: string | null | undefined): Set<string> {
  return new Set(normalizeLocation(value).split(" ").filter((token) => token.length >= 4));
}

export function mergeHeuristicScore(left: OutageEvent, right: OutageEvent): number {
  if (left.id === right.id) return 0;
  if (left.status === "dismissed" || right.status === "dismissed") return 0;

  const leftLocation = normalizeLocation(left.location_text);
  const rightLocation = normalizeLocation(right.location_text);
  let score = 0;

  if (leftLocation !== "unknown" && leftLocation === rightLocation) score += 45;
  else if (
    leftLocation !== "unknown" &&
    rightLocation !== "unknown" &&
    (leftLocation.includes(rightLocation) || rightLocation.includes(leftLocation))
  ) {
    score += 25;
  }

  const leftTime = new Date(left.first_seen_at).getTime();
  const rightTime = new Date(right.first_seen_at).getTime();
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    const hours = Math.abs(leftTime - rightTime) / 36e5;
    if (hours <= 24) score += 25;
    else if (hours <= 48 && leftLocation === rightLocation) score += 15;
  }

  if (left.event_type === right.event_type) score += 10;
  if (
    (left.event_type === "power_outage" && right.event_type === "grid_disturbance") ||
    (left.event_type === "grid_disturbance" && right.event_type === "power_outage")
  ) {
    score += 6;
  }

  const leftTokens = tokenSet(`${left.title} ${left.summary ?? ""} ${left.reason ?? ""}`);
  const rightTokens = tokenSet(`${right.title} ${right.summary ?? ""} ${right.reason ?? ""}`);
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  score += Math.min(20, overlap * 4);

  return Math.max(0, Math.min(100, score));
}
