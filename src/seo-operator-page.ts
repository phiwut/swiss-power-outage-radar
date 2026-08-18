import type { Env, PublicFeedItem } from "./types";
import { getPublicFeedItemsByOperator } from "./db";
import {
  ELCOM_PRICE_URL,
  elcomDatasetJsonLd,
  elcomFactsDisclaimer,
  elcomFactsForSlug,
  elcomFactsInsight,
  elcomFactsRows
} from "./elcom-operator-facts";
import {
  eventMatchesOperator,
  operatorFaqs,
  operatorLiveInsight,
  operatorProfileUrl,
  publicOperatorProfiles,
  relatedOperatorProfiles,
  sourceCategoryLabel,
  summarizeOperatorEvents,
  type OperatorLiveContext,
  type OperatorLiveStats,
  type OperatorProfile
} from "./operators";
import { DEFAULT_OG_IMAGE_PATH, SITE_ORIGIN, absoluteUrl, publicDisplayLocation } from "./public-url";
import { organizationId, websiteId } from "./seo-site";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" }).format(date)
    : null;
}

function formatDuration(minutes: number | null): string | null {
  if (minutes === null || minutes < 0) return null;
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} Std.${rest ? ` ${rest} Min.` : ""}`;
}

function statusLabel(status: PublicFeedItem["status"]): string {
  if (status === "upcoming") return "Bevorstehend";
  if (status === "active") return "Aktiv";
  if (status === "resolved") return "Behoben";
  if (status === "stale_unconfirmed") return "Unbestätigt";
  if (status === "historical") return "Historisch";
  return "Meldung";
}

export async function loadOperatorLive(
  db: D1Database,
  profile: OperatorProfile,
  input: { excludeId?: number; limit?: number } = {}
): Promise<OperatorLiveContext> {
  const items = await getPublicFeedItemsByOperator(db, profile, input.limit ?? 40);
  return {
    profile,
    stats: summarizeOperatorEvents(items),
    recent: items.filter((item) => item.id !== input.excludeId).slice(0, 12)
  };
}

export function parseOperatorPath(pathname: string): { hub: true } | { hub: false; slug: string } | null {
  if (pathname === "/netzbetreiber" || pathname === "/netzbetreiber/") return { hub: true };
  const match = pathname.match(/^\/netzbetreiber\/([a-z0-9-]+)\/?$/);
  return match ? { hub: false, slug: match[1] } : null;
}

export function operatorLiveTitle(operator: OperatorProfile, stats: OperatorLiveStats): string {
  if (stats.total > 0) {
    const count = stats.total === 1 ? "1 Meldung" : `${stats.total} Meldungen`;
    const title = `Störungen ${operator.name}: ${count} | outage.ch`;
    if (title.length <= 60) return title;
  }
  return `Störungen ${operator.name}: offizielle Quelle | outage.ch`;
}

export function operatorLiveDescription(operator: OperatorProfile, stats: OperatorLiveStats): string {
  const insight = operatorLiveInsight(operator, stats);
  return insight.length <= 158 ? insight : `${insight.slice(0, 157).trimEnd()}…`;
}

function statsRows(stats: OperatorLiveStats): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["Öffentliche Meldungen", String(stats.total)],
    ["Aktiv", String(stats.active)],
    ["Geplant, bevorstehend", String(stats.upcoming)],
    ["Ungeplant", String(stats.unplanned)],
    ["Geplant insgesamt", String(stats.planned)],
    ["Letzte 30 Tage", String(stats.last30Days)]
  ];
  if (stats.medianDurationMinutes !== null && stats.knownDurations > 0) {
    rows.push(["Median-Dauer (belegt)", formatDuration(stats.medianDurationMinutes) ?? "–"]);
  }
  return rows;
}

export function renderOperatorStatsGrid(stats: OperatorLiveStats, footnote: string): string {
  return `<div class="operator-stats">
    <dl>${statsRows(stats).map(([label, value]) =>
      `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    ).join("")}</dl>
    <p class="operator-stats-note">${escapeHtml(footnote)}</p>
  </div>`;
}

function renderEventList(items: PublicFeedItem[]): string {
  if (!items.length) return "";
  return `<ul class="operator-event-list">${items.map((item) => {
    const location = publicDisplayLocation(item.location);
    const kind = item.nature === "planned" ? "Geplanter Unterbruch" : "Stromausfall";
    const when = formatDate(item.started_at ?? item.updated_at);
    return `<li>
      <a href="${escapeHtml(item.url)}">
        <span>${escapeHtml(statusLabel(item.status))}</span>
        <strong>${escapeHtml(kind)} in ${escapeHtml(location)}</strong>
        <small>${escapeHtml([when, item.nature === "planned" ? "geplant" : "ungeplant"].filter(Boolean).join(" · "))}</small>
      </a>
    </li>`;
  }).join("")}</ul>`;
}

export function renderOperatorLiveSection(live: OperatorLiveContext): string {
  const { profile, stats, recent } = live;
  const insight = operatorLiveInsight(profile, stats);
  const footnote = "Zählung auf outage.ch: nur öffentlich belegte Meldungen, keine Schätzung der Betriebsqualität und kein Ersatz für die Störungsseite des Werks.";
  const places = stats.topLocations.length
    ? `<p>Häufig genannte Orte in diesen Meldungen: ${stats.topLocations
        .map((place) => `${escapeHtml(place.label)} (${place.count})`)
        .join(", ")}.</p>`
    : "";
  const updated = formatDate(stats.lastUpdatedAt);
  return `<section id="operator-live" class="operator-live">
    <h2>Öffentliche Meldungen im Radar</h2>
    <p class="article-lead">${escapeHtml(insight)}</p>
    ${renderOperatorStatsGrid(stats, footnote)}
    ${places}
    ${updated ? `<p>Zuletzt aktualisierte Meldung: ${escapeHtml(updated)}.</p>` : ""}
    ${recent.length
      ? `<h3>Aktuelle Meldungen von ${escapeHtml(profile.name)}</h3>${renderEventList(recent)}`
      : `<p>Sobald eine öffentlich belegte Meldung aus der Quelle von ${escapeHtml(profile.name)} übernommen wird, erscheint sie hier mit Status und Link.</p>`}
  </section>`;
}

export function renderElcomFactsSection(operator: OperatorProfile): string {
  const facts = elcomFactsForSlug(operator.slug);
  if (!facts) return "";
  const rows = elcomFactsRows(facts);
  return `<section id="operator-facts" class="operator-live">
    <h2>ElCom-Kennzahlen</h2>
    <p class="article-lead">${escapeHtml(elcomFactsInsight(operator.name, facts))}</p>
    <div class="operator-stats">
      <dl>${rows.map(([label, value]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
      ).join("")}</dl>
      <p class="operator-stats-note">${escapeHtml(elcomFactsDisclaimer())}</p>
    </div>
    <p>
      <a class="operator-official" href="${escapeHtml(ELCOM_PRICE_URL)}" target="_blank" rel="noreferrer">
        ElCom-Strompreisübersicht öffnen
        <span>↗</span>
      </a>
    </p>
  </section>`;
}

export function renderOperatorRelated(operator: OperatorProfile): string {
  const related = relatedOperatorProfiles(operator, 4);
  if (!related.length) return "";
  return `<section class="related-guides" aria-labelledby="related-operators-heading">
    <p class="knowledge-eyebrow">Weitere Werke</p>
    <h2 id="related-operators-heading">Andere beobachtete Netzbetreiber</h2>
    ${related.map((profile) =>
      `<a href="${escapeHtml(operatorProfileUrl(profile))}"><small>${escapeHtml(sourceCategoryLabel(profile.sourceCategory))}</small><strong>${escapeHtml(profile.name)}</strong><p>${escapeHtml(profile.area)}</p></a>`
    ).join("")}
  </section>`;
}

export function renderOperatorFaqsHtml(operator: OperatorProfile, stats: OperatorLiveStats | null): string {
  const faqs = operatorFaqs(operator, stats);
  return faqs.map((faq) =>
    `<details><summary>${escapeHtml(faq.question)}</summary><p>${escapeHtml(faq.answer)}</p></details>`
  ).join("");
}

export function operatorPageJsonLd(
  operator: OperatorProfile,
  stats: OperatorLiveStats | null,
  origin = SITE_ORIGIN
): string {
  const canonical = `${origin}${operatorProfileUrl(operator)}`;
  const faqs = operatorFaqs(operator, stats);
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      "@id": `${canonical}#page`,
      url: canonical,
      name: stats ? operatorLiveTitle(operator, stats) : `Störungen ${operator.name}`,
      description: stats ? operatorLiveDescription(operator, stats) : operatorLiveInsight(operator, summarizeOperatorEvents([])),
      inLanguage: "de-CH",
      isPartOf: { "@id": websiteId(origin) },
      about: {
        "@type": "Organization",
        name: operator.name,
        url: operator.officialUrl,
        areaServed: operator.area,
        sameAs: operator.officialUrl
      },
      publisher: { "@id": organizationId(origin) }
    },
    {
      "@type": "FAQPage",
      "@id": `${canonical}#faq`,
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer }
      }))
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Stromausfälle Schweiz", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Netzbetreiber", item: `${origin}/netzbetreiber/` },
        { "@type": "ListItem", position: 3, name: operator.name, item: canonical }
      ]
    }
  ];
  const elcom = elcomFactsForSlug(operator.slug);
  if (elcom) graph.push(elcomDatasetJsonLd(operator.name, elcom, canonical));
  if (stats) {
    graph.push({
      "@type": "Dataset",
      "@id": `${canonical}#dataset`,
      name: `Öffentliche Stromausfallmeldungen ${operator.name}`,
      description: `Zählung öffentlich belegter Stromausfallmeldungen von ${operator.name} auf outage.ch.`,
      creator: { "@id": organizationId(origin) },
      isAccessibleForFree: true,
      license: `${origin}/ueber/`,
      variableMeasured: statsRows(stats).map(([name, value]) => ({
        "@type": "PropertyValue",
        name,
        value
      }))
    });
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

export function groupPublicItemsByOperator(items: PublicFeedItem[]): Map<string, PublicFeedItem[]> {
  const grouped = new Map<string, PublicFeedItem[]>();
  for (const operator of publicOperatorProfiles()) {
    const matched = items.filter((item) => eventMatchesOperator(item, operator));
    if (matched.length) grouped.set(operator.slug, matched);
  }
  return grouped;
}

export function renderOperatorHubLive(
  items: PublicFeedItem[]
): { summary: string; list: string } {
  const grouped = groupPublicItemsByOperator(items);
  const operators = [...publicOperatorProfiles()].sort((left, right) => {
    const leftCount = grouped.get(left.slug)?.length ?? 0;
    const rightCount = grouped.get(right.slug)?.length ?? 0;
    if (leftCount !== rightCount) return rightCount - leftCount;
    return left.name.localeCompare(right.name, "de-CH");
  });
  const withEvents = operators.filter((operator) => (grouped.get(operator.slug)?.length ?? 0) > 0).length;
  const total = items.filter((item) =>
    publicOperatorProfiles().some((operator) => eventMatchesOperator(item, operator))
  ).length;
  const summary = total
    ? `Derzeit sind ${total} öffentliche Meldungen ${withEvents} beobachteten Werken zugeordnet. Die Zahlen zählen nur Radar-Meldungen, nicht den vollständigen Netzbetrieb.`
    : "Aktuell ist keine öffentliche Meldung einem beobachteten Werk zugeordnet. Die Werke bleiben zuständig, auch ohne Eintrag im Radar.";
  const list = operators.map((operator) => {
    const matched = grouped.get(operator.slug) ?? [];
    const stats = summarizeOperatorEvents(matched);
    const countLabel = stats.total
      ? stats.active
        ? `${stats.total} Meldungen · ${stats.active} aktiv`
        : `${stats.total} öffentliche Meldungen`
      : sourceCategoryLabel(operator.sourceCategory);
    return `<a href="${escapeHtml(operatorProfileUrl(operator))}" data-operator-slug="${escapeHtml(operator.slug)}">
      <strong>${escapeHtml(operator.name)}</strong>
      <span>${escapeHtml(operator.area)} · ${escapeHtml(countLabel)}</span>
    </a>`;
  }).join("");
  return { summary, list };
}

function setMetaContent(content: string) {
  return {
    element(element: Element) {
      element.setAttribute("content", content);
    }
  };
}

export async function renderSeoOperatorAsset(
  env: Pick<Env, "ASSETS">,
  request: Request,
  live: OperatorLiveContext
): Promise<Response> {
  const { profile, stats } = live;
  const assetUrl = new URL(operatorProfileUrl(profile), request.url);
  const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
  const title = operatorLiveTitle(profile, stats);
  const description = operatorLiveDescription(profile, stats);
  const canonical = absoluteUrl(operatorProfileUrl(profile), SITE_ORIGIN);
  const ogImage = absoluteUrl(DEFAULT_OG_IMAGE_PATH, SITE_ORIGIN);
  const jsonLd = operatorPageJsonLd(profile, stats);
  return new HTMLRewriter()
    .on("title", { element(element) { element.setInnerContent(title); } })
    .on('meta[name="description"]', setMetaContent(description))
    .on('meta[property="og:title"]', setMetaContent(title))
    .on('meta[property="og:description"]', setMetaContent(description))
    .on('meta[property="og:url"]', setMetaContent(canonical))
    .on('meta[property="og:image"]', setMetaContent(ogImage))
    .on('meta[name="twitter:title"]', setMetaContent(title))
    .on('meta[name="twitter:description"]', setMetaContent(description))
    .on('link[rel="canonical"]', { element(element) { element.setAttribute("href", canonical); } })
    .on("#operator-jsonld", { element(element) { element.setInnerContent(jsonLd); } })
    .on("#operator-live", { element(element) { element.replace(renderOperatorLiveSection(live), { html: true }); } })
    .on("#operator-facts", { element(element) {
      const html = renderElcomFactsSection(profile);
      if (html) element.replace(html, { html: true });
    } })
    .on("#operator-faq", { element(element) { element.setInnerContent(renderOperatorFaqsHtml(profile, stats), { html: true }); } })
    .transform(new Response(asset.body, {
      status: asset.status,
      headers: {
        ...Object.fromEntries(asset.headers),
        "Cache-Control": "public,max-age=60,s-maxage=300,stale-while-revalidate=1800"
      }
    }));
}

export async function renderSeoOperatorHubAsset(
  env: Pick<Env, "ASSETS">,
  request: Request,
  items: PublicFeedItem[]
): Promise<Response> {
  const asset = await env.ASSETS.fetch(new Request(new URL("/netzbetreiber/", request.url), request));
  const live = renderOperatorHubLive(items);
  const description = live.summary.length <= 158 ? live.summary : `${live.summary.slice(0, 157).trimEnd()}…`;
  return new HTMLRewriter()
    .on('meta[name="description"]', setMetaContent(description))
    .on('meta[property="og:description"]', setMetaContent(description))
    .on("#operator-hub-live", { element(element) { element.setInnerContent(live.summary); } })
    .on("#operator-list", { element(element) { element.setInnerContent(live.list, { html: true }); } })
    .transform(new Response(asset.body, {
      status: asset.status,
      headers: {
        ...Object.fromEntries(asset.headers),
        "Cache-Control": "public,max-age=60,s-maxage=180,stale-while-revalidate=900"
      }
    }));
}

export function operatorSitemapLastmods(items: PublicFeedItem[]): Map<string, string> {
  const grouped = groupPublicItemsByOperator(items);
  const lastmods = new Map<string, string>();
  for (const [slug, matched] of grouped) {
    const latest = matched.reduce((max, item) => item.updated_at > max ? item.updated_at : max, matched[0]?.updated_at ?? "");
    if (latest) lastmods.set(slug, latest);
  }
  return lastmods;
}
