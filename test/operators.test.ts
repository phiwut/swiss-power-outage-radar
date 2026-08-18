import { describe, expect, it } from "vitest";
import {
  eventMatchesOperator,
  findOperatorByDomain,
  findOperatorProfile,
  operatorBySlug,
  operatorFaqs,
  operatorLiveInsight,
  operatorProfileUrl,
  publicOperatorProfiles,
  resolveOperatorProfile,
  summarizeOperatorEvents
} from "../src/operators";
import type { PublicFeedItem } from "../src/types";

describe("operator profiles", () => {
  it("creates unique public profiles from official sources", () => {
    const profiles = publicOperatorProfiles();
    expect(profiles.length).toBeGreaterThan(20);
    expect(new Set(profiles.map((profile) => profile.slug)).size).toBe(profiles.length);
    expect(profiles.some((profile) => profile.sourceKey === "alertswiss")).toBe(false);
    expect(profiles.some((profile) => profile.slug === "ewz")).toBe(true);
    expect(profiles.some((profile) => profile.slug === "ekz")).toBe(true);
    expect(profiles.some((profile) => profile.slug === "groupe-e")).toBe(true);
    expect(profiles.some((profile) => profile.slug === "sig")).toBe(true);
    expect(profiles.some((profile) => profile.slug === "st-galler-stadtwerke")).toBe(true);
    expect(operatorProfileUrl(profiles[0]).startsWith("/netzbetreiber/")).toBe(true);
  });

  it("resolves operators by slug, name and source domain", () => {
    const ewz = operatorBySlug("ewz");
    expect(ewz?.name).toBe("ewz");
    expect(findOperatorProfile("ewz")?.slug).toBe("ewz");
    expect(findOperatorProfile("Energie Wasser Bern")?.slug).toBe("energie-wasser-bern");
    expect(findOperatorProfile(null)).toBeNull();
    expect(findOperatorByDomain("outage.bkw.ch")?.slug).toBe("bkw");
    expect(findOperatorByDomain("www.primeo-energie.ch")?.slug).toBe("primeo-energie");
    expect(resolveOperatorProfile({ name: "BKW", domain: "nau.ch" })?.slug).toBe("bkw");
    expect(resolveOperatorProfile({ name: "nau.ch", domain: "nau.ch" })).toBeNull();
  });

  it("matches public events to the operator source, not to media hosts", () => {
    const bkw = operatorBySlug("bkw");
    expect(bkw).toBeTruthy();
    expect(eventMatchesOperator({
      source: { publisher: "BKW", url: "https://outage.bkw.ch/", domain: "outage.bkw.ch" }
    }, bkw!)).toBe(true);
    expect(eventMatchesOperator({
      source: { publisher: "nau.ch", url: "https://www.nau.ch/news", domain: "nau.ch" }
    }, bkw!)).toBe(false);
  });

  it("builds radar stats without inventing restoration times", () => {
    const bkw = operatorBySlug("bkw")!;
    const items: PublicFeedItem[] = [
      {
        id: 1, location: "Thun", canton: null, url: "/stromausfall/thun-1",
        received_at: "2026-08-01T10:00:00.000Z", started_at: "2026-08-01T10:00:00.000Z",
        resolved_at: "2026-08-01T12:00:00.000Z", status: "resolved", nature: "unplanned",
        duration_minutes: 120, cause: null, affected_area: null,
        updated_at: "2026-08-01T12:05:00.000Z", summary: "Unterbruch in Thun.",
        trust: "official", source: { publisher: "BKW", url: "https://outage.bkw.ch/", domain: "outage.bkw.ch" }
      },
      {
        id: 2, location: "Biel", canton: null, url: "/stromausfall/biel-2",
        received_at: "2026-08-10T08:00:00.000Z", started_at: "2026-08-18T22:00:00.000Z",
        resolved_at: null, status: "upcoming", nature: "planned",
        duration_minutes: null, cause: "Unterhalt", affected_area: null,
        updated_at: "2026-08-10T08:00:00.000Z", summary: "Geplanter Unterbruch in Biel.",
        trust: "official", source: { publisher: "BKW", url: "https://outage.bkw.ch/", domain: "outage.bkw.ch" }
      }
    ];
    const stats = summarizeOperatorEvents(items, Date.parse("2026-08-18T10:00:00.000Z"));
    expect(stats.total).toBe(2);
    expect(stats.planned).toBe(1);
    expect(stats.unplanned).toBe(1);
    expect(stats.upcoming).toBe(1);
    expect(stats.medianDurationMinutes).toBe(120);
    expect(stats.topLocations.map((place) => place.label)).toEqual(["Biel", "Thun"]);
    const insight = operatorLiveInsight(bkw, stats);
    expect(insight).toContain("BKW");
    expect(insight).not.toContain("SAIDI");
    const faqs = operatorFaqs(bkw, stats);
    expect(faqs.some((faq) => faq.answer.includes("geplante Unterbrüche"))).toBe(true);
    expect(operatorFaqs(bkw, summarizeOperatorEvents([])).some((faq) => faq.answer.includes("keine öffentliche Meldung"))).toBe(true);
    expect(operatorFaqs(bkw).some((faq) => faq.answer.includes("H4-Standardprodukt"))).toBe(true);
    expect(operatorFaqs(operatorBySlug("ewl-luzern")!).some((faq) => faq.answer.includes("H4-Standardprodukt"))).toBe(false);
  });
});
