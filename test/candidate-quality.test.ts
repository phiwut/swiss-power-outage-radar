import { describe, expect, it } from "vitest";
import { assessCandidateEvidence } from "../src/candidate-quality";
import type { AiClassification, NormalizedRssItem, SourceSnapshot } from "../src/types";

function item(patch: Partial<NormalizedRssItem> = {}): NormalizedRssItem {
  return {
    feed_language: "de",
    title: "Stromausfall in Belp",
    url: "https://example.ch/belp",
    source: "Example",
    snippet: "In Belp kam es zu einem Stromunterbruch.",
    published_at: "2026-07-01T10:00:00.000Z",
    ...patch
  };
}

function classification(patch: Partial<AiClassification> = {}): AiClassification {
  return {
    is_relevant: true,
    confidence: 0.9,
    country: "CH",
    location_text: "Belp",
    event_type: "power_outage",
    summary: "In Belp wurde ein Stromausfall gemeldet.",
    reason: "Konkrete lokale Meldung.",
    ...patch
  };
}

function snapshot(markdownExcerpt: string): SourceSnapshot {
  return {
    id: 1,
    alert_item_id: 1,
    outage_event_id: null,
    outage_source_id: null,
    url: "https://example.ch/belp",
    final_url: "https://example.ch/belp",
    fetch_method: "mock",
    fetch_status: "success",
    http_status: 200,
    title: "Stromausfall in Belp",
    markdown_r2_key: "snapshots/test.md",
    markdown_excerpt: markdownExcerpt,
    content_hash: "abc",
    fetched_at: "2026-07-01T10:00:00.000Z",
    error: null,
    public_summary_de: null,
    public_key_points_json: null,
    public_relevance_label: null,
    public_facts_json: null,
    digest_generated_at: null,
    digest_error: null,
    created_at: "2026-07-01 10:00:00",
    updated_at: "2026-07-01 10:00:00"
  };
}

describe("candidate quality gate", () => {
  it("publishes a concrete Swiss outage only after evidence extraction", () => {
    const assessment = assessCandidateEvidence({
      item: item({ source: "Gemeinde Belp", url: "https://www.gemeinde-belp.ch/stromausfall" }),
      classification: classification(),
      snapshot: snapshot("In Belp kam es heute zu einem Stromausfall. Mehrere Haushalte sind betroffen.")
    });

    expect(assessment.publishable).toBe(true);
    expect(assessment.location_granularity).toBe("municipality");
    expect(assessment.facts.map((fact) => fact.fact_type)).toContain("outage_happened");
  });

  it("rejects foreign events carried by Swiss media", () => {
    const assessment = assessCandidateEvidence({
      item: item({
        title: "Kuba nach landesweitem Stromausfall weitgehend ohne Strom - Cash",
        source: "Cash",
        snippet: "Es ist der achte landesweite Stromausfall in Kuba."
      }),
      classification: classification({
        country: "unknown",
        location_text: "Kuba",
        summary: "Landesweiter Stromausfall in Kuba."
      }),
      snapshot: snapshot("Kuba ist nach einem landesweiten Stromausfall weitgehend ohne Strom.")
    });

    expect(assessment.publishable).toBe(false);
    expect(assessment.is_ch_incident).toBe(false);
    expect(assessment.relevance_role).toBe("foreign_event");
  });

  it("rejects classifier-marked non-Swiss incidents", () => {
    const assessment = assessCandidateEvidence({
      item: item({
        title: "Stromausfall in Como",
        source: "Grenzgebiet News",
        snippet: "In Como waren mehrere Haushalte ohne Strom."
      }),
      classification: classification({
        country: "other",
        location_text: "Como",
        summary: "Stromausfall in Como."
      }),
      snapshot: snapshot("In Como kam es zu einem Stromausfall. Mehrere Haushalte waren betroffen.")
    });

    expect(assessment.publishable).toBe(false);
    expect(assessment.is_ch_incident).toBe(false);
    expect(assessment.relevance_role).toBe("foreign_event");
  });

  it("keeps retrospective incidental mentions out of public events", () => {
    const assessment = assessCandidateEvidence({
      item: item({
        title: "Stromausfall im Januar - Expertenkommission legt Bericht vor",
        source: "MarketScreener Schweiz",
        snippet: "Eine Expertenkommission in Berlin zieht Lehren aus dem Stromausfall."
      }),
      classification: classification({
        location_text: "Berlin",
        summary: "Expertenkommission zu früherem Stromausfall."
      }),
      snapshot: snapshot("Die Expertenkommission legt einen Bericht vor und zieht Lehren aus dem Stromausfall im Januar.")
    });

    expect(assessment.publishable).toBe(false);
    expect(["foreign_event", "incidental_mention"]).toContain(assessment.relevance_role);
  });

  it("does not publish non-official articles where the outage is only a side mention", () => {
    const assessment = assessCandidateEvidence({
      item: item({
        title: "Grossbrand in Möhlin: das ist bekannt",
        source: "Neue Fricktaler Zeitung",
        snippet: "Für die betroffenen Personen werden nach dem Stromausfall Unterkünfte gesucht."
      }),
      classification: classification({
        location_text: "Möhlin",
        summary: "Ein Brandartikel erwähnt einen Stromausfall."
      }),
      snapshot: snapshot("Grossbrand in Möhlin: das ist bekannt. Für die betroffenen Personen werden nach dem Stromausfall Unterkünfte gesucht.")
    });

    expect(assessment.publishable).toBe(false);
    expect(assessment.needs_admin).toBe(true);
  });

  it("keeps compact title-led outage reports publishable", () => {
    const assessment = assessCandidateEvidence({
      item: item({
        title: "Zweieinhalb Stunden ohne Strom: Was ein Ausfall auslöst",
        source: "Zofinger Tagblatt",
        snippet: "Ein Stromausfall bringt im Quartier den Feierabend durcheinander."
      }),
      classification: classification({
        location_text: "Zofingen",
        summary: "Zweieinhalb Stunden ohne Strom in Zofingen."
      }),
      snapshot: snapshot("Zweieinhalb Stunden ohne Strom: Was ein Ausfall auslöst. Ein Stromausfall bringt im Quartier den Feierabend durcheinander.")
    });

    expect(assessment.publishable).toBe(true);
  });

  it("does not publish a generic country-level location by accident", () => {
    const assessment = assessCandidateEvidence({
      item: item({ title: "Stromausfall legt Mega-Tunnel lahm", source: "Schweiz heute" }),
      classification: classification({
        location_text: "Schweiz",
        summary: "Meldung nennt nur die Schweiz."
      }),
      snapshot: snapshot("Am Tag nach der Eröffnung kam es zu einem Stromausfall.")
    });

    expect(assessment.publishable).toBe(false);
    expect(assessment.location_granularity).toBe("country");
  });

  it("extracts explicit outage dates for user-facing ordering", () => {
    const assessment = assessCandidateEvidence({
      item: item({
        title: "Stromunterbruch Diegten - EBL",
        source: "EBL",
        url: "https://www.ebl.ch/de/kundencenter/stoerungen-unterbrueche/dieg260708",
        published_at: "2026-07-06T10:30:00.000Z"
      }),
      classification: classification({
        location_text: "Diegten",
        event_type: "planned_outage",
        summary: "Geplanter Stromunterbruch in Diegten."
      }),
      snapshot: snapshot("Die geplante Ausfallzeit ist am 8. Juli 2026. Stromunterbruch in Diegten.")
    });

    expect(assessment.facts.find((fact) => fact.fact_type === "start_time")?.value_text)
      .toBe("2026-07-08T00:00:00.000Z");
  });
});
