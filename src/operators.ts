import { elcomFactsForSlug, elcomFaq } from "./elcom-operator-facts";
import { pathFor, t, type AppLocale } from "./i18n";
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

export function operatorProfileUrl(
  operator: Pick<OperatorProfile, "slug">,
  locale: AppLocale = "de"
): string {
  return pathFor({ kind: "operator", slug: operator.slug }, locale);
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

export function sourceCategoryLabel(
  category: OperatorProfile["sourceCategory"],
  locale: AppLocale = "de"
): string {
  if (category === "outage_map") return t(locale, "operator.sourceCategory.outage_map");
  if (category === "live_status") return t(locale, "operator.sourceCategory.live_status");
  if (category === "news_feed") return t(locale, "operator.sourceCategory.news_feed");
  return t(locale, "operator.sourceCategory.other");
}

export function operatorDefinition(operator: OperatorProfile, locale: AppLocale = "de"): string {
  return t(locale, "operator.definition", { name: operator.name, area: operator.area });
}

export function operatorLanguageNote(operator: OperatorProfile, locale: AppLocale = "de"): string | null {
  if (operator.language === locale) return null;
  return t(locale, "operator.languageNote", {
    name: operator.name,
    language: t(locale, `operator.language.${operator.language}`)
  });
}

export function operatorSourceExplanation(operator: OperatorProfile, locale: AppLocale = "de"): string {
  const source = sourceCategoryLabel(operator.sourceCategory, locale);
  if (operator.sourceCategory === "outage_map") {
    return t(locale, "operator.sourceExplain.outage_map", { name: operator.name, source, minutes: operator.checkMinutes });
  }
  if (operator.sourceCategory === "news_feed") {
    return t(locale, "operator.sourceExplain.news_feed", { name: operator.name, source, minutes: operator.checkMinutes });
  }
  if (operator.sourceCategory === "live_status") {
    return t(locale, "operator.sourceExplain.live_status", { name: operator.name, source, minutes: operator.checkMinutes });
  }
  return t(locale, "operator.sourceExplain.other", { name: operator.name, source, minutes: operator.checkMinutes });
}

export function operatorLiveInsight(
  operator: OperatorProfile,
  stats: OperatorLiveStats,
  locale: AppLocale = "de"
): string {
  if (stats.total === 0) {
    return t(locale, "operator.insightNone", { name: operator.name, area: operator.area });
  }
  const current = [
    stats.active ? t(locale, "operator.currentActive", { count: stats.active }) : null,
    stats.upcoming ? t(locale, "operator.currentUpcoming", { count: stats.upcoming }) : null
  ].filter(Boolean);
  if (current.length) {
    return t(locale, "operator.insightCurrent", {
      name: operator.name,
      total: stats.total,
      current: current.join(locale === "en" ? " and " : locale === "de" ? " und " : locale === "fr" ? " et " : " e ")
    });
  }
  const mix = [
    stats.unplanned ? t(locale, "operator.mixUnplanned", { count: stats.unplanned }) : null,
    stats.planned ? t(locale, "operator.mixPlanned", { count: stats.planned }) : null
  ].filter(Boolean);
  return t(locale, "operator.insightArchived", {
    name: operator.name,
    total: stats.total,
    mix: mix.length ? ` (${mix.join(", ")})` : ""
  });
}

export function operatorFaqs(
  operator: OperatorProfile,
  stats?: OperatorLiveStats | null,
  locale: AppLocale = "de"
): Array<{ question: string; answer: string }> {
  const radarAnswer = !stats || stats.total === 0
    ? t(locale, "operator.faqNowNone", { name: operator.name })
    : stats.active > 0
      ? t(locale, "operator.faqNowActive", { name: operator.name, count: stats.active })
      : stats.upcoming > 0
        ? t(locale, "operator.faqNowUpcoming", { name: operator.name, count: stats.upcoming })
        : t(locale, "operator.faqNowOther", { name: operator.name, count: stats.total });
  const faqs = [
    {
      question: t(locale, "operator.faqWho", { name: operator.name }),
      answer: t(locale, "operator.faqWhoA", { name: operator.name, area: operator.area })
    },
    {
      question: t(locale, "operator.faqNow", { name: operator.name }),
      answer: radarAnswer
    },
    {
      question: t(locale, "operator.faqWhere", { name: operator.name }),
      answer: t(locale, "operator.faqWhereA", { url: operator.officialUrl })
    }
  ];
  const elcom = elcomFactsForSlug(operator.slug);
  if (elcom) faqs.push(elcomFaq(operator.name, elcom, locale));
  faqs.push(
    {
      question: t(locale, "operator.faqReport", { name: operator.name }),
      answer: t(locale, "operator.faqReportA", { name: operator.name })
    },
    {
      question: t(locale, "operator.faqCheck", { name: operator.name }),
      answer: t(locale, "operator.faqCheckA", { minutes: operator.checkMinutes })
    }
  );
  return faqs;
}
