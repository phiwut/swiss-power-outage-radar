import {
  APP_LOCALES,
  DATE_LOCALE,
  DEFAULT_LOCALE,
  EVENT_STEM,
  EVENT_STEMS,
  HREFLANG,
  type AppLocale,
  isPrefixLocale,
  localeFromParam,
  localePrefix
} from "./locales";

export const HELP_GUIDE_PATH = "/ratgeber/stromausfall-was-tun/";

export type AppRoute =
  | { kind: "home" }
  | { kind: "about" }
  | { kind: "operators" }
  | { kind: "operator"; slug: string }
  | { kind: "guides" }
  | { kind: "guide"; slug: string }
  | { kind: "event"; slugId: string }
  | { kind: "eventsTemplate" };

const EVENT_STEM_PATTERN = EVENT_STEMS.join("|");

export function parseLocaleFromPath(pathname: string): AppLocale {
  const match = pathname.match(/^\/(fr|it|en)(?:\/|$)/);
  return match ? localeFromParam(match[1]) : DEFAULT_LOCALE;
}

export function stripLocalePrefix(pathname: string): { locale: AppLocale; rest: string } {
  const match = pathname.match(/^\/(fr|it|en)(\/.*)?$/);
  if (!match) return { locale: "de", rest: pathname || "/" };
  return { locale: match[1] as AppLocale, rest: match[2] || "/" };
}

export function dePrefixTarget(pathname: string): string | null {
  if (pathname === "/de" || pathname === "/de/") return "/";
  if (pathname.startsWith("/de/")) {
    const rest = pathname.slice(3);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return null;
}

export function eventsTemplateTarget(pathname: string): string | null {
  if (pathname === "/events" || pathname === "/events/") return "/";
  const prefixed = pathname.match(/^\/(fr|it|en)\/events\/?$/);
  return prefixed ? `/${prefixed[1]}/` : null;
}

export function pathFor(route: AppRoute, locale: AppLocale = "de"): string {
  const prefix = localePrefix(locale);
  switch (route.kind) {
    case "home":
      return prefix ? `${prefix}/` : "/";
    case "about":
      return `${prefix}/ueber/`;
    case "operators":
      return `${prefix}/netzbetreiber/`;
    case "operator":
      return `${prefix}/netzbetreiber/${route.slug}/`;
    case "guides":
      return `${prefix}/ratgeber/`;
    case "guide":
      return `/ratgeber/${route.slug}/`;
    case "event":
      return `${prefix}/${EVENT_STEM[locale]}/${route.slugId}`;
    case "eventsTemplate":
      return `${prefix}/events/`;
  }
}

export function parseAppPath(pathname: string): { locale: AppLocale; route: AppRoute } | null {
  if (dePrefixTarget(pathname)) return null;
  const { locale, rest } = stripLocalePrefix(pathname);
  const path = rest === "/" || rest === "" ? "/" : rest.replace(/\/+$/, "") || "/";

  if (path === "/") return { locale, route: { kind: "home" } };
  if (path === "/ueber") return { locale, route: { kind: "about" } };
  if (path === "/ratgeber") return { locale, route: { kind: "guides" } };
  if (path === "/netzbetreiber") return { locale, route: { kind: "operators" } };
  if (path === "/events") return { locale, route: { kind: "eventsTemplate" } };

  const operator = path.match(/^\/netzbetreiber\/([a-z0-9-]+)$/);
  if (operator) return { locale, route: { kind: "operator", slug: operator[1] } };

  const guide = path.match(/^\/ratgeber\/([a-z0-9-]+)$/);
  if (guide) return { locale, route: { kind: "guide", slug: guide[1] } };

  const event = path.match(new RegExp(`^/(?:${EVENT_STEM_PATTERN})/([a-z0-9-]+-\\d+)$`));
  if (event) return { locale, route: { kind: "event", slugId: event[1] } };

  return null;
}

export function localizeStoredEventUrl(storedUrl: string, locale: AppLocale): string {
  const match = storedUrl.match(/^\/stromausfall\/([a-z0-9-]+-\d+)\/?$/);
  if (!match) return storedUrl;
  return pathFor({ kind: "event", slugId: match[1] }, locale);
}

export function eventIdFromPath(pathname: string): number | null {
  const match = pathname.match(new RegExp(`(?:/(?:${EVENT_STEM_PATTERN})/|\\/events\\/)(?:[a-z0-9-]*-)?(\\d+)\\/?$`));
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function eventStemFromPath(pathname: string): string | null {
  const match = pathname.match(new RegExp(`^/(?:(fr|it|en)/)?(${EVENT_STEM_PATTERN})/`));
  return match?.[2] ?? null;
}

export function canonicalEventPath(storedUrl: string, pathname: string): string {
  const locale = parseLocaleFromPath(pathname);
  return localizeStoredEventUrl(storedUrl, locale);
}

export function eventCanonicalRedirect(pathname: string, storedUrl: string): string | null {
  const expected = canonicalEventPath(storedUrl, pathname);
  return pathname === expected ? null : expected;
}

export function alternatePath(pathname: string, target: AppLocale): string {
  const parsed = parseAppPath(pathname);
  if (!parsed) return pathFor({ kind: "home" }, target);
  if (parsed.route.kind === "guide") {
    return target === "de" ? pathFor(parsed.route, "de") : pathFor({ kind: "guides" }, target);
  }
  return pathFor(parsed.route, target);
}

export function hreflangEntries(pathname: string, origin: string): Array<{ locale: AppLocale | "x-default"; href: string; hreflang: string }> {
  const parsed = parseAppPath(pathname);
  if (!parsed || parsed.route.kind === "eventsTemplate") return [];
  const route = parsed.route;
  const locales: AppLocale[] = route.kind === "guide" ? ["de"] : [...APP_LOCALES];
  const seen = new Set<string>();
  const entries: Array<{ locale: AppLocale | "x-default"; href: string; hreflang: string }> = [];
  for (const locale of locales) {
    const hreflang = HREFLANG[locale];
    if (seen.has(hreflang)) continue;
    seen.add(hreflang);
    entries.push({ locale, href: `${origin}${pathFor(route, locale)}`, hreflang });
  }
  const defaultHref = `${origin}${pathFor(route, "de")}`;
  if (!seen.has("x-default")) {
    entries.push({ locale: "x-default", href: defaultHref, hreflang: "x-default" });
  }
  return entries;
}

export function isPrefixLocalePath(pathname: string): boolean {
  return isPrefixLocale(pathname.split("/").filter(Boolean)[0]);
}

export function dateLocale(locale: AppLocale): string {
  return DATE_LOCALE[locale];
}
