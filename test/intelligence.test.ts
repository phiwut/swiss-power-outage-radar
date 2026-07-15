import { describe, expect, it } from "vitest";
import {
  buildFactSheet,
  classifySource,
  decideNewEventMail,
  decideUpdateMail,
  mergeHeuristicScore,
  scoreEvent
} from "../src/intelligence";
import type { OutageEvent, OutageSource } from "../src/types";

function event(patch: Partial<OutageEvent> = {}): OutageEvent {
  return {
    id: 1,
    title: "Möglicher Stromausfall / Netzunterbruch: Belp",
    status: "needs_review",
    event_type: "power_outage",
    location_text: "Belp",
    normalized_location: "belp",
    canton: null,
    country: "CH",
    first_seen_at: "2026-07-01T09:00:00.000Z",
    last_seen_at: "2026-07-01T09:30:00.000Z",
    started_at_estimate: null,
    resolved_at_estimate: null,
    summary: "In Belp wurde ein Stromausfall gemeldet.",
    reason: "Konkrete lokale Meldung.",
    confidence: 0.96,
    source_count: 1,
    primary_source_url: "https://example.ch/belp",
    primary_source_title: "Stromausfall in Belp",
    email_sent: 0,
    email_sent_at: null,
    update_email_sent_at: null,
    merged_into_event_id: null,
    admin_note: null,
    outage_nature: "unknown",
    cause_category: "unknown",
    cause_text: null,
    research_status: "not_started",
    research_started_at: null,
    research_finished_at: null,
    research_summary_de: null,
    fact_confidence: null,
    event_score: null,
    evidence_level: null,
    fact_sheet_json: null,
    fact_sheet_updated_at: null,
    auto_research_started_at: null,
    mail_decision_reason: null,
    public_status: "hidden",
    verification_level: "auto_analyzed",
    location_granularity: "municipality",
    event_quality_state: "candidate_only",
    created_at: "2026-07-01 09:00:00",
    updated_at: "2026-07-01 09:00:00",
    ...patch
  };
}

function source(patch: Partial<OutageSource> = {}): OutageSource {
  const intelligence = classifySource({
    url: patch.source_url ?? "https://www.neo1.ch/artikel/stromausfall-in-teilen-von-belp",
    title: patch.source_title ?? "Stromausfall in Teilen von Belp",
    sourceName: patch.source_name ?? "neo1"
  });
  return {
    id: 1,
    outage_event_id: 1,
    alert_item_id: 1,
    source_url: "https://www.neo1.ch/artikel/stromausfall-in-teilen-von-belp",
    source_title: "Stromausfall in Teilen von Belp",
    source_name: "neo1",
    published_at: "2026-07-01T09:00:00.000Z",
    relation_score: 100,
    is_primary: 1,
    created_at: "2026-07-01 09:00:00",
    source_kind: intelligence.source_kind,
    source_weight: intelligence.source_weight,
    is_official: intelligence.is_official,
    independence_key: intelligence.independence_key,
    ...patch
  };
}

describe("event intelligence", () => {
  it("never infers official authority from broad words in a host or title", () => {
    const selectra = classifySource({
      url: "https://www.google.com/url?url=https%3A%2F%2Fselectraenergie.ch%2Ffr%2Fpanne-de-courant%2Fvaud",
      title: "Panne de courant - Selectra Energie",
      sourceName: "Google Alerts"
    });
    const news = classifySource({
      url: "https://www.nau.ch/news/schweiz/stadtwerk-winterthur-kappte-strom-67147465",
      title: "Stadtwerk Winterthur kappte Strom",
      sourceName: "Nau.ch"
    });

    expect(selectra.is_official).toBe(0);
    expect(selectra.independence_key).toBe("selectraenergie.ch");
    expect(news.is_official).toBe(0);
    expect(news.source_kind).toBe("local_media");
  });

  it("caps high AI confidence for a single non-official source", () => {
    const scored = scoreEvent(event({ confidence: 0.99 }), [source()]);

    expect(scored.event_score).toBeLessThanOrEqual(75);
    expect(scored.evidence_level).not.toBe("official");
  });

  it("raises score and evidence for official sources", () => {
    const official = source({
      source_url: "https://www.ai.ch/feuerschaugemeinde/news/stoerung",
      source_title: "Kanton Appenzell: Stromausfall",
      source_name: "Kanton Appenzell Innerrhoden",
      ...classifySource({
        url: "https://www.ai.ch/feuerschaugemeinde/news/stoerung",
        title: "Kanton Appenzell: Stromausfall",
        sourceName: "Kanton Appenzell Innerrhoden"
      })
    });

    const scored = scoreEvent(event(), [official]);

    expect(scored.event_score).toBeGreaterThanOrEqual(70);
    expect(scored.evidence_level).toBe("official");
    expect(decideNewEventMail({ ...event(), event_score: scored.event_score, evidence_level: scored.evidence_level }, [official]).send).toBe(true);
  });

  it("counts independent sources but not duplicate media as strong corroboration", () => {
    const first = source({ independence_key: "neo1.ch" });
    const duplicate = source({ id: 2, alert_item_id: 2, source_url: "https://www.neo1.ch/zweiter-artikel", independence_key: "neo1.ch" });
    const independent = source({
      id: 3,
      alert_item_id: 3,
      source_url: "https://www.baernerbaer.ch/belp-stromausfall",
      source_name: "BärnerBär",
      independence_key: "baernerbaer.ch"
    });

    const duplicateScore = scoreEvent(event({ source_count: 2 }), [first, duplicate]);
    const independentScore = scoreEvent(event({ source_count: 2 }), [first, independent]);

    expect(independentScore.event_score).toBeGreaterThan(duplicateScore.event_score);
    expect(independentScore.evidence_level).toBe("corroborated");
  });

  it("creates merge suggestions only for close location and time matches", () => {
    const base = event({ id: 1, location_text: "Belp", normalized_location: "belp" });
    const close = event({ id: 2, location_text: "Belp, Bern", normalized_location: "belp bern", first_seen_at: "2026-07-01T10:00:00.000Z" });
    const far = event({ id: 3, location_text: "Marly", normalized_location: "marly", first_seen_at: "2026-06-20T10:00:00.000Z" });

    expect(mergeHeuristicScore(base, close)).toBeGreaterThanOrEqual(60);
    expect(mergeHeuristicScore(base, far)).toBeLessThan(60);
  });

  it("holds weak event mail and sends improved update mail", () => {
    const weakEvent = event({ event_score: 62, evidence_level: "weak" });
    expect(decideNewEventMail(weakEvent, [source()]).send).toBe(false);

    const mailed = event({
      event_score: 82,
      evidence_level: "corroborated",
      email_sent_at: "2026-07-01T08:00:00.000Z",
      fact_confidence: 0.7
    });
    expect(decideUpdateMail(mailed, [source({ independence_key: "neo1.ch" }), source({ id: 2, alert_item_id: 2, independence_key: "baernerbaer.ch" })], "2026-07-01T09:00:00.000Z").send).toBe(true);
  });

  it("builds a fact sheet from multiple sources", () => {
    const sheet = buildFactSheet(event(), [source(), source({ id: 2, alert_item_id: 2, independence_key: "gemeinde-belp.ch", is_official: 1 })], []);

    expect(sheet.location).toBe("Belp");
    expect(sheet.source_count).toBe(2);
    expect(sheet.confirmed_facts.join(" ")).toContain("2 unabhängige Quellen");
  });
});
