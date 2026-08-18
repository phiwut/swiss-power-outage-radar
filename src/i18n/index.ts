import i18next from "i18next";
import { de, fr } from "./catalogs";
import { en, it } from "./catalogs-it-en";
import { DATE_LOCALE, type AppLocale } from "./locales";

const i18n = i18next.createInstance();

void i18n.init({
  lng: "de",
  fallbackLng: "de",
  resources: {
    de: { translation: de },
    fr: { translation: fr },
    it: { translation: it },
    en: { translation: en }
  },
  interpolation: { escapeValue: false },
  returnNull: false,
  returnEmptyString: false
});

export function t(locale: AppLocale, key: string, options?: Record<string, unknown>): string {
  return String(i18n.getFixedT(locale)(key, options ?? {}));
}

export function homeFaqs(locale: AppLocale = "de"): Array<{ question: string; answer: string }> {
  return (["1", "2", "3", "4"] as const).map((id) => ({
    question: t(locale, `home.faq.${id}.q`),
    answer: t(locale, `home.faq.${id}.a`)
  }));
}

export function formatAppDate(
  value: string | null | undefined,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "long", timeStyle: "short" }
): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(DATE_LOCALE[locale], { ...options, timeZone: "Europe/Zurich" }).format(date)
    : null;
}

export function formatAppDuration(minutes: number | null, locale: AppLocale): string | null {
  if (minutes === null || minutes < 0) return null;
  if (minutes < 60) return t(locale, "time.minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest
    ? t(locale, "time.hoursMinutes", { hours, minutes: rest })
    : t(locale, "time.hours", { count: hours });
}

export function radarCopy(locale: AppLocale) {
  return {
    locale,
    status: {
      upcoming: t(locale, "status.upcoming"),
      active: t(locale, "status.activeShort"),
      resolved: t(locale, "status.resolved"),
      stale: t(locale, "status.staleShort"),
      historical: t(locale, "status.historicalShort"),
      unknown: t(locale, "status.unknown")
    },
    nature: {
      planned: t(locale, "nature.planned").toLowerCase(),
      unplanned: t(locale, "nature.unplanned").toLowerCase(),
      unknown: t(locale, "nature.unknown").toLowerCase()
    },
    filters: {
      all: t(locale, "home.filterAll"),
      allNatures: t(locale, "home.filterAllNatures"),
      active: t(locale, "status.activeShort"),
      upcoming: t(locale, "status.upcoming"),
      resolved: t(locale, "status.resolved"),
      historical: t(locale, "status.historicalShort"),
      unplanned: t(locale, "nature.unplanned"),
      planned: t(locale, "nature.planned")
    },
    visibleCount: t(locale, "home.visibleCount"),
    loadError: t(locale, "home.loadError"),
    retry: t(locale, "home.retry"),
    emptyQuery: t(locale, "home.emptyQuery"),
    emptyFilter: t(locale, "home.emptyFilter"),
    showAll: t(locale, "home.showAll"),
    openReport: t(locale, "home.openReport"),
    loading: t(locale, "home.loading"),
    asOf: t(locale, "home.asOf"),
    dateLocale: DATE_LOCALE[locale]
  };
}

export { APP_LOCALES, DATE_LOCALE, DEFAULT_LOCALE, EVENT_STEM, EVENT_STEMS, HREFLANG, HTML_LANG, OG_LOCALE, PREFIX_LOCALES, isAppLocale, isPrefixLocale, localeFromParam, localeParam, localePrefix, localeStaticPaths, type AppLocale, type PrefixLocale } from "./locales";
export {
  HELP_GUIDE_PATH,
  alternatePath,
  canonicalEventPath,
  dateLocale,
  dePrefixTarget,
  eventIdFromPath,
  eventStemFromPath,
  hreflangEntries,
  localizeStoredEventUrl,
  parseAppPath,
  parseLocaleFromPath,
  pathFor,
  stripLocalePrefix,
  type AppRoute
} from "./routes";
