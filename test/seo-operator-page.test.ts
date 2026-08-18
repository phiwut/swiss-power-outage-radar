import { describe, expect, it } from "vitest";
import { operatorBySlug, summarizeOperatorEvents } from "../src/operators";
import {
  operatorLiveTitle,
  operatorPageJsonLd,
  parseOperatorPath,
  renderElcomFactsSection,
  renderOperatorHubLive,
  renderOperatorLiveSection
} from "../src/seo-operator-page";
import type { PublicFeedItem } from "../src/types";

function item(overrides: Partial<PublicFeedItem> = {}): PublicFeedItem {
  return {
    id: 18,
    location: "Thun",
    canton: null,
    url: "/stromausfall/thun-18",
    received_at: "2026-08-01T10:00:00.000Z",
    started_at: "2026-08-01T10:00:00.000Z",
    resolved_at: null,
    status: "active",
    nature: "unplanned",
    duration_minutes: null,
    cause: null,
    affected_area: null,
    updated_at: "2026-08-01T11:00:00.000Z",
    summary: "Unterbruch in Thun.",
    trust: "official",
    source: { publisher: "BKW", url: "https://outage.bkw.ch/", domain: "outage.bkw.ch" },
    ...overrides
  };
}

describe("operator live SEO pages", () => {
  it("parses hub and profile paths", () => {
    expect(parseOperatorPath("/netzbetreiber/")).toEqual({ hub: true });
    expect(parseOperatorPath("/netzbetreiber/bkw/")).toEqual({ hub: false, slug: "bkw" });
    expect(parseOperatorPath("/ratgeber/bkw/")).toBeNull();
  });

  it("renders unique radar stats instead of a swapped template", () => {
    const profile = operatorBySlug("bkw")!;
    const html = renderOperatorLiveSection({
      profile,
      stats: summarizeOperatorEvents([item(), item({ id: 19, location: "Biel", url: "/stromausfall/biel-19", status: "upcoming", nature: "planned" })]),
      recent: [item()]
    });
    expect(html).toContain("Öffentliche Meldungen");
    expect(html).toContain("Thun");
    expect(html).toContain("/stromausfall/thun-18");
    expect(html).toContain("nicht die komplette Betriebsstatistik");
    expect(operatorLiveTitle(profile, summarizeOperatorEvents([item()]))).toContain("BKW");
    expect(operatorLiveTitle(profile, summarizeOperatorEvents([item()]))).toContain("1 Meldung");
  });

  it("sorts the hub by live counts and keeps empty operators visible", () => {
    const live = renderOperatorHubLive([item(), item({ id: 20, location: "Sion", url: "/stromausfall/sion-20", source: { publisher: "Romande Energie", url: "https://www.romande-energie.ch/infos-pannes", domain: "romande-energie.ch" } })]);
    expect(live.summary).toContain("2 öffentliche Meldungen");
    expect(live.list.indexOf("BKW")).toBeLessThan(live.list.indexOf("ewz"));
    expect(live.list).toContain("data-operator-slug=\"ewz\"");
    expect(live.list).toContain("/netzbetreiber/ewz/");
  });

  it("adds ElCom H4 facts without presenting them as a household bill", () => {
    const profile = operatorBySlug("ewz")!;
    const html = renderElcomFactsSection(profile);
    expect(html).toContain("ElCom-Kennzahlen");
    expect(html).toContain("H4");
    expect(html).toContain("kein individueller Rechnungsbetrag");
    expect(html).toContain("strompreis.elcom.admin.ch");
    expect(operatorPageJsonLd(profile, summarizeOperatorEvents([]))).toContain("ElCom H4-Strompreis");
    expect(renderElcomFactsSection(operatorBySlug("ewl-luzern")!)).toBe("");
  });
});
