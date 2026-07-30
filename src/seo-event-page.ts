import type { PublicEventDetail } from "./public-detail";
import type { Env } from "./types";
import { relatedKnowledgeArticles, knowledgeArticleUrl } from "./knowledge";

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
  if (status === "resolved") return detail.item.resolved_at ? "Behoben" : "Behoben gemeldet";
  if (status === "stale_unconfirmed") return "Status nicht mehr bestätigt";
  if (status === "historical") return "Historische Meldung";
  return "Noch nicht bestätigt";
}

function formatDuration(minutes: number | null): string | null {
  if (minutes === null || minutes < 0) return null;
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} Std.${rest ? ` ${rest} Min.` : ""}`;
}

function activeDuration(detail: PublicEventDetail): string | null {
  const start = detail.item.active_since_at ?? detail.item.started_at;
  if (!start || detail.item.status !== "active") return null;
  const startTime = new Date(start).getTime();
  if (!Number.isFinite(startTime)) return null;
  return formatDuration(Math.max(0, Math.floor((Date.now() - startTime) / 60000)));
}

function statusLine(detail: PublicEventDetail): string {
  const item = detail.item;
  if (item.status === "active") {
    const duration = activeDuration(detail);
    return [
      "Noch aktiv",
      duration ? `${item.active_since_is_minimum ? "seit mindestens" : "seit"} ${duration}` : null,
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
  const reportedLocation = detail.item.location.replace(/^\s*(?:in|im|bei)\s+/i, "").trim();
  return reportedLocation || detail.map?.query || "der Schweiz";
}

function consistentSummary(detail: PublicEventDetail): string {
  const item = detail.item;
  const location = eventLocation(detail);
  if (item.status === "upcoming") return `Für ${location} ist ein geplanter Stromunterbruch gemeldet.`;
  if (item.status === "active") return `Für ${location} ist ein laufender Stromausfall gemeldet. Der jüngste bestätigte Stand ist unten ausgewiesen.`;
  if (item.status === "stale_unconfirmed") return `Für ${location} liegt eine Stromausfallmeldung vor. Der aktuelle Status ist nicht mehr bestätigt.`;
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
        ? `${statusLine(detail)}. Die öffentliche Quellenlage bezeichnet den Stromausfall in ${location} als behoben.`
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

export function eventSeo(detail: PublicEventDetail, origin: string) {
  const item = detail.item;
  const location = eventLocation(detail);
  const kind = item.nature === "planned" ? "Geplanter Stromunterbruch" : "Stromausfall";
  const summary = consistentSummary(detail);
  const date = formatDate(item.started_at);
  const title = `${kind} in ${location}${date ? ` am ${date.split(" um ")[0]}` : ""} | outage.ch`;
  const description = [
    `${kind} in ${location}.`,
    item.status === "upcoming" ? "Bevorstehend." : item.status === "resolved" ? "Behoben." : item.status === "stale_unconfirmed" ? "Status nicht mehr bestätigt." : item.status === "historical" ? "Historische Meldung." : "Aktuelle Informationen.",
    item.cause ? `Ursache: ${item.cause}.` : "",
    item.affected_area ? `Betroffen: ${item.affected_area}.` : "",
    summary
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
      location: {
        "@type": "Place", name: detail.map?.label ?? location,
        address: { "@type": "PostalAddress", addressLocality: location, addressRegion: item.canton ?? undefined, addressCountry: "CH" },
        ...(detail.map ? { geo: { "@type": "GeoCoordinates", latitude: detail.map.latitude, longitude: detail.map.longitude } } : {})
      },
      organizer: { "@type": "Organization", name: detail.operator?.name ?? "outage.ch", url: detail.operator?.url ?? `${origin}/` }
    });
  } else {
    graph[1].about = { "@type": "Thing", name: `${kind} in ${location}` };
  }
  return { title, description, canonical, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) };
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
  type AnswerState = "Bestätigt" | "Gemeldet" | "Offen";
  const rows = [
    ["Aktueller Status", statusLine(detail), "Gemeldet"],
    ["Beginn", formatDate(item.started_at) ?? "Noch nicht bestätigt", item.started_at ? "Bestätigt" : "Offen"],
    ["Ende / Wiederherstellung", formatDate(item.resolved_at) ?? (item.status === "resolved" ? "Behoben gemeldet · Zeitpunkt unbekannt" : "Noch nicht bestätigt"), item.resolved_at ? "Bestätigt" : item.status === "resolved" ? "Gemeldet" : "Offen"],
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

export function renderEventSeoMarkup(detail: PublicEventDetail): string {
  const item = detail.item;
  const location = eventLocation(detail);
  const kind = item.nature === "planned" ? "Geplanter Stromunterbruch" : "Stromausfall";
  const hasMap = Boolean(detail.map);
  const factRows = [
    ["Art", item.nature === "planned" ? "Geplant" : item.nature === "unplanned" ? "Ungeplant" : "Noch unklar"],
    ["Status", statusText(detail)],
    ["Beginn", formatDate(item.started_at)],
    ["Ende", formatDate(item.resolved_at) ?? (item.status === "resolved" ? "Zeitpunkt unbekannt" : null)],
    ["Dauer", formatDuration(item.duration_minutes) ?? activeDuration(detail)],
    ["Betroffene Region", item.affected_area ?? location],
    ["Ursache", item.cause]
  ].filter((row) => row[1]);
  return `<article class="event-brief seo-event">
    <header class="event-hero ${hasMap ? "has-map" : "no-map"}">${hasMap ? `<div id="event-map" role="img" aria-label="Karte von ${escapeHtml(detail.map!.label)}"></div>` : ""}<div class="hero-wash"></div><div class="hero-copy">
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
      ${renderKnowledgeLinks()}
    </div>
    <footer class="detail-note">Letzte Aktualisierung: ${escapeHtml(formatDate(item.updated_at))}. outage.ch dokumentiert öffentliche Meldungen und kennzeichnet fehlende Angaben bewusst als offen. Für verbindliche Informationen gelten Netzbetreiber und Behörden.</footer>
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
