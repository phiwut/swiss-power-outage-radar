import { elcomFactsForSlug, elcomFaq } from "./elcom-operator-facts";
import { SOURCE_REGISTRY_SEEDS, type SourceRegistrySeed } from "./source-registry-seeds";
import { publicDisplayLocation, publicEventSlug } from "./public-url";
import type { PublicFeedItem } from "./types";

export interface OperatorProfile {
  slug: string;
  name: string;
  area: string;
  officialUrl: string;
  sourceCategory: SourceRegistrySeed["source_category"];
  language: "de" | "fr" | "it";
  checkMinutes: number;
  sourceKey: string;
}

const EXCLUDED_KEYS = new Set(["alertswiss"]);

export function operatorProfileUrl(operator: Pick<OperatorProfile, "slug">): string {
  return `/netzbetreiber/${operator.slug}/`;
}

export function toOperatorProfile(seed: SourceRegistrySeed): OperatorProfile {
  return {
    slug: publicEventSlug(seed.operator_name),
    name: seed.operator_name,
    area: seed.area_text,
    officialUrl: seed.url,
    sourceCategory: seed.source_category,
    language: seed.adapter_config.language ?? "de",
    checkMinutes: seed.check_interval_minutes,
    sourceKey: seed.source_key
  };
}

export function publicOperatorProfiles(): OperatorProfile[] {
  const profiles = SOURCE_REGISTRY_SEEDS
    .filter((seed) => seed.trust_level === "official" && !EXCLUDED_KEYS.has(seed.source_key))
    .map(toOperatorProfile);
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    if (seen.has(profile.slug)) return false;
    seen.add(profile.slug);
    return true;
  });
}

export function operatorBySlug(slug: string): OperatorProfile | null {
  return publicOperatorProfiles().find((profile) => profile.slug === slug) ?? null;
}

export function findOperatorProfile(name: string | null | undefined): OperatorProfile | null {
  if (!name) return null;
  const needle = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (!needle) return null;
  const profiles = publicOperatorProfiles();
  return profiles.find((profile) => profile.name.toLowerCase() === needle)
    ?? profiles.find((profile) => needle === profile.slug || needle.replace(/\s+/g, "-") === profile.slug)
    ?? profiles.find((profile) => needle.includes(profile.name.toLowerCase()) && profile.name.length > 3)
    ?? null;
}

export function operatorHostnames(operator: Pick<OperatorProfile, "officialUrl">): string[] {
  try {
    const host = new URL(operator.officialUrl).hostname.replace(/^www\./i, "").toLowerCase();
    return host ? [host] : [];
  } catch {
    return [];
  }
}

export function normalizeSourceHost(value: string | null | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const host = raw.includes("://") ? new URL(raw).hostname : raw.split("/")[0] ?? raw;
    return host.replace(/^www\./, "");
  } catch {
    return raw.replace(/^www\./, "");
  }
}

export function findOperatorByDomain(domain: string | null | undefined): OperatorProfile | null {
  const host = normalizeSourceHost(domain);
  if (!host) return null;
  return publicOperatorProfiles().find((profile) => {
    return operatorHostnames(profile).some((official) => host === official || host.endsWith(`.${official}`));
  }) ?? null;
}

export function resolveOperatorProfile(input: {
  name?: string | null;
  domain?: string | null;
  url?: string | null;
}): OperatorProfile | null {
  return findOperatorProfile(input.name)
    ?? findOperatorByDomain(input.domain)
    ?? findOperatorByDomain(input.url)
    ?? null;
}

export function eventMatchesOperator(
  item: Pick<PublicFeedItem, "source">,
  operator: OperatorProfile
): boolean {
  const host = normalizeSourceHost(item.source.domain || item.source.url);
  const officialHosts = operatorHostnames(operator);
  if (host && officialHosts.some((official) => host === official || host.endsWith(`.${official}`))) {
    return true;
  }
  const matched = resolveOperatorProfile({
    name: item.source.publisher,
    domain: item.source.domain,
    url: item.source.url
  });
  return matched?.slug === operator.slug;
}

export interface OperatorLiveStats {
  total: number;
  active: number;
  upcoming: number;
  resolved: number;
  planned: number;
  unplanned: number;
  last30Days: number;
  knownDurations: number;
  medianDurationMinutes: number | null;
  lastUpdatedAt: string | null;
  topLocations: Array<{ label: string; count: number }>;
}

export interface OperatorLiveContext {
  profile: OperatorProfile;
  stats: OperatorLiveStats;
  recent: PublicFeedItem[];
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const ranked = [...values].sort((left, right) => left - right);
  const mid = Math.floor(ranked.length / 2);
  return ranked.length % 2 === 0
    ? Math.round(((ranked[mid - 1] ?? 0) + (ranked[mid] ?? 0)) / 2)
    : ranked[mid] ?? null;
}

export function summarizeOperatorEvents(
  items: PublicFeedItem[],
  now = Date.now()
): OperatorLiveStats {
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const locations = new Map<string, number>();
  const durations: number[] = [];
  let lastUpdatedAt: string | null = null;
  for (const item of items) {
    const location = publicDisplayLocation(item.location);
    if (location && location !== "Schweiz") {
      locations.set(location, (locations.get(location) ?? 0) + 1);
    }
    if (typeof item.duration_minutes === "number" && item.duration_minutes >= 0) {
      durations.push(item.duration_minutes);
    }
    if (!lastUpdatedAt || item.updated_at > lastUpdatedAt) lastUpdatedAt = item.updated_at;
  }
  const topLocations = [...locations.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "de-CH"))
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));
  return {
    total: items.length,
    active: items.filter((item) => item.status === "active").length,
    upcoming: items.filter((item) => item.status === "upcoming").length,
    resolved: items.filter((item) => item.status === "resolved").length,
    planned: items.filter((item) => item.nature === "planned").length,
    unplanned: items.filter((item) => item.nature === "unplanned").length,
    last30Days: items.filter((item) => {
      const stamp = Date.parse(item.started_at ?? item.received_at ?? item.updated_at);
      return Number.isFinite(stamp) && stamp >= monthAgo;
    }).length,
    knownDurations: durations.length,
    medianDurationMinutes: median(durations),
    lastUpdatedAt,
    topLocations
  };
}

export function relatedOperatorProfiles(operator: OperatorProfile, limit = 4): OperatorProfile[] {
  const others = publicOperatorProfiles().filter((profile) => profile.slug !== operator.slug);
  const sameLanguage = others.filter((profile) => profile.language === operator.language);
  const rest = others.filter((profile) => profile.language !== operator.language);
  return [...sameLanguage, ...rest].slice(0, Math.max(0, limit));
}

export function sourceCategoryLabel(category: OperatorProfile["sourceCategory"]): string {
  if (category === "outage_map") return "Störungskarte oder Lagebild";
  if (category === "live_status") return "aktuelle Störungsseite";
  if (category === "news_feed") return "News- oder Betriebsmeldungen";
  return "öffentliche Hinweisquelle";
}

export function operatorDefinition(operator: OperatorProfile): string {
  return `${operator.name} ist Verteilnetzbetreiber für ${operator.area}. Verbindliche Angaben zu Stromausfällen und geplanten Unterbrüchen veröffentlicht ${operator.name} auf der offiziellen Störungsseite. outage.ch beobachtet diese Quelle, ersetzt den Pikettdienst aber nicht.`;
}

export function operatorLanguageNote(operator: OperatorProfile): string | null {
  if (operator.language === "fr") {
    return `Die Originalquelle von ${operator.name} ist französischsprachig. outage.ch führt öffentlich belegte Ereignisse trotzdem im deutschsprachigen Radar, sobald die Quellenregel erfüllt ist.`;
  }
  if (operator.language === "it") {
    return `Die Originalquelle von ${operator.name} ist italienischsprachig. Öffentlich belegte Ereignisse erscheinen im Radar auf Deutsch, sobald die Quellenregel erfüllt ist.`;
  }
  return null;
}

export function operatorSourceExplanation(operator: OperatorProfile): string {
  if (operator.sourceCategory === "outage_map") {
    return `${operator.name} veröffentlicht Störungen über eine ${sourceCategoryLabel(operator.sourceCategory)}. outage.ch prüft diese Quelle etwa alle ${operator.checkMinutes} Minuten und übernimmt nur Einträge, die sich als Stromereignis belegen lassen.`;
  }
  if (operator.sourceCategory === "news_feed") {
    return `${operator.name} kommuniziert Störungen vor allem über ${sourceCategoryLabel(operator.sourceCategory)}. Solche Seiten mischen oft Archiv, Medienmitteilungen und aktuelle Hinweise. Der Radar filtert deshalb strenger und veröffentlicht nicht jeden Seitentext.`;
  }
  if (operator.sourceCategory === "live_status") {
    return `${operator.name} führt eine ${sourceCategoryLabel(operator.sourceCategory)}. outage.ch ruft sie etwa alle ${operator.checkMinutes} Minuten ab. Negative Meldungen wie «keine Störung» werden nicht als Ausfall dargestellt.`;
  }
  return `${operator.name} hat eine öffentliche Hinweisquelle. outage.ch nutzt sie zur Einordnung, nicht als alleinigen Beweis für einen Ausfall.`;
}

export function operatorLiveInsight(operator: OperatorProfile, stats: OperatorLiveStats): string {
  if (stats.total === 0) {
    return `Im öffentlichen Radar von outage.ch liegt derzeit keine belegte Meldung aus der Quelle von ${operator.name}. Das heisst nicht, dass in ${operator.area} keine Störung existiert – verbindlich bleibt die offizielle Störungsseite des Werks.`;
  }
  const current = [
    stats.active ? `${stats.active} aktive` : null,
    stats.upcoming ? `${stats.upcoming} geplante, noch bevorstehende` : null
  ].filter(Boolean);
  if (current.length) {
    return `outage.ch führt derzeit ${stats.total} öffentliche Meldungen aus der Quelle von ${operator.name}, davon ${current.join(" und ")}. Gezählt werden nur Ereignisse, die die Veröffentlichungsregel erfüllen – nicht die komplette Betriebsstatistik des Werks.`;
  }
  const mix = [
    stats.unplanned ? `${stats.unplanned} ungeplante` : null,
    stats.planned ? `${stats.planned} geplante` : null
  ].filter(Boolean);
  return `outage.ch hat ${stats.total} öffentliche Meldungen aus der Quelle von ${operator.name} erfasst${mix.length ? ` (${mix.join(", ")})` : ""}. Derzeit ist keine davon als aktiv oder bevorstehend ausgewiesen.`;
}

export function operatorFaqs(
  operator: OperatorProfile,
  stats?: OperatorLiveStats | null
): Array<{ question: string; answer: string }> {
  const radarAnswer = !stats || stats.total === 0
    ? `Aktuell liegt keine öffentliche Meldung von ${operator.name} im Radar. outage.ch zeigt nur Ereignisse, die offiziell oder durch zwei unabhängige Quellen belegt sind.`
    : stats.active > 0
      ? `Ja, im Radar sind derzeit ${stats.active} aktive öffentliche Meldungen von ${operator.name} sichtbar. Verbindlich bleibt trotzdem die Originalseite des Werks.`
      : stats.upcoming > 0
        ? `Derzeit sind ${stats.upcoming} geplante Unterbrüche von ${operator.name} im Radar, aber keine als aktiv ausgewiesene Störung.`
        : `Im Radar sind ${stats.total} öffentliche Meldungen von ${operator.name} erfasst, derzeit keine als aktiv.`;
  const faqs = [
    {
      question: `Wer ist bei einem Stromausfall im Gebiet von ${operator.name} zuständig?`,
      answer: `Für die Behebung ist ${operator.name} als Verteilnetzbetreiber zuständig, nicht der Stromlieferant und nicht outage.ch. Das Versorgungsgebiet umfasst ${operator.area}.`
    },
    {
      question: `Gibt es aktuell eine öffentliche Störungsmeldung von ${operator.name}?`,
      answer: radarAnswer
    },
    {
      question: `Wo veröffentlicht ${operator.name} aktuelle Störungen?`,
      answer: `Auf der offiziellen Seite ${operator.officialUrl}. Das ist die verbindliche Auskunft.`
    }
  ];
  const elcom = elcomFactsForSlug(operator.slug);
  if (elcom) faqs.push(elcomFaq(operator.name, elcom));
  faqs.push(
    {
      question: `Kann ich eine Störung im Netz von ${operator.name} bei outage.ch melden?`,
      answer: `Nein. Melden Sie den Ausfall direkt bei ${operator.name}. outage.ch zeigt nur öffentlich nachvollziehbare Meldungen.`
    },
    {
      question: `Wie oft prüft outage.ch die Quelle von ${operator.name}?`,
      answer: `Etwa alle ${operator.checkMinutes} Minuten, sofern die Quelle erreichbar ist. Eine öffentliche Meldung auf outage.ch erscheint erst, wenn die Veröffentlichungsregel erfüllt ist.`
    }
  );
  return faqs;
}
