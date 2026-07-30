import { describe, expect, it } from "vitest";
import { buildPublicEventDetail, choosePublicLocation, publicLocationQuery } from "../src/public-detail";
import type { OutageEvent, OutageFact, OutageSource, PublicFeedItem } from "../src/types";

describe("public event detail", () => {
  it("reduces compound incident labels to a geocodable municipality", () => {
    expect(publicLocationQuery("Bettwil, Region Oberfreiamt, Schweiz")).toBe("Bettwil");
    expect(publicLocationQuery("Feuerschaugemeinde, Appenzell")).toBe("Appenzell");
  });

  it("uses the first concrete municipality for a compound location map query", () => {
    expect(publicLocationQuery("Lufingen und Winkel")).toBe("Lufingen");
  });

  it("chooses the official Swiss municipality for a prefixed incident location", () => {
    const location = choosePublicLocation("in Lostorf", [
      {
        id: 860,
        weight: 100,
        attrs: {
          detail: "lostorf so",
          label: "<b>Lostorf (SO)</b>",
          lat: 47.3895874,
          lon: 7.9314265,
          origin: "gg25",
          rank: 2
        }
      },
      {
        id: 44135,
        weight: 100,
        attrs: {
          detail: "lostorf giesshuebel 300m lostorf",
          label: "<i>Gebaeude</i> <b>Lostorf Giesshübel 300m</b> (SO)",
          lat: 47.3876572,
          lon: 7.9555287,
          origin: "gazetteer",
          rank: 6
        }
      }
    ]);

    expect(location).toEqual({
      query: "Lostorf",
      label: "Lostorf (SO)",
      latitude: 47.3895874,
      longitude: 7.9314265,
      precision: "municipality",
      provider: "geo.admin.ch"
    });
  });

  it("builds a rich detail using only concrete public facts", () => {
    const item = {
      id: 56,
      location: "Lostorf",
      canton: "SO",
      url: "/stromausfall/lostorf-56",
      received_at: "2026-07-15T11:30:30.337Z",
      started_at: null,
      resolved_at: null,
      status: null,
      nature: "unplanned",
      duration_minutes: null,
      cause: null,
      affected_area: null,
      updated_at: "2026-07-15T11:30:30.337Z",
      summary: "Stromausfall in Lostorf (Froburgstrasse)",
      trust: "official",
      source: {
        publisher: "Primeo Energie",
        url: "https://www.primeo-energie.ch/en/netzstatus.html",
        domain: "primeo-energie.ch"
      }
    } satisfies PublicFeedItem;
    const event = {
      id: 56,
      outage_nature: "unplanned",
      cause_text: null,
      cause_category: "unknown"
    } as OutageEvent;
    const facts = [
      {
        fact_type: "start_time",
        value_text: "2026-07-16T06:00:35.000Z",
        confidence: 0.82,
        outage_source_id: 97
      },
      { fact_type: "planned_nature", value_text: "unplanned", confidence: 0.78, outage_source_id: 97 },
      { fact_type: "cause", value_text: "unknown", confidence: 0.99, outage_source_id: 97 }
    ] as OutageFact[];
    const sources = [{
      id: 97,
      outage_event_id: 56,
      source_url: item.source.url,
      source_title: "Stromausfall in Lostorf (Froburgstrasse)",
      source_name: "Primeo Energie",
      source_kind: "operator",
      is_official: 1,
      is_primary: 1
    }] as OutageSource[];

    const detail = buildPublicEventDetail({
      item,
      event,
      facts,
      sources,
      location: {
        query: "Lostorf",
        label: "Lostorf (SO)",
        latitude: 47.3895874,
        longitude: 7.9314265,
        precision: "municipality",
        provider: "geo.admin.ch"
      },
      operator: {
        name: "Primeo Energie",
        role: "Netzbetreiber",
        area: "Primeo Netzgebiet Nordwestschweiz",
        url: item.source.url,
        domain: "primeo-energie.ch"
      }
    });

    expect(detail.facts).toEqual([
      { key: "start_time", label: "Beginn", value: "2026-07-16T06:00:35.000Z", format: "datetime" },
      { key: "nature", label: "Art", value: "Ungeplant", format: "text" }
    ]);
    expect(detail.facts.some((fact) => fact.value.toLowerCase().includes("unknown"))).toBe(false);
    expect(detail.operator?.name).toBe("Primeo Energie");
    expect(detail.sources).toEqual([
      {
        publisher: "Primeo Energie",
        url: item.source.url,
        domain: "primeo-energie.ch",
        role: "operator"
      }
    ]);
    expect(detail.timeline.map((entry) => entry.key)).toEqual(["received_at", "start_time"]);
  });

  it("keeps a sparse media report concise instead of rendering empty detail fields", () => {
    const item = {
      id: 50,
      location: "Winterthur",
      canton: "ZH",
      url: "/stromausfall/winterthur-50",
      received_at: "2026-07-14T08:10:00.000Z",
      started_at: null,
      resolved_at: null,
      status: null,
      nature: "unknown",
      duration_minutes: null,
      cause: null,
      affected_area: null,
      updated_at: "2026-07-14T08:10:00.000Z",
      summary: "Hinweis auf einen Stromausfall in Winterthur",
      trust: "reported",
      source: {
        publisher: "Nau",
        url: "https://www.nau.ch/news/schweiz/stromausfall-in-winterthur-67000000",
        domain: "nau.ch"
      }
    } satisfies PublicFeedItem;

    const detail = buildPublicEventDetail({
      item,
      event: {
        id: 50,
        outage_nature: "unknown",
        cause_text: "unklar",
        cause_category: "unknown"
      } as unknown as OutageEvent,
      facts: [{ fact_type: "cause", value_text: "unknown", confidence: 0.96 }] as OutageFact[],
      sources: [],
      location: null,
      operator: null
    });

    expect(detail.facts).toEqual([]);
    expect(detail.operator).toBeNull();
    expect(detail.timeline).toHaveLength(1);
    expect(detail.sources).toEqual([{ ...item.source, role: "media" }]);
  });

  it("does not fall back to event guesses and keeps every concrete fact", () => {
    const item = {
      id: 61,
      location: "Bettwil",
      canton: "AG",
      url: "/stromausfall/bettwil-61",
      received_at: "2026-07-15T12:00:00.000Z",
      started_at: null,
      resolved_at: null,
      status: "resolved",
      nature: "planned",
      duration_minutes: 60,
      cause: "Defektes Kabel",
      affected_area: "Dorfzentrum",
      updated_at: "2026-07-15T12:00:00.000Z",
      summary: "Stromausfall in Bettwil",
      trust: "official",
      source: {
        publisher: "AEW Energie AG",
        url: "https://www.aew.ch/netzstatus",
        domain: "aew.ch"
      }
    } satisfies PublicFeedItem;
    const facts = [
      { fact_type: "start_time", value_text: "2026-07-15T10:00:00.000Z", confidence: 0.9 },
      { fact_type: "end_time", value_text: "2026-07-15T11:00:00.000Z", confidence: 0.9 },
      { fact_type: "planned_nature", value_text: "planned", confidence: 0.9 },
      { fact_type: "status", value_text: "resolved", confidence: 0.9 },
      { fact_type: "affected_area", value_text: "Dorfzentrum", confidence: 0.9 },
      { fact_type: "cause", value_text: "Defektes Kabel", confidence: 0.9 }
    ] as OutageFact[];

    const detail = buildPublicEventDetail({
      item,
      event: {
        id: 61,
        outage_nature: "unplanned",
        cause_text: "AI-Vermutung",
        cause_category: "technical"
      } as unknown as OutageEvent,
      facts,
      sources: [],
      location: null,
      operator: null
    });

    expect(detail.facts).toHaveLength(7);
    expect(detail.facts).toContainEqual({ key: "duration", label: "Dauer", value: "1 Std.", format: "text" });
    expect(detail.facts.map((fact) => fact.value)).not.toContain("AI-Vermutung");
    expect(detail.sources[0]?.role).toBe("operator");
    expect(detail.timeline.map((entry) => entry.key)).toEqual(["start_time", "end_time", "received_at"]);
  });
});
