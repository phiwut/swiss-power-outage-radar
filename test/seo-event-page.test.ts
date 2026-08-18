import { describe, expect, it } from "vitest";
import { eventSeo, renderEventSeoMarkup, renderHomeFeedLinks } from "../src/seo-event-page";
import type { PublicEventDetail } from "../src/public-detail";

function detail(): PublicEventDetail {
  return {
    item: {
      id: 42, location: "Zürich", canton: "ZH", url: "/stromausfall/zurich-42",
      received_at: "2026-07-29T08:00:00.000Z", started_at: "2026-08-02T06:00:00.000Z",
      resolved_at: "2026-08-02T08:00:00.000Z", status: "upcoming", nature: "planned",
      duration_minutes: 120, cause: "Wartungsarbeiten", affected_area: "Kreis 4",
      updated_at: "2026-07-29T09:00:00.000Z", summary: "Geplanter Unterbruch im Kreis 4.",
      trust: "official", source: { publisher: "ewz", url: "https://www.ewz.ch/", domain: "ewz.ch" }
    },
    map: null, facts: [], timeline: [], operator: null,
    sources: [{
      publisher: "ewz",
      url: "https://www.ewz.ch/",
      domain: "ewz.ch",
      role: "operator",
      title: "Geplanter Unterbruch im Kreis 4",
      published_at: "2026-07-29T07:45:00.000Z",
      excerpt: "Wegen Wartungsarbeiten wird die Versorgung im Kreis 4 vorübergehend unterbrochen.",
      facts: [{ label: "Betroffen", value: "Kreis 4", format: "text" }]
    }],
    evidence: []
  };
}

describe("SEO event page", () => {
  it("creates a canonical location URL and structured event data", () => {
    const seo = eventSeo(detail(), "https://outage.ch");
    expect(seo.canonical).toBe("https://outage.ch/stromausfall/zurich-42");
    expect(seo.title).toContain("Unterbruch Zürich");
    expect(seo.title.length).toBeLessThanOrEqual(60);
    expect(seo.title).not.toContain("…");
    expect(seo.description.length).toBeGreaterThanOrEqual(120);
    expect(seo.ogImage).toContain("/og-default.png");
    const graph = JSON.parse(seo.jsonLd)["@graph"];
    expect(graph.some((entry: { "@type": string }) => entry["@type"] === "Event")).toBe(true);
    expect(graph.some((entry: { "@type": string }) => entry["@type"] === "FAQPage")).toBe(true);
  });

  it("keeps long compound locations readable in the title without ellipsis", () => {
    const long = detail();
    long.item.location = "Füllinsdorf, Basel-Landschaft, Schweiz";
    const seo = eventSeo(long, "https://outage.ch");
    expect(seo.title).toBe("Unterbruch Füllinsdorf, 2. Aug. 2026 | outage.ch");
    expect(seo.title).not.toContain("…");
  });

  it("strips status prose from polluted location labels before SEO copy", () => {
    const polluted = detail();
    polluted.item.location = "Behobener Stromausfall in Seewen";
    polluted.item.nature = "unplanned";
    polluted.item.status = "resolved";
    const seo = eventSeo(polluted, "http://outage.ch");
    expect(seo.canonical.startsWith("https://")).toBe(true);
    expect(seo.title).toContain("Seewen");
    expect(seo.title).not.toContain("Behobener");
    expect(renderEventSeoMarkup(polluted)).toContain("<h1>Stromausfall in Seewen</h1>");
  });

  it("renders useful location-specific copy without client JavaScript", () => {
    const html = renderEventSeoMarkup(detail());
    expect(html).toContain("<h1>Geplanter Stromunterbruch in Zürich</h1>");
    expect(html).toContain("Wartungsarbeiten");
    expect(html).toContain("Kreis 4");
    expect(html).toContain("Quellen und gemeldete Inhalte");
    expect(html).toContain("Wegen Wartungsarbeiten wird die Versorgung");
    expect(html).toContain("Häufige Fragen zu diesem Vorfall");
    expect(html).toContain("/ratgeber/stromausfall-was-tun/");
  });

  it("keeps the reported compound location while using a shorter map query", () => {
    const compound = detail();
    compound.item.location = "in Lufingen und Winkel";
    compound.map = {
      query: "Lufingen",
      label: "Lufingen (ZH)",
      latitude: 47.4818,
      longitude: 8.5948,
      precision: "municipality",
      provider: "geo.admin.ch"
    };

    const seo = eventSeo(compound, "https://outage.ch");
    expect(seo.title).toContain("Lufingen und Winkel");
    expect(renderEventSeoMarkup(compound)).toContain("in Lufingen und Winkel</h1>");
    expect(renderEventSeoMarkup(compound)).not.toContain("in in Lufingen");
  });

  it("renders a useful fallback while the interactive map is unavailable", () => {
    const mapped = detail();
    mapped.map = {
      query: "Zürich",
      label: "Zürich (ZH)",
      latitude: 47.3769,
      longitude: 8.5417,
      precision: "municipality",
      provider: "geo.admin.ch"
    };

    const html = renderEventSeoMarkup(mapped);
    expect(html).toContain("map-loading");
    expect(html).toContain("map-fallback");
    expect(html).toContain("Zürich (ZH)");
    expect(html).toContain("Karte wird geladen");
  });

  it("puts the reported start and latest confirmation ahead of the detail title without inventing a duration", () => {
    const active = detail();
    active.item.status = "active";
    active.item.started_at = "2026-07-29T06:00:00.000Z";
    active.item.resolved_at = null;
    active.item.duration_minutes = null;
    active.item.active_since_at = "2026-07-29T06:00:00.000Z";
    active.item.active_since_is_minimum = false;
    active.item.last_confirmed_active_at = "2026-07-29T09:00:00.000Z";

    const html = renderEventSeoMarkup(active);
    expect(html).toContain("hero-statusline");
    expect(html).toContain("Noch aktiv · Beginn gemeldet");
    expect(html).toContain("zuletzt bestätigt");
    expect(html).not.toContain("<dt>Dauer</dt>");
    expect(html.indexOf("hero-statusline")).toBeLessThan(html.indexOf("<h1>"));
  });

  it("distinguishes a reported resolution from an exact restoration time", () => {
    const resolved = detail();
    resolved.item.status = "resolved";
    resolved.item.resolved_at = null;
    resolved.item.duration_minutes = null;
    resolved.item.cause = null;
    resolved.item.affected_area = null;
    resolved.item.summary = "Ein Gewitter verursachte den Ausfall.";

    const html = renderEventSeoMarkup(resolved);
    expect(html).toContain("Behoben gemeldet · Zeitpunkt unbekannt");
    expect(html).toContain("<span>Gemeldet</span><h3>Betroffenes Gebiet</h3>");
    expect(html).toContain("Der genaue Zeitpunkt ist nicht öffentlich bestätigt.");
    expect(html).not.toContain("Ein Gewitter verursachte den Ausfall.");
  });

  it("labels a 24-hour fallback closure without claiming restoration or duration", () => {
    const closed = detail();
    closed.item.status = "resolved";
    closed.item.resolved_at = null;
    closed.item.duration_minutes = null;
    closed.item.time_confidence = "inferred";
    closed.item.last_confirmed_active_at = "2026-07-29T09:00:00.000Z";

    const html = renderEventSeoMarkup(closed);
    expect(html).toContain("Automatisch abgeschlossen");
    expect(html).toContain("Dauer unbekannt");
    expect(html).toContain("Ende / Wiederherstellung</h3><p>Nicht bekannt");
    expect(html).not.toContain("Behoben gemeldet · Zeitpunkt unbekannt");
    expect(html).not.toContain("<dt>Dauer</dt>");
  });

  it("links matching operators to their profile page", () => {
    const withOperator = detail();
    withOperator.operator = {
      name: "ewz",
      role: "Netzbetreiber",
      area: "Stadt Zürich",
      url: "https://www.ewz.ch/de/services/stoerungen.html",
      domain: "ewz.ch"
    };
    const html = renderEventSeoMarkup(withOperator);
    expect(html).toContain("/netzbetreiber/ewz/");
    expect(html).toContain("Profil auf outage.ch");
  });

  it("exposes crawlable homepage answers without hiding them from extractors", () => {
    const html = renderHomeFeedLinks([]);
    expect(html).not.toContain("aria-hidden");
    expect(html).toContain("Was outage.ch zeigt");
    expect(html).toContain("/netzbetreiber/");
    expect(html).toContain("Ist outage.ch ein offizieller Störungsdienst?");
  });
});
