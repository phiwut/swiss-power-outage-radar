import { SITE_ORIGIN, absoluteUrl, DEFAULT_OG_IMAGE_PATH, toSitemapLastmod } from "./public-url";
import { knowledgeArticles, knowledgeArticleUrl } from "./knowledge";
import { operatorProfileUrl, publicOperatorProfiles } from "./operators";

export const SITE_NAME = "outage.ch";
export const SITE_DESCRIPTION =
  "Unabhängiger Radar für aktuelle und geplante Stromausfälle in der Schweiz. Quellenbasiert, ohne erfundene Endzeiten, kein offizieller Notfallkanal.";

export const ABOUT_PATH = "/ueber/";
export const OPERATORS_HUB_PATH = "/netzbetreiber/";
export const GUIDES_HUB_PATH = "/ratgeber/";
export const STATIC_CONTENT_UPDATED_AT = "2026-08-18";

export const homeFaqs = [
  {
    question: "Was ist outage.ch?",
    answer:
      "outage.ch ist ein unabhängiger öffentlicher Radar für Stromausfälle und geplante Stromunterbrüche in der Schweiz. Die Seite bündelt öffentlich zugängliche Meldungen von Netzbetreibern, Behörden und Medien und zeigt Ort, Status, Zeitangaben und Quellen."
  },
  {
    question: "Ist outage.ch ein offizieller Störungsdienst?",
    answer:
      "Nein. Verbindliche Angaben und die Behebung liegen beim zuständigen Verteilnetzbetreiber. outage.ch nimmt keine Störungsmeldungen entgegen und ersetzt weder Pikettdienst, Alertswiss noch Notruf."
  },
  {
    question: "Wie entscheidet outage.ch, welche Meldungen öffentlich sind?",
    answer:
      "Ein Ereignis wird nur veröffentlicht, wenn mindestens eine offizielle Netzbetreiber- oder Behördenquelle vorliegt oder mindestens zwei unabhängige glaubwürdige Quellen dasselbe Ereignis belegen. Einzelne unbestätigte Hinweise bleiben unsichtbar."
  },
  {
    question: "Nennt outage.ch eine genaue Wiederherstellungszeit?",
    answer:
      "Nur wenn eine öffentliche Quelle sie bestätigt. Fehlende Endzeiten werden als offen gekennzeichnet. Schätzungen werden nicht als Tatsache dargestellt."
  }
];

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

export function siteGraph(origin = SITE_ORIGIN) {
  const logo = absoluteUrl(DEFAULT_OG_IMAGE_PATH, origin);
  return [
    {
      "@type": "Organization",
      "@id": organizationId(origin),
      name: SITE_NAME,
      url: `${origin}/`,
      description: SITE_DESCRIPTION,
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
      description: SITE_DESCRIPTION,
      inLanguage: "de-CH",
      publisher: { "@id": organizationId(origin) }
    }
  ];
}

export function siteJsonLd(origin = SITE_ORIGIN): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": siteGraph(origin) });
}

export function homeJsonLd(origin = SITE_ORIGIN): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      ...siteGraph(origin),
      {
        "@type": "WebPage",
        "@id": `${origin}/#webpage`,
        url: `${origin}/`,
        name: "Stromausfälle Schweiz: aktuell & geplant",
        description: SITE_DESCRIPTION,
        inLanguage: "de-CH",
        isPartOf: { "@id": websiteId(origin) },
        about: { "@id": organizationId(origin) },
        mainEntity: { "@id": `${origin}/#faq` }
      },
      {
        "@type": "FAQPage",
        "@id": `${origin}/#faq`,
        mainEntity: homeFaqs.map((faq) => ({
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

export function staticIndexablePages(
  origin = SITE_ORIGIN,
  operatorLastmods: Map<string, string> | Record<string, string> = new Map()
): Array<{ loc: string; lastmod: string }> {
  const lastmods = operatorLastmods instanceof Map ? operatorLastmods : new Map(Object.entries(operatorLastmods));
  const guideUpdated = knowledgeArticles.reduce(
    (latest, article) => (article.updatedAt > latest ? article.updatedAt : latest),
    STATIC_CONTENT_UPDATED_AT
  );
  const hubLastmod = [...lastmods.values()].sort().at(-1) ?? STATIC_CONTENT_UPDATED_AT;
  return [
    { loc: `${origin}/`, lastmod: STATIC_CONTENT_UPDATED_AT },
    { loc: `${origin}${ABOUT_PATH}`, lastmod: STATIC_CONTENT_UPDATED_AT },
    { loc: `${origin}${GUIDES_HUB_PATH}`, lastmod: guideUpdated },
    { loc: `${origin}${OPERATORS_HUB_PATH}`, lastmod: toSitemapLastmod(hubLastmod) },
    ...knowledgeArticles.map((article) => ({
      loc: `${origin}${knowledgeArticleUrl(article)}`,
      lastmod: article.updatedAt
    })),
    ...publicOperatorProfiles().map((operator) => ({
      loc: `${origin}${operatorProfileUrl(operator)}`,
      lastmod: toSitemapLastmod(lastmods.get(operator.slug) ?? STATIC_CONTENT_UPDATED_AT)
    }))
  ];
}

export function buildSitemapXml(entries: Array<{ loc: string; lastmod?: string }>): string {
  const body = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmod}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}
