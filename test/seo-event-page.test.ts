import { describe, expect, it } from "vitest";
import { eventSeo, renderEventSeoMarkup } from "../src/seo-event-page";
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
    expect(seo.title).toContain("Geplanter Stromunterbruch in Zürich");
    const graph = JSON.parse(seo.jsonLd)["@graph"];
    expect(graph.some((entry: { "@type": string }) => entry["@type"] === "Event")).toBe(true);
    expect(graph.some((entry: { "@type": string }) => entry["@type"] === "FAQPage")).toBe(true);
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
});
