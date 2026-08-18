export const APP_LOCALES = ["de", "fr", "it", "en"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const PREFIX_LOCALES = ["fr", "it", "en"] as const;
export type PrefixLocale = (typeof PREFIX_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "de";

export const HTML_LANG: Record<AppLocale, string> = {
  de: "de-CH",
  fr: "fr-CH",
  it: "it-CH",
  en: "en"
};

export const HREFLANG: Record<AppLocale, string> = {
  de: "de-CH",
  fr: "fr-CH",
  it: "it-CH",
  en: "en"
};

export const OG_LOCALE: Record<AppLocale, string> = {
  de: "de_CH",
  fr: "fr_CH",
  it: "it_CH",
  en: "en_GB"
};

export const DATE_LOCALE: Record<AppLocale, string> = {
  de: "de-CH",
  fr: "fr-CH",
  it: "it-CH",
  en: "en-GB"
};

export const EVENT_STEM: Record<AppLocale, string> = {
  de: "stromausfall",
  fr: "panne-de-courant",
  it: "interruzione-di-corrente",
  en: "power-outage"
};

export const EVENT_STEMS = Object.values(EVENT_STEM);

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return APP_LOCALES.includes(value as AppLocale);
}

export function isPrefixLocale(value: string | undefined | null): value is PrefixLocale {
  return PREFIX_LOCALES.includes(value as PrefixLocale);
}

export function localeParam(locale: AppLocale): string | undefined {
  return locale === "de" ? undefined : locale;
}

export function localePrefix(locale: AppLocale): string {
  return locale === "de" ? "" : `/${locale}`;
}

export function localeStaticPaths(): Array<{ params: { locale: string | undefined }; props: { locale: AppLocale } }> {
  return APP_LOCALES.map((locale) => ({
    params: { locale: localeParam(locale) },
    props: { locale }
  }));
}

export function localeFromParam(value: string | undefined): AppLocale {
  return isPrefixLocale(value) ? value : "de";
}
