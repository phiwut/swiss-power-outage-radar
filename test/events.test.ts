import { describe, expect, it } from "vitest";
import {
  canAutoMergeLocation,
  canonicalLocation,
  canCreateEvent,
  normalizeLocation,
  scoreEventCandidate
} from "../src/events";
import type { AiClassification, OutageEvent, StoredAlertItem } from "../src/types";

const classification: AiClassification = {
  is_relevant: true,
  confidence: 0.9,
  country: "CH",
  location_text: "Wohlen",
  event_type: "power_outage",
  summary: "Stromausfall in Wohlen.",
  reason: "Konkreter lokaler Stromausfall."
};

const item = {
  id: 1,
  feed_language: "de",
  title: "Stromausfall im Nordosten - Wohler Anzeiger",
  url: "https://example.com/wohlen",
  source: "Wohler Anzeiger",
  snippet: "In Wohlen kam es zu einem Stromunterbruch.",
  published_at: "2026-06-30T08:00:00.000Z",
  fetched_at: "2026-06-30T08:05:00.000Z",
  item_hash: "abc",
  status: "classified",
  is_relevant: 1,
  confidence: 0.9,
  country: "CH",
  location_text: "Wohlen",
  event_type: "power_outage",
  summary: "Stromausfall in Wohlen.",
  reason: "Konkreter lokaler Stromausfall.",
  ai_raw: "{}",
  email_sent: 0,
  email_sent_at: null,
  outage_event_id: null,
  event_linked_at: null,
  created_at: "2026-06-30 08:05:00",
  updated_at: "2026-06-30 08:05:00"
} satisfies StoredAlertItem;

const event = {
  id: 10,
  title: "Möglicher Stromausfall / Netzunterbruch: Wohlen",
  status: "needs_review",
  event_type: "power_outage",
  location_text: "Wohlen",
  normalized_location: "wohlen",
  canton: null,
  country: "CH",
  first_seen_at: "2026-06-30T07:30:00.000Z",
  last_seen_at: "2026-06-30T08:00:00.000Z",
  started_at_estimate: null,
  resolved_at_estimate: null,
  summary: "Stromausfall in Wohlen.",
  reason: "Konkreter lokaler Stromausfall.",
  confidence: 0.85,
  source_count: 1,
  primary_source_url: "https://example.com/old",
  primary_source_title: "Alter Treffer",
  email_sent: 1,
  email_sent_at: "2026-06-30T07:35:00.000Z",
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
  created_at: "2026-06-30 07:35:00",
  updated_at: "2026-06-30 07:35:00"
} satisfies OutageEvent;

describe("event matching helpers", () => {
  it("normalizes locations deterministically", () => {
    expect(normalizeLocation(" Zürich-Nord ")).toBe("zurich nord");
    expect(normalizeLocation("")).toBe("unknown");
  });

  it("does not auto-merge generic locations", () => {
    expect(canAutoMergeLocation("wohlen")).toBe(true);
    expect(canAutoMergeLocation("schweiz")).toBe(false);
    expect(canAutoMergeLocation("unknown")).toBe(false);
  });

  it("canonicalizes administrative location variants without collapsing multi-place alerts", () => {
    expect(canonicalLocation("Gemeinde Belp")).toBe("belp");
    expect(canonicalLocation("Belp, Kanton Bern")).toBe("belp");
    expect(canonicalLocation("Belp, Bern")).toBe("belp");
    expect(canonicalLocation("Belp, Köniz, Ittigen")).toBe("belp koniz ittigen");
  });

  it("rejects low-confidence unclear events", () => {
    expect(canCreateEvent(classification)).toBe(true);
    expect(canCreateEvent({ ...classification, event_type: "unclear", confidence: 0.7 })).toBe(false);
  });

  it("scores exact-location candidates high enough to attach", () => {
    expect(scoreEventCandidate(event, item, classification, "wohlen")).toBeGreaterThanOrEqual(70);
  });
});
