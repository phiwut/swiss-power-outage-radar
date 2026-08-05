import type { PublicEventDetail } from "./public-detail";
import type { Env, PublicFeedItem } from "./types";
import { relatedKnowledgeArticles, knowledgeArticleUrl } from "./knowledge";
import {
  DEFAULT_OG_IMAGE_PATH,
  SITE_ORIGIN,
  absoluteUrl,
  publicDisplayLocation
} from "./public-url";

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

function statusText(detail: PublicEventDetail): string {
  const status = detail.item.status;
  if (status === "upcoming") return "Bevorstehend";
  if (status === "active") return "Noch aktiv";
  if (status === "resolved") {
    if (isAutoClosed(detail)) return "Automatisch abgeschlossen";
    return detail.item.resolved_at ? "Behoben" : "Behoben gemeldet";
  }
  if (status === "stale_unconfirmed") return "Status nicht mehr bestätigt";
  if (status === "historical") return "Historische Meldung";
  return "Noch nicht bestätigt";
}

function isAutoClosed(detail: PublicEventDetail): boolean {
  return detail.item.status === "resolved" &&
    detail.item.time_confidence === "inferred" &&
    !detail.item.resolved_at;
}

function formatDuration(minutes: number | null): string | null {
  if (minutes === null || minutes < 0) return null;
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} Std.${rest ? ` ${rest} Min.` : ""}`;
}

function statusLine(detail: PublicEventDetail): string {
  const item = detail.item;
  if (item.status === "active") {
    return [
      "Noch aktiv",
      item.started_at ? `Beginn gemeldet ${formatDate(item.started_at)}` : null,
      item.last_confirmed_active_at ? `zuletzt bestätigt ${formatDate(item.last_confirmed_active_at)}` : null
    ].filter(Boolean).join(" · ");
  }
  if (item.status === "stale_unconfirmed") {
    return [
      "Status nicht mehr bestätigt",
      item.last_confirmed_active_at ? `zuletzt aktiv ${formatDate(item.last_confirmed_active_at)}` : null
    ].filter(Boolean).join(" · ");
  }
  if (item.status === "resolved") {
    if (isAutoClosed(detail)) {
      return [
        "Automatisch abgeschlossen",
        item.last_confirmed_active_at ? `letzte Bestätigung ${formatDate(item.last_confirmed_active_at)}` : null,
        "Dauer unbekannt"
      ].filter(Boolean).join(" · ");
    }
    const duration = formatDuration(item.duration_minutes);
    return [
      item.resolved_at ? "Behoben" : "Behoben gemeldet",
      duration ? `dauerte ${duration}` : null,
      !item.resolved_at ? "Zeitpunkt unbekannt" : null
    ].filter(Boolean).join(" · ");
  }
  return statusText(detail);
}

function eventLocation(detail: PublicEventDetail): string {
  return publicDisplayLocation(detail.item.location) || detail.map?.query || "der Schweiz";
}

function shortDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("de-CH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Zurich"
  }).format(date);
}

function clampText(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const boundary = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf(","));
  return `${(boundary > 40 ? cut.slice(0, boundary) : cut).trim()}…`;
}

function titlePlace(location: string): string {
  const primary = location.split(",")[0]?.trim() || location;
  return primary.length <= 36 ? primary : clampText(primary, 36).replace(/…$/, "").trim();
}

function buildEventTitle(kindShort: string, location: string, date: string | null): string {
  const place = titlePlace(location);
  const withDate = `${kindShort} ${place}${date ? `, ${date}` : ""} | outage.ch`;
  if (withDate.length <= 60) return withDate;
  const withoutDate = `${kindShort} ${place} | outage.ch`;
  if (withoutDate.length <= 60) return withoutDate;
  return `${clampText(`${kindShort} ${place}`, 45)} | outage.ch`;
}

function padDescription(parts: string[], min = 120, max = 158): string {
  const base = parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (base.length >= min) return clampText(base, max);
  const filler = " Details zu Beginn, Dauer, Ursache und Quellen auf outage.ch.";
  return clampText(`${base}${base.endsWith(".") ? "" : "."}${filler}`, max);
}

function consistentSummary(detail: PublicEventDetail): string {
  const item = detail.item;
  const location = eventLocation(detail);
  if (item.status === "upcoming") return `Für ${location} ist ein geplanter Stromunterbruch gemeldet.`;
  if (item.status === "active") return `Für ${location} ist ein laufender Stromausfall gemeldet. Der jüngste bestätigte Stand ist unten ausgewiesen.`;
  if (item.status === "stale_unconfirmed") return `Für ${location} liegt eine Stromausfallmeldung vor. Der aktuelle Status ist nicht mehr bestätigt.`;
  if (isAutoClosed(detail)) return `Der Fall in ${location} wurde nach 24 Stunden ohne neue Bestätigung automatisch abgeschlossen. Ob und wann die Stromversorgung wiederhergestellt wurde, ist nicht bekannt.`;
  if (item.status === "resolved" && !item.resolved_at) return `Der Stromausfall in ${location} wurde als behoben gemeldet. Der genaue Zeitpunkt ist nicht öffentlich bestätigt.`;
  if (item.status === "resolved") return `Der Stromausfall in ${location} wurde als behoben gemeldet.`;
  return item.summary;
}

export function eventFaq(detail: PublicEventDetail): Array<{ question: string; answer: string }> {
  const item = detail.item;
  const location = eventLocation(detail);
  const start = formatDate(item.started_at);
  const end = formatDate(item.resolved_at);
  const statusAnswer = item.status === "active"
    ? `${statusLine(detail)}. Verbindlich ist der aktuelle Stand des zuständigen Netzbetreibers.`
    : item.status === "upcoming"
      ? `Der Stromunterbruch in ${location} ist geplant und steht noch bevor. Prüfen Sie das Zeitfenster direkt beim Netzbetreiber.`
      : item.status === "resolved"
        ? isAutoClosed(detail)
          ? `${statusLine(detail)}. Das ist kein Nachweis einer Wiederherstellung; es liegt lediglich seit 24 Stunden keine neue Bestätigung vor.`
          : `${statusLine(detail)}. Die öffentliche Quellenlage bezeichnet den Stromausfall in ${location} als behoben.`
        : item.status === "stale_unconfirmed"
          ? `${statusLine(detail)}. Ohne neue Betreiberinformation wird die Meldung nicht als aktuell aktiv dargestellt.`
        : `Die Meldung zu ${location} ist historisch. Ohne neue Betreiberinformation wird sie nicht als aktuell aktiv dargestellt.`;
  return [
    {
      question: `Ist der Stromausfall in ${location} noch aktiv?`,
      answer: statusAnswer
    },
    {
      question: `Wann begann der Stromausfall in ${location}?`,
      answer: start
        ? `Als Beginn ist ${start} dokumentiert.`
        : "Eine genaue Startzeit wurde in den öffentlich verfügbaren Quellen bisher nicht bestätigt."
    },
    {
      question: `Wann ist der Strom in ${location} wieder verfügbar?`,
      answer: end
        ? `Die Wiederherstellung wurde für ${end} gemeldet.`
        : "Eine belastbare Endzeit ist noch nicht öffentlich bestätigt. Schätzungen werden auf outage.ch nicht als Tatsache dargestellt."
    },
    {
      question: `Was war die Ursache des Stromausfalls in ${location}?`,
      answer: item.cause
        ? `Als Ursache wird ${item.cause} genannt.`
        : "Zur Ursache liegt derzeit keine ausreichend konkrete öffentliche Angabe vor."
    },
    {
      question: `Welches Gebiet in ${location} ist betroffen?`,
      answer: item.affected_area
        ? `Als betroffenes Gebiet wird ${item.affected_area} genannt.`
        : `Die Meldung bezieht sich auf ${location}; eine genauere räumliche Abgrenzung ist öffentlich nicht bestätigt.`
    },
    {
      question: "Wo finde ich verbindliche Informationen?",
      answer: detail.operator
        ? `Verbindliche Angaben erhalten Sie beim zuständigen Netzbetreiber ${detail.operator.name}. outage.ch dokumentiert öffentlich zugängliche Meldungen und deren Quellen.`
        : "Verbindliche Angaben erhalten Sie beim lokalen Netzbetreiber. Dieser ist meist auf Ihrer Stromrechnung aufgeführt."
    }
  ];
}

export function eventSeo(detail: PublicEventDetail, origin = SITE_ORIGIN) {
  const siteOrigin = origin.includes("outage.ch") ? SITE_ORIGIN : origin.replace(/^http:/i, "https:");
  const item = detail.item;
  const location = eventLocation(detail);
  const kind = item.nature === "planned" ? "Geplanter Stromunterbruch" : "Stromausfall";
  const kindShort = item.nature === "planned" ? "Unterbruch" : "Stromausfall";
  const summary = consistentSummary(detail);
  const date = shortDate(item.started_at ?? item.received_at);
  const title = buildEventTitle(kindShort, location, date);
  const statusBit = item.status === "upcoming"
    ? "Bevorstehend"
    : item.status === "resolved"
      ? isAutoClosed(detail) ? "Automatisch abgeschlossen" : "Behoben"
      : item.status === "stale_unconfirmed"
        ? "Status unbestätigt"
        : item.status === "historical"
          ? "Historische Meldung"
          : "Aktuelle Infos";
  const description = padDescription([
    `${kind} in ${location}.`,
    `${statusBit}.`,
    item.cause ? `Ursache: ${item.cause}.` : "",
    item.affected_area ? `Betroffen: ${item.affected_area}.` : "",
    detail.operator ? `Netzbetreiber: ${detail.operator.name}.` : "",
    summary
  ]);
  const canonical = absoluteUrl(item.url, siteOrigin);
  const ogImage = detail.evidence[0]?.image_url
    ? absoluteUrl(detail.evidence[0].image_url, siteOrigin)
    : absoluteUrl(DEFAULT_OG_IMAGE_PATH, siteOrigin);
  const pageId = `${canonical}#webpage`;
  const graph: Record<string, unknown>[] = [
    { "@type": "WebSite", "@id": `${siteOrigin}/#website`, url: `${siteOrigin}/`, name: "outage.ch", inLanguage: "de-CH" },
    {
      "@type": "WebPage", "@id": pageId, url: canonical, name: title, description,
      isPartOf: { "@id": `${siteOrigin}/#website` }, dateModified: item.updated_at, inLanguage: "de-CH",
      breadcrumb: { "@id": `${canonical}#breadcrumb` },
      primaryImageOfPage: { "@type": "ImageObject", url: ogImage }
    },
    {
      "@type": "BreadcrumbList", "@id": `${canonical}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Stromausfälle Schweiz", item: `${siteOrigin}/` },
        { "@type": "ListItem", position: 2, name: location, item: canonical }
      ]
    }
  ];
  const faqId = `${canonical}#faq`;
  graph[1].mainEntity = { "@id": faqId };
  graph.push({
    "@type": "FAQPage",
    "@id": faqId,
    mainEntity: eventFaq(detail).map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer }
    }))
  });
  if (item.started_at) {
    const eventId = `${canonical}#event`;
    graph[1].about = { "@id": eventId };
    graph.push({
      "@type": "Event", "@id": eventId, name: `${kind} in ${location}`,
      description: summary, startDate: item.started_at,
      ...(item.resolved_at ? { endDate: item.resolved_at } : {}),
      ...(item.status === "upcoming" ? { eventStatus: "https://schema.org/EventScheduled" } : {}),
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      image: [ogImage],
      location: {
        "@type": "Place", name: detail.map?.label ?? location,
        address: { "@type": "PostalAddress", addressLocality: location, addressRegion: item.canton ?? undefined, addressCountry: "CH" },
        ...(detail.map ? { geo: { "@type": "GeoCoordinates", latitude: detail.map.latitude, longitude: detail.map.longitude } } : {})
      },
      organizer: { "@type": "Organization", name: detail.operator?.name ?? "outage.ch", url: detail.operator?.url ?? `${siteOrigin}/` }
    });
  } else {
    graph[1].about = { "@type": "Thing", name: `${kind} in ${location}` };
  }
  return { title, description, canonical, ogImage, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) };
}

function renderSourceRole(role: PublicEventDetail["sources"][number]["role"]): string {
  return role === "operator" ? "Netzbetreiber" : role === "authority" ? "Behörde" : "Medienquelle";
}

function renderSourceCards(detail: PublicEventDetail): string {
  if (!detail.sources.length) return "";
  return `<section class="sources-block" aria-labelledby="sources-heading">
    <div class="section-heading"><span>Transparenz</span><h2 id="sources-heading">Quellen und gemeldete Inhalte</h2></div>
    <p class="section-intro">Diese Vorfallsakte basiert auf den folgenden öffentlichen Meldungen. Angezeigt werden nur Aussagen, die einer Quelle zugeordnet werden können.</p>
    <div class="source-report-list">${detail.sources.map((source, index) => {
      const screenshot = detail.evidence.find((entry) => entry.source_url === source.url);
      return `<article class="source-report">
        ${screenshot ? `<a class="source-preview" href="${escapeHtml(screenshot.image_url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(screenshot.image_url)}" alt="Archivierter Screenshot der Quelle ${escapeHtml(source.publisher)}" loading="lazy"><span>Archivierte Ansicht · PNG</span></a>` : ""}
        <div class="source-report-body">
          <div class="source-report-meta"><span>${String(index + 1).padStart(2, "0")}</span><b>${escapeHtml(renderSourceRole(source.role))}</b>${source.published_at ? `<time datetime="${escapeHtml(source.published_at)}">${escapeHtml(formatDate(source.published_at))}</time>` : ""}</div>
          <h3>${escapeHtml(source.title || source.publisher)}</h3>
          ${source.excerpt ? `<blockquote>${escapeHtml(source.excerpt)}</blockquote>` : `<p class="source-empty">Die Quelle bestätigt den Vorfall, enthält aber keine weitere öffentlich belegte Detailangabe.</p>`}
          ${source.facts.length ? `<dl class="source-facts">${source.facts.map((fact) => `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.format === "datetime" ? formatDate(fact.value) : fact.value)}</dd></div>`).join("")}</dl>` : ""}
          <div class="source-report-footer"><span>${escapeHtml(source.domain)}</span><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">Originalquelle öffnen ↗</a></div>
          ${screenshot ? `<small class="source-proof">Screenshot erfasst ${escapeHtml(formatDate(screenshot.captured_at))} · SHA-256 ${escapeHtml(screenshot.sha256.slice(0, 16))}…</small>` : ""}
        </div>
      </article>`;
    }).join("")}</div>
  </section>`;
}

function renderIncidentAnswers(detail: PublicEventDetail): string {
  const item = detail.item;
  const location = eventLocation(detail);
  type AnswerState = "Bestätigt" | "Gemeldet" | "Automatisch" | "Offen";
  const rows = [
    ["Aktueller Status", statusLine(detail), isAutoClosed(detail) ? "Automatisch" : "Gemeldet"],
    ["Beginn", formatDate(item.started_at) ?? "Noch nicht bestätigt", item.started_at ? "Bestätigt" : "Offen"],
    ["Ende / Wiederherstellung", formatDate(item.resolved_at) ?? (isAutoClosed(detail) ? "Nicht bekannt" : item.status === "resolved" ? "Behoben gemeldet · Zeitpunkt unbekannt" : "Noch nicht bestätigt"), item.resolved_at ? "Bestätigt" : isAutoClosed(detail) ? "Offen" : item.status === "resolved" ? "Gemeldet" : "Offen"],
    ["Ursache", item.cause ?? "Noch nicht öffentlich bekannt", item.cause ? "Gemeldet" : "Offen"],
    ["Betroffenes Gebiet", item.affected_area ?? location, "Gemeldet"]
  ] as Array<[string, string, AnswerState]>;
  return `<section class="answers-block" aria-labelledby="answers-heading">
    <div class="section-heading"><span>Schnellantworten</span><h2 id="answers-heading">Was zum Stromausfall in ${escapeHtml(location)} bekannt ist</h2></div>
    <div class="answer-grid">${rows.map(([label, value, state]) => `<div class="${state === "Offen" ? "is-open" : "is-known"}"><span>${state}</span><h3>${escapeHtml(label)}</h3><p>${escapeHtml(value)}</p></div>`).join("")}</div>
  </section>`;
}

function renderFaq(detail: PublicEventDetail): string {
  return `<section class="event-faq" aria-labelledby="faq-heading">
    <div class="section-heading"><span>FAQ</span><h2 id="faq-heading">Häufige Fragen zu diesem Vorfall</h2></div>
    ${eventFaq(detail).map((faq) => `<details><summary>${escapeHtml(faq.question)}</summary><p>${escapeHtml(faq.answer)}</p></details>`).join("")}
  </section>`;
}

function renderKnowledgeLinks(): string {
  return `<section class="knowledge-links" aria-labelledby="knowledge-heading">
    <div class="section-heading"><span>Einordnung</span><h2 id="knowledge-heading">Mehr über Stromausfälle wissen</h2></div>
    <div>${relatedKnowledgeArticles(3).map((article, index) => `<a href="${knowledgeArticleUrl(article)}"><span>${String(index + 1).padStart(2, "0")}</span><div><small>${article.readingMinutes} Minuten</small><strong>${escapeHtml(article.shortTitle)}</strong><p>${escapeHtml(article.description)}</p></div><b>→</b></a>`).join("")}</div>
    <a class="all-guides" href="/ratgeber/">Alle Ratgeber ansehen</a>
  </section>`;
}

function relatedStatusLabel(item: PublicFeedItem): string {
  if (item.status === "upcoming") return "Bevorstehend";
  if (item.status === "active") return "Aktiv";
  if (item.status === "resolved") return "Behoben";
  if (item.status === "stale_unconfirmed") return "Unbestätigt";
  if (item.status === "historical") return "Historisch";
  return "Meldung";
}

function renderRelatedEvents(related: PublicFeedItem[]): string {
  if (!related.length) return "";
  return `<section class="related-events" aria-labelledby="related-heading">
    <div class="section-heading"><span>Weitere Meldungen</span><h2 id="related-heading">Aktuelle Stromausfälle in der Schweiz</h2></div>
    <div class="related-list">${related.map((item) => {
      const location = publicDisplayLocation(item.location);
      const kind = item.nature === "planned" ? "Geplanter Unterbruch" : "Stromausfall";
      return `<a href="${escapeHtml(item.url)}"><span>${escapeHtml(relatedStatusLabel(item))}</span><strong>${escapeHtml(kind)} in ${escapeHtml(location)}</strong><small>${escapeHtml(item.source.publisher)}</small></a>`;
    }).join("")}</div>
    <a class="all-guides" href="/">Alle Meldungen ansehen</a>
  </section>`;
}

export function renderEventSeoMarkup(detail: PublicEventDetail, related: PublicFeedItem[] = []): string {
  const item = detail.item;
  const location = eventLocation(detail);
  const kind = item.nature === "planned" ? "Geplanter Stromunterbruch" : "Stromausfall";
  const hasMap = Boolean(detail.map);
  const factRows = [
    ["Art", item.nature === "planned" ? "Geplant" : item.nature === "unplanned" ? "Ungeplant" : "Noch unklar"],
    ["Status", statusText(detail)],
    ["Beginn", formatDate(item.started_at)],
    ["Ende", formatDate(item.resolved_at) ?? (item.status === "resolved" ? "Nicht bekannt" : null)],
    ["Dauer", formatDuration(item.duration_minutes)],
    ["Betroffene Region", item.affected_area ?? location],
    ["Ursache", item.cause]
  ].filter((row) => row[1]);
  return `<article class="event-brief seo-event">
    <header class="event-hero ${hasMap ? "has-map map-loading" : "no-map"}">${hasMap ? `<div id="event-map" role="img" aria-label="Karte von ${escapeHtml(detail.map!.label)}"></div><div class="map-fallback" aria-hidden="true"><span></span><strong>${escapeHtml(detail.map!.label)}</strong><small>Karte wird geladen</small></div>` : ""}<div class="hero-wash"></div><div class="hero-copy">
      <div class="hero-meta"><span class="trust-mark"><i></i>${escapeHtml(item.trust === "official" ? "Offizielle Quelle" : "Nachvollziehbar gemeldet")}</span><span>Aktualisiert ${escapeHtml(formatDate(item.updated_at))}</span></div>
      <p class="hero-statusline">${escapeHtml(statusLine(detail))}</p>
      <h1>${escapeHtml(kind)} in ${escapeHtml(location)}</h1><p>${escapeHtml(consistentSummary(detail))}</p>
    </div>${hasMap ? `<span class="map-place">${escapeHtml(detail.map!.label)}</span>` : ""}</header>
    <section class="fact-strip"><h2>Informationen zum Vorfall</h2><dl>${factRows.map(([label, value]) =>
      `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></section>
    <div class="detail-flow">
      ${renderIncidentAnswers(detail)}
      <section class="timeline-block"><div class="section-heading"><span>Verlauf</span><h2>Zeitliche Einordnung</h2></div>
      <ol>${detail.timeline.map((entry) => `<li><span class="timeline-mark"></span><div><span>${escapeHtml(entry.label)}</span><strong>${escapeHtml(formatDate(entry.value))}</strong></div></li>`).join("")}</ol></section>
      ${renderSourceCards(detail)}
      ${renderFaq(detail)}
      ${renderRelatedEvents(related)}
      ${renderKnowledgeLinks()}
    </div>
    <footer class="detail-note">Letzte Aktualisierung: ${escapeHtml(formatDate(item.updated_at))}. outage.ch dokumentiert öffentliche Meldungen und kennzeichnet fehlende Angaben bewusst als offen. Für verbindliche Informationen gelten Netzbetreiber und Behörden.</footer>
  </article>`;
}

function setMetaContent(content: string) {
  return {
    element(element: Element) {
      element.setAttribute("content", content);
    }
  };
}

export async function renderSeoEventAsset(
  env: Pick<Env, "ASSETS">,
  request: Request,
  detail: PublicEventDetail,
  related: PublicFeedItem[] = []
): Promise<Response> {
  const assetUrl = new URL("/events/", request.url);
  const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
  const seo = eventSeo(detail, SITE_ORIGIN);
  const data = JSON.stringify(detail).replace(/</g, "\\u003c");
  return new HTMLRewriter()
    .on("title", { element(element) { element.setInnerContent(seo.title); } })
    .on('meta[name="description"]', setMetaContent(seo.description))
    .on('meta[property="og:title"]', setMetaContent(seo.title))
    .on('meta[property="og:description"]', setMetaContent(seo.description))
    .on('meta[property="og:type"]', setMetaContent("article"))
    .on('meta[property="og:url"]', setMetaContent(seo.canonical))
    .on('meta[property="og:image"]', setMetaContent(seo.ogImage))
    .on('meta[name="twitter:title"]', setMetaContent(seo.title))
    .on('meta[name="twitter:description"]', setMetaContent(seo.description))
    .on('meta[name="twitter:image"]', setMetaContent(seo.ogImage))
    .on('link[rel="canonical"]', { element(element) { element.setAttribute("href", seo.canonical); } })
    .on("head", { element(element) {
      element.append(`<meta name="robots" content="index,follow,max-image-preview:large"><script type="application/ld+json">${seo.jsonLd}</script><script id="outage-event-data" type="application/json">${data}</script>`, { html: true });
    } })
    .on("#event-shell", { element(element) { element.setInnerContent(renderEventSeoMarkup(detail, related), { html: true }); element.setAttribute("aria-busy", "false"); } })
    .transform(new Response(asset.body, { status: asset.status, headers: { ...Object.fromEntries(asset.headers), "Cache-Control": "public,max-age=60,s-maxage=300,stale-while-revalidate=1800" } }));
}

export function renderHomeFeedLinks(items: PublicFeedItem[]): string {
  if (!items.length) {
    return `<nav class="seo-feed-index" aria-label="Aktuelle Stromausfall-Meldungen"><p>Aktuell sind keine öffentlichen Meldungen verfügbar.</p><a href="/ratgeber/">Stromausfall-Ratgeber</a></nav>`;
  }
  return `<nav class="seo-feed-index" aria-label="Aktuelle Stromausfall-Meldungen">
    <h2>Aktuelle Meldungen</h2>
    <ul>${items.map((item) => {
      const location = publicDisplayLocation(item.location);
      const kind = item.nature === "planned" ? "Geplanter Stromunterbruch" : "Stromausfall";
      return `<li><a href="${escapeHtml(item.url)}">${escapeHtml(kind)} in ${escapeHtml(location)}</a></li>`;
    }).join("")}</ul>
    <p><a href="/ratgeber/">Ratgeber zu Stromausfällen</a></p>
  </nav>`;
}

export async function renderHomeSeoAsset(
  env: Pick<Env, "ASSETS">,
  request: Request,
  items: PublicFeedItem[]
): Promise<Response> {
  const asset = await env.ASSETS.fetch(new Request(new URL("/", request.url), request));
  const canonical = absoluteUrl("/", SITE_ORIGIN);
  const ogImage = absoluteUrl(DEFAULT_OG_IMAGE_PATH, SITE_ORIGIN);
  const feedLinks = renderHomeFeedLinks(items);
  return new HTMLRewriter()
    .on('link[rel="canonical"]', { element(element) { element.setAttribute("href", canonical); } })
    .on('meta[property="og:url"]', setMetaContent(canonical))
    .on('meta[property="og:image"]', setMetaContent(ogImage))
    .on('meta[name="twitter:image"]', setMetaContent(ogImage))
    .on(".radar", { element(element) {
      element.append(feedLinks, { html: true });
    } })
    .transform(new Response(asset.body, {
      status: asset.status,
      headers: {
        ...Object.fromEntries(asset.headers),
        "Cache-Control": "public,max-age=60,s-maxage=120,stale-while-revalidate=600"
      }
    }));
}
