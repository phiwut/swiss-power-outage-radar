import { SITE_ORIGIN, absoluteUrl, DEFAULT_OG_IMAGE_PATH, toSitemapLastmod } from "./public-url";
import { knowledgeArticles, knowledgeArticleUrl } from "./knowledge";
import { publicOperatorProfiles } from "./operators";
import {
  APP_LOCALES,
  HTML_LANG,
  homeFaqs as faqsForLocale,
  hreflangEntries,
  pathFor,
  t,
  type AppLocale,
  type AppRoute
} from "./i18n";

export const SITE_NAME = "outage.ch";
export const SITE_DESCRIPTION =
  "Unabhängiger Radar für aktuelle und geplante Stromausfälle in der Schweiz. Quellenbasiert, ohne erfundene Endzeiten, kein offizieller Notfallkanal.";

export function siteDescription(locale: AppLocale = "de"): string {
  return t(locale, "site.description");
}

export const ABOUT_PATH = "/ueber/";
export const OPERATORS_HUB_PATH = "/netzbetreiber/";
export const GUIDES_HUB_PATH = "/ratgeber/";
export const STATIC_CONTENT_UPDATED_AT = "2026-08-18";

export const homeFaqs = faqsForLocale("de");
export const localizedHomeFaqs = faqsForLocale;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function organizationId(origin = SITE_ORIGIN): string {
  return `${origin}/#organization`;
}

export function websiteId(origin = SITE_ORIGIN): string {
  return `${origin}/#website`;
}

export function siteGraph(origin = SITE_ORIGIN, locale: AppLocale = "de") {
  const logo = absoluteUrl(DEFAULT_OG_IMAGE_PATH, origin);
  return [
    {
      "@type": "Organization",
      "@id": organizationId(origin),
      name: SITE_NAME,
      url: `${origin}/`,
      description: siteDescription(locale),
      email: "alert@outage.ch",
      areaServed: { "@type": "Country", name: "Switzerland" },
      knowsAbout: ["Stromausfall", "Stromunterbruch", "Verteilnetz Schweiz"],
      logo: { "@type": "ImageObject", url: logo },
      image: logo
    },
    {
      "@type": "WebSite",
      "@id": websiteId(origin),
      url: `${origin}/`,
      name: SITE_NAME,
      description: siteDescription(locale),
      inLanguage: HTML_LANG[locale],
      publisher: { "@id": organizationId(origin) }
    }
  ];
}

export function siteJsonLd(origin = SITE_ORIGIN, locale: AppLocale = "de"): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": siteGraph(origin, locale) });
}

export function homeJsonLd(origin = SITE_ORIGIN, locale: AppLocale = "de"): string {
  const home = `${origin}${pathFor({ kind: "home" }, locale)}`;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      ...siteGraph(origin, locale),
      {
        "@type": "WebPage",
        "@id": `${home}#webpage`,
        url: home,
        name: t(locale, "site.homeH1"),
        description: siteDescription(locale),
        inLanguage: HTML_LANG[locale],
        isPartOf: { "@id": websiteId(origin) },
        about: { "@id": organizationId(origin) },
        mainEntity: { "@id": `${home}#faq` }
      },
      {
        "@type": "FAQPage",
        "@id": `${home}#faq`,
        mainEntity: faqsForLocale(locale).map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer }
        }))
      }
    ]
  });
}

export function buildRobotsTxt(origin = SITE_ORIGIN): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Content-Signal: search=yes,ai-input=yes,ai-train=no,use=reference",
    "",
    "User-agent: Googlebot",
    "Allow: /",
    "",
    "User-agent: GPTBot",
    "Allow: /",
    "",
    "User-agent: ChatGPT-User",
    "Allow: /",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "",
    "User-agent: anthropic-ai",
    "Allow: /",
    "",
    "User-agent: Google-Extended",
    "Allow: /",
    "",
    "User-agent: Bingbot",
    "Allow: /",
    "",
    "User-agent: CCBot",
    "Disallow: /",
    "",
    "User-agent: Bytespider",
    "Disallow: /",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    ""
  ].join("\n");
}

export function buildLlmsTxt(origin = SITE_ORIGIN): string {
  const guides = knowledgeArticles
    .map((article) => `- [${article.shortTitle}](${origin}${knowledgeArticleUrl(article)}): ${article.description}`)
    .join("\n");
  return `# outage.ch

> Unabhängiger öffentlicher Radar für Stromausfälle und geplante Stromunterbrüche in der Schweiz.

outage.ch sammelt öffentlich zugängliche Meldungen von Verteilnetzbetreibern, Behörden und Medien. Die Seite ist kein offizieller Notfallkanal, kein Pikettdienst und nimmt keine Störungsmeldungen entgegen. Fehlende Endzeiten oder Ursachen werden als offen gekennzeichnet und nicht geschätzt.

## Wichtig für Zitate

- Verbindlich ist immer der zuständige Verteilnetzbetreiber, nicht der Stromlieferant und nicht outage.ch.
- Öffentlich wird nur, was eine offizielle Quelle oder mindestens zwei unabhängige glaubwürdige Quellen belegt.
- Ein Stromausfall ist lokal oder regional. Eine Strommangellage oder ein Blackout ist etwas anderes.
- Bei Lebensgefahr, Feuer oder herunterhängenden Leitungen gelten 112 bzw. die offiziellen Alarmierungswege.

## Seiten

- [Aktuelle Stromausfälle](${origin}/): Karte und Liste mit Status, Ort und Quellen
- [Ratgeber](${origin}${GUIDES_HUB_PATH}): praktische Anleitungen für Haushalt und Betrieb
- [Netzbetreiber](${origin}${OPERATORS_HUB_PATH}): beobachtete Verteilnetzbetreiber, offizielle Störungsseiten und öffentliche Meldezahlen im Radar
- [Methodik](${origin}${ABOUT_PATH}): Quellenregeln, Veröffentlichung und Grenzen

## Ratgeber

${guides}

## Optional

- [llms.txt](${origin}/llms.txt)
`;
}

export type SitemapEntry = {
  loc: string;
  lastmod?: string;
  alternates?: Array<{ hreflang: string; href: string }>;
};

function alternatesFor(path: string, origin: string): Array<{ hreflang: string; href: string }> {
  return hreflangEntries(path, origin).map((entry) => ({
    hreflang: entry.hreflang,
    href: entry.href
  }));
}

function localizedStaticPages(route: AppRoute, lastmod: string, origin: string): SitemapEntry[] {
  return APP_LOCALES.map((locale) => {
    const path = pathFor(route, locale);
    return { loc: `${origin}${path}`, lastmod, alternates: alternatesFor(path, origin) };
  });
}

export function staticIndexablePages(
  origin = SITE_ORIGIN,
  operatorLastmods: Map<string, string> | Record<string, string> = new Map()
): SitemapEntry[] {
  const lastmods = operatorLastmods instanceof Map ? operatorLastmods : new Map(Object.entries(operatorLastmods));
  const guideUpdated = knowledgeArticles.reduce(
    (latest, article) => (article.updatedAt > latest ? article.updatedAt : latest),
    STATIC_CONTENT_UPDATED_AT
  );
  const hubLastmod = [...lastmods.values()].sort().at(-1) ?? STATIC_CONTENT_UPDATED_AT;
  return [
    ...localizedStaticPages({ kind: "home" }, STATIC_CONTENT_UPDATED_AT, origin),
    ...localizedStaticPages({ kind: "about" }, STATIC_CONTENT_UPDATED_AT, origin),
    ...localizedStaticPages({ kind: "guides" }, guideUpdated, origin),
    ...localizedStaticPages({ kind: "operators" }, toSitemapLastmod(hubLastmod), origin),
    ...knowledgeArticles.map((article) => {
      const path = knowledgeArticleUrl(article);
      return { loc: `${origin}${path}`, lastmod: article.updatedAt, alternates: alternatesFor(path, origin) };
    }),
    ...publicOperatorProfiles().flatMap((operator) =>
      localizedStaticPages(
        { kind: "operator", slug: operator.slug },
        toSitemapLastmod(lastmods.get(operator.slug) ?? STATIC_CONTENT_UPDATED_AT),
        origin
      )
    )
  ];
}

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const body = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      const links = (entry.alternates ?? [])
        .map((alternate) =>
          `<xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}"/>`
        )
        .join("");
      return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmod}${links}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${body}</urlset>`;
}
