import { describe, expect, it } from "vitest";
import { evaluatePublicEvent, parsePublicFeedCursor, publicFeedCursor, toPublicFeedItem } from "../src/publication";
import type { OutageEvent, OutageFact, OutageSource } from "../src/types";

function event(patch: Partial<OutageEvent> = {}): OutageEvent {
  return {
    id: 7,
    title: "Stromausfall in Appenzell",
    status: "needs_review",
    event_type: "power_outage",
    location_text: "Appenzell",
    normalized_location: "appenzell",
    canton: "AI",
    country: "CH",
    first_seen_at: "2026-07-14T11:24:59.000Z",
    last_seen_at: "2026-07-14T11:24:59.000Z",
    received_at: "2026-07-15T06:47:32.000Z",
    started_at_estimate: null,
    resolved_at_estimate: null,
    summary: "In Appenzell wurde ein Stromunterbruch gemeldet.",
    reason: "Konkrete lokale Meldung.",
    confidence: 0.95,
    source_count: 1,
    primary_source_url: "https://www.google.com/url?url=https%3A%2F%2Fwww.ai.ch%2Ffeuerschaugemeinde%2Fnews%2Fstoerung",
    primary_source_title: "Störung Stromversorgung Appenzell",
    email_sent: 0,
    email_sent_at: null,
    update_email_sent_at: null,
    merged_into_event_id: null,
    admin_note: null,
    outage_nature: "unplanned",
    cause_category: "unknown",
    cause_text: null,
    research_status: "not_started",
    research_started_at: null,
    research_finished_at: null,
    research_summary_de: null,
    fact_confidence: null,
    event_score: 80,
    evidence_level: "official",
    fact_sheet_json: null,
    fact_sheet_updated_at: null,
    auto_research_started_at: null,
    mail_decision_reason: null,
    public_status: "hidden",
    verification_level: "auto_analyzed",
    location_granularity: "municipality",
    event_quality_state: "candidate_only",
    created_at: "2026-07-15 06:47:32",
    updated_at: "2026-07-15 06:48:10",
    ...patch
  };
}

function source(patch: Partial<OutageSource> = {}): OutageSource {
  return {
    id: 3,
    outage_event_id: 7,
    alert_item_id: 11,
    source_url: "https://www.google.com/url?url=https%3A%2F%2Fwww.ai.ch%2Ffeuerschaugemeinde%2Fnews%2Fstoerung",
    source_title: "Störung Stromversorgung Appenzell",
    source_name: "Kanton Appenzell Innerrhoden",
    published_at: "2026-07-14T11:24:59.000Z",
    relation_score: 100,
    is_primary: 1,
    source_kind: "official",
    source_weight: 1,
    is_official: 1,
    independence_key: "ai.ch",
    source_registry_id: null,
    source_observation_id: null,
    created_at: "2026-07-15 06:47:32",
    ...patch
  };
}

function outageFact(patch: Partial<OutageFact> = {}): OutageFact {
  return {
    id: 5,
    candidate_id: 2,
    outage_event_id: 7,
    outage_source_id: 3,
    snapshot_id: 4,
    fact_type: "outage_happened",
    value_text: "true",
    value_json: null,
    confidence: 0.92,
    evidence_excerpt: "In Appenzell wurde ein Stromunterbruch gemeldet.",
    source_role: "official",
    verified_by: "official_source",
    created_at: "2026-07-15 06:47:32",
    ...patch
  };
}

describe("public event publication", () => {
  it("rejects an operator coverage area even when legacy granularity says municipality", () => {
    const decision = evaluatePublicEvent(
      event({
        location_text: "Romande Energie Netzgebiet in der Westschweiz",
        normalized_location: "romande energie netzgebiet in der westschweiz",
        location_granularity: "municipality"
      }),
      [source({
        source_url: "https://www.romande-energie.ch/infos-pannes",
        source_name: "Romande Energie",
        independence_key: "romande-energie.ch",
        is_official: 1
      })],
      [outageFact({ fact_type: "planned_outage_notice", value_text: "true" })],
      { authorityHosts: new Set(["romande-energie.ch"]) }
    );

    expect(decision.publishable).toBe(false);
    expect(decision.reasons).toContain("no_concrete_swiss_location");
  });

  it("keeps a specifically named local region while rejecting generic coverage areas", () => {
    const decision = evaluatePublicEvent(
      event({
        location_text: "Nordosten von Wohlen",
        normalized_location: "nordosten von wohlen",
        location_granularity: "region"
      }),
      [source()],
      [outageFact()],
      { authorityHosts: new Set(["ai.ch"]) }
    );

    expect(decision.publishable).toBe(true);
  });

  it.each(["Grossraum Zürich", "Region Zürich", "Gebiet", "Umgebung"])(
    "rejects the diffuse region label %s without a specific affected place",
    (location) => {
      const decision = evaluatePublicEvent(
        event({ location_text: location, location_granularity: "region" }),
        [source()],
        [outageFact()],
        { authorityHosts: new Set(["ai.ch"]) }
      );

      expect(decision.publishable).toBe(false);
      expect(decision.reasons).toContain("no_concrete_swiss_location");
    }
  );

  it("publishes a concrete evidenced outage from an exact verified authority host", () => {
    const decision = evaluatePublicEvent(event(), [source()], [outageFact()], {
      authorityHosts: new Set(["ai.ch"])
    });

    expect(decision.publishable).toBe(true);
    expect(decision.trust).toBe("official");
    expect(decision.primary_source?.domain).toBe("ai.ch");
    expect(decision.primary_source?.url).toBe("https://www.ai.ch/feuerschaugemeinde/news/stoerung");
  });

  it("keeps legacy evidence when its candidate alert matches the event source", () => {
    const decision = evaluatePublicEvent(
      event(),
      [source({ alert_item_id: 11 })],
      [outageFact({ outage_source_id: null, alert_item_id: 11 })],
      { authorityHosts: new Set(["ai.ch"]) }
    );

    expect(decision.publishable).toBe(true);
    expect(decision.trust).toBe("official");
  });

  it("does not grant official trust when the authority registry disables the host", () => {
    const decision = evaluatePublicEvent(event(), [source()], [outageFact()], {
      authorityHosts: new Set()
    });
    expect(decision.publishable).toBe(false);
    expect(decision.reasons).toContain("insufficient_source_authority");
  });

  it("accepts a newly maintained authority host without a compile-time classifier entry", () => {
    const maintained = source({
      source_url: "https://netz.example.ch/stoerung/42",
      source_name: "Neuer Netzbetreiber",
      source_kind: "other",
      is_official: 0,
      independence_key: "netz.example.ch"
    });
    const decision = evaluatePublicEvent(
      event(),
      [maintained],
      [outageFact({ outage_source_id: maintained.id })],
      { authorityHosts: new Set(["netz.example.ch"]) }
    );
    expect(decision.publishable).toBe(true);
    expect(decision.trust).toBe("official");
  });

  it("rejects negative status pages and generic locations", () => {
    const decision = evaluatePublicEvent(
      event({ location_text: "Schweiz", location_granularity: "country" }),
      [source()],
      [outageFact({ evidence_excerpt: "Aktuell bestehen keine Stromausfälle in der Schweiz." })]
    );

    expect(decision.publishable).toBe(false);
    expect(decision.reasons).toContain("no_concrete_swiss_location");
    expect(decision.reasons).toContain("no_positive_outage_evidence");
  });

  it("never treats an aggregator or market article as an authority", () => {
    const decision = evaluatePublicEvent(
      event({ summary: "Ein Marktbericht zur Energieversorgung." }),
      [
        source({
          source_url: "https://selectraenergie.ch/de/energie/stromausfall",
          source_name: "Selectra Energie",
          source_title: "Was tun bei einem Stromausfall?",
          is_official: 1,
          source_kind: "official"
        })
      ],
      [outageFact()]
    );

    expect(decision.publishable).toBe(false);
    expect(decision.reasons).toContain("insufficient_source_authority");
  });

  it("rejects historical reports and contradictory high-confidence facts", () => {
    const historical = evaluatePublicEvent(
      event({ summary: "Rückblick auf den Stromausfall im Jahr 2024." }),
      [source()],
      [outageFact({ evidence_excerpt: "Historischer Rückblick auf den Stromausfall im Jahr 2024." })]
    );
    const contradictory = evaluatePublicEvent(
      event(),
      [source()],
      [
        outageFact(),
        outageFact({ id: 6, fact_type: "cause", value_text: "Kabelschaden" }),
        outageFact({ id: 7, fact_type: "cause", value_text: "Baum auf Freileitung" })
      ]
    );

    expect(historical.publishable).toBe(false);
    expect(historical.reasons).toContain("no_positive_outage_evidence");
    expect(contradictory.publishable).toBe(false);
    expect(contradictory.reasons).toContain("contradictory_evidence");
  });

  it("rejects French and Italian advice or retrospective articles", () => {
    const media = source({
      source_url: "https://www.lejdj.ch/articles/retour-panne",
      source_name: "Le Journal du Jura",
      source_kind: "local_media",
      is_official: 0
    });
    const french = evaluatePublicEvent(
      event({ summary: "Retour sur la panne de courant de 2024." }),
      [media],
      [outageFact({ outage_source_id: media.id, evidence_excerpt: "Retour sur la panne de courant de 2024." })]
    );
    const italian = evaluatePublicEvent(
      event({ summary: "Guida: cosa fare in caso di blackout." }),
      [media],
      [outageFact({ outage_source_id: media.id, evidence_excerpt: "Guida: cosa fare in caso di blackout." })]
    );

    expect(french.publishable).toBe(false);
    expect(french.reasons).toContain("no_positive_outage_evidence");
    expect(italian.publishable).toBe(false);
    expect(italian.reasons).toContain("no_positive_outage_evidence");
  });

  it("removes sentences that only list unknown cause or status", () => {
    const decision = evaluatePublicEvent(
      event({
        summary: "In Wohlen wurde ein Stromausfall gemeldet. Die genaue Ursache und der aktuelle Status sind unklar. Die Angaben sind unklar und nicht bestätigt."
      }),
      [source()],
      [outageFact()],
      { authorityHosts: new Set(["ai.ch"]) }
    );

    expect(decision.publishable).toBe(true);
    expect(decision.summary).toBe("In Wohlen wurde ein Stromausfall gemeldet.");
  });

  it("distinguishes one media report from two independent publishers", () => {
    const neo = source({
      source_url: "https://neo1.ch/news/stromausfall-appenzell",
      source_name: "neo1",
      source_kind: "local_media",
      is_official: 0
    });
    const duplicate = source({
      id: 4,
      source_url: "https://neo1.ch/news/update-stromausfall-appenzell",
      source_name: "neo1",
      source_kind: "local_media",
      is_official: 0
    });
    const secondPublisher = source({
      id: 5,
      source_url: "https://www.tagblatt.ch/ostschweiz/stromausfall-appenzell",
      source_name: "St. Galler Tagblatt",
      source_kind: "local_media",
      is_official: 0
    });

    const singlyReported = evaluatePublicEvent(event(), [neo, duplicate], [outageFact()]);
    expect(singlyReported.publishable).toBe(true);
    expect(singlyReported.trust).toBe("reported");
    const corroborated = evaluatePublicEvent(event(), [neo, secondPublisher], [
      outageFact({ outage_source_id: neo.id }),
      outageFact({ id: 8, outage_source_id: secondPublisher.id })
    ]);
    expect(corroborated.publishable).toBe(true);
    expect(corroborated.trust).toBe("corroborated");
  });

  it("shows a concrete outage reported by one established local publisher", () => {
    const localReport = source({
      source_url: "https://www.radiomunot.ch/p/Stromausfall-im-Breite-Quartier",
      source_name: "Radio Munot",
      source_kind: "other",
      is_official: 0,
      independence_key: "radiomunot.ch"
    });
    const decision = evaluatePublicEvent(
      event({ location_text: "Breite-Quartier, Schaffhausen" }),
      [localReport],
      [outageFact({ outage_source_id: localReport.id })]
    );

    expect(decision.publishable).toBe(true);
    expect(decision.trust).toBe("reported");
  });

  it("rejects a one-source media story that only mentions an outage incidentally", () => {
    const fireStory = source({
      source_url: "https://www.blick.ch/fr/suisse/valais-incendie-entreprise-id22084540.html",
      source_title: "Valais: Pompiers mobilisés par l'incendie d'une entreprise",
      source_name: "Blick",
      source_kind: "national_media",
      is_official: 0
    });
    const decision = evaluatePublicEvent(
      event({ location_text: "Monthey, VS" }),
      [fireStory],
      [outageFact({ outage_source_id: fireStory.id, evidence_excerpt: "Coupure de courant." })]
    );

    expect(decision.publishable).toBe(false);
    expect(decision.reasons).toContain("insufficient_source_authority");
  });

  it("exposes only the compact public feed contract", () => {
    const outageEvent = event();
    const decision = evaluatePublicEvent(outageEvent, [source()], [outageFact()]);
    const item = toPublicFeedItem(outageEvent, decision);

    expect(item).not.toBeNull();
    expect(Object.keys(item!)).toEqual([
      "id",
      "location",
      "canton",
      "url",
      "received_at",
      "started_at",
      "resolved_at",
      "status",
      "nature",
      "duration_minutes",
      "cause",
      "affected_area",
      "updated_at",
      "summary",
      "trust",
      "source"
    ]);
    expect(item).not.toHaveProperty("event_score");
    expect(item).not.toHaveProperty("event_quality_state");
    expect(item).not.toHaveProperty("unknown_metrics");
  });

  it("uses event id as a stable cursor tie-breaker for simultaneous receipts", () => {
    const cursor = publicFeedCursor({ id: 42, received_at: "2026-07-15T10:00:00.000Z" });
    expect(parsePublicFeedCursor(cursor)).toEqual({ receivedAt: "2026-07-15T10:00:00.000Z", id: 42 });
    expect(publicFeedCursor({ id: 41, received_at: "2026-07-15T10:00:00.000Z" })).not.toBe(cursor);
  });

  it("keeps a future planned interruption on its actual date", () => {
    const outageEvent = event({
      outage_nature: "planned",
      started_at_estimate: "2099-08-12T06:00:00.000Z",
      resolved_at_estimate: "2099-08-12T08:30:00.000Z"
    });
    const decision = evaluatePublicEvent(outageEvent, [source()], [outageFact({
      fact_type: "planned_outage_notice",
      value_text: "true"
    })]);
    const item = toPublicFeedItem(outageEvent, decision, [
      outageFact({ fact_type: "planned_nature", value_text: "planned", confidence: 0.95 }),
      outageFact({ fact_type: "start_time", value_text: "2099-08-12T06:00:00.000Z", confidence: 0.95 }),
      outageFact({ fact_type: "end_time", value_text: "2099-08-12T08:30:00.000Z", confidence: 0.95 })
    ]);
    expect(item?.status).toBe("upcoming");
    expect(item?.started_at).toBe("2099-08-12T06:00:00.000Z");
    expect(item?.duration_minutes).toBe(150);
  });

  it("does not present a stale unresolved report as an active outage", () => {
    const outageEvent = event({
      first_seen_at: "2025-01-01T08:00:00.000Z",
      last_seen_at: "2025-01-01T08:15:00.000Z",
      received_at: "2025-01-01T08:15:00.000Z",
      updated_at: "2025-01-01T08:20:00.000Z"
    });
    const decision = evaluatePublicEvent(outageEvent, [source()], [outageFact()]);
    const item = toPublicFeedItem(outageEvent, decision, [
      outageFact({ fact_type: "status", value_text: "active", confidence: 0.95 })
    ]);
    expect(item?.status).toBe("historical");
  });
});
