import type { PublicEventDetail } from "./public-detail";
import type { Env } from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("de-CH", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Zurich" }).format(date)
    : null;
}

export function eventSeo(detail: PublicEventDetail, origin: string) {
  const item = detail.item;
  const kind = item.nature === "planned" ? "Geplanter Stromunterbruch" : "Stromausfall";
  const date = formatDate(item.started_at);
  const title = `${kind} in ${item.location}${date ? ` am ${date.split(" um ")[0]}` : ""} | outage.ch`;
  const description = [
    `${kind} in ${item.location}.`,
    item.status === "upcoming" ? "Bevorstehend." : item.status === "resolved" ? "Behoben." : "Aktuelle Informationen.",
    item.cause ? `Ursache: ${item.cause}.` : "",
    item.affected_area ? `Betroffen: ${item.affected_area}.` : "",
    item.summary
  ].filter(Boolean).join(" ").slice(0, 160);
  const canonical = new URL(item.url, origin).toString();
  const pageId = `${canonical}#webpage`;
  const graph: Record<string, unknown>[] = [
    { "@type": "WebSite", "@id": `${origin}/#website`, url: `${origin}/`, name: "outage.ch", inLanguage: "de-CH" },
    {
      "@type": "WebPage", "@id": pageId, url: canonical, name: title, description,
      isPartOf: { "@id": `${origin}/#website` }, dateModified: item.updated_at, inLanguage: "de-CH",
      breadcrumb: { "@id": `${canonical}#breadcrumb` }
    },
    {
      "@type": "BreadcrumbList", "@id": `${canonical}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Stromausfälle Schweiz", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: item.location, item: canonical }
      ]
    }
  ];
  if (item.started_at) {
    const eventId = `${canonical}#event`;
    graph[1].about = { "@id": eventId };
    graph.push({
      "@type": "Event", "@id": eventId, name: `${kind} in ${item.location}`,
      description: item.summary, startDate: item.started_at,
      ...(item.resolved_at ? { endDate: item.resolved_at } : {}),
      ...(item.status === "upcoming" ? { eventStatus: "https://schema.org/EventScheduled" } : {}),
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
        "@type": "Place", name: detail.map?.label ?? item.location,
        address: { "@type": "PostalAddress", addressLocality: item.location, addressRegion: item.canton ?? undefined, addressCountry: "CH" },
        ...(detail.map ? { geo: { "@type": "GeoCoordinates", latitude: detail.map.latitude, longitude: detail.map.longitude } } : {})
      },
      organizer: { "@type": "Organization", name: detail.operator?.name ?? "outage.ch", url: detail.operator?.url ?? `${origin}/` }
    });
  } else {
    graph[1].about = { "@type": "Thing", name: `${kind} in ${item.location}` };
  }
  return { title, description, canonical, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) };
}

export function renderEventSeoMarkup(detail: PublicEventDetail): string {
  const item = detail.item;
  const factRows = [
    ["Art", item.nature === "planned" ? "Geplant" : item.nature === "unplanned" ? "Ungeplant" : "Noch unklar"],
    ["Status", item.status === "upcoming" ? "Bevorstehend" : item.status === "resolved" ? "Behoben" : "Aktiv"],
    ["Beginn", formatDate(item.started_at)],
    ["Ende", formatDate(item.resolved_at)],
    ["Dauer", item.duration_minutes === null ? null : `${Math.floor(item.duration_minutes / 60)} Std. ${item.duration_minutes % 60} Min.`],
    ["Betroffene Region", item.affected_area],
    ["Ursache", item.cause]
  ].filter((row) => row[1]);
  return `<article class="event-brief seo-event">
    <header class="event-hero no-map"><div class="hero-wash"></div><div class="hero-copy">
      <div class="hero-meta"><span class="trust-mark"><i></i>${escapeHtml(item.trust === "official" ? "Offizielle Quelle" : "Nachvollziehbar gemeldet")}</span><span>Aktualisiert ${escapeHtml(formatDate(item.updated_at))}</span></div>
      <h1>Stromausfall in ${escapeHtml(item.location)}</h1><p>${escapeHtml(item.summary)}</p>
    </div></header>
    <section class="fact-strip"><h2>Informationen zum Vorfall</h2><dl>${factRows.map(([label, value]) =>
      `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></section>
    <div class="detail-flow">
      <section class="timeline-block"><div class="section-heading"><span>Verlauf</span><h2>Zeitliche Einordnung</h2></div>
      <ol>${detail.timeline.map((entry) => `<li><span class="timeline-mark"></span><div><span>${escapeHtml(entry.label)}</span><strong>${escapeHtml(formatDate(entry.value))}</strong></div></li>`).join("")}</ol></section>
      <section class="sources-block"><div class="section-heading"><span>Belege</span><h2>Quellen zum Stromausfall in ${escapeHtml(item.location)}</h2></div>
      <div class="source-list">${detail.sources.map((source, index) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer"><span class="source-index">${String(index + 1).padStart(2, "0")}</span><span class="source-copy"><small>${escapeHtml(source.role)}</small><strong>${escapeHtml(source.publisher)}</strong><span>${escapeHtml(source.domain)}</span></span></a>`).join("")}</div></section>
    </div>
    <footer class="detail-note">Letzte Aktualisierung: ${escapeHtml(formatDate(item.updated_at))}. outage.ch bündelt öffentliche Meldungen; für verbindliche Angaben gelten Netzbetreiber und Behörden.</footer>
  </article>`;
}

export async function renderSeoEventAsset(env: Pick<Env, "ASSETS">, request: Request, detail: PublicEventDetail): Promise<Response> {
  const assetUrl = new URL("/events/", request.url);
  const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
  const seo = eventSeo(detail, new URL(request.url).origin);
  const data = JSON.stringify(detail).replace(/</g, "\\u003c");
  return new HTMLRewriter()
    .on("title", { element(element) { element.setInnerContent(seo.title); } })
    .on('meta[name="description"]', { element(element) { element.setAttribute("content", seo.description); } })
    .on("head", { element(element) {
      element.append(`<link rel="canonical" href="${escapeHtml(seo.canonical)}"><meta property="og:title" content="${escapeHtml(seo.title)}"><meta property="og:description" content="${escapeHtml(seo.description)}"><meta property="og:url" content="${escapeHtml(seo.canonical)}"><meta property="og:type" content="article"><meta name="robots" content="index,follow,max-image-preview:large"><script type="application/ld+json">${seo.jsonLd}</script><script id="outage-event-data" type="application/json">${data}</script>`, { html: true });
    } })
    .on("#event-shell", { element(element) { element.setInnerContent(renderEventSeoMarkup(detail), { html: true }); element.setAttribute("aria-busy", "false"); } })
    .transform(new Response(asset.body, { status: asset.status, headers: { ...Object.fromEntries(asset.headers), "Cache-Control": "public,max-age=60,s-maxage=300,stale-while-revalidate=1800" } }));
}
