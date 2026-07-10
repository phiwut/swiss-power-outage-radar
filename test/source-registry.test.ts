import { afterEach, describe, expect, it, vi } from "vitest";
import { scoreEvent, classifySource } from "../src/intelligence";
import { fetchSourceObservations, makeSourceObservationFromText } from "../src/source-adapters";
import { assessSourceObservation, observationToClassification } from "../src/source-quality";
import type { OutageEvent, OutageSource, SourceObservation, SourceRegistryEntry } from "../src/types";

function registry(patch: Partial<SourceRegistryEntry> = {}): SourceRegistryEntry {
  return {
    id: 1,
    source_key: "ewz-stoerungen",
    operator_name: "ewz",
    source_type: "html",
    source_category: "live_status",
    url: "https://www.ewz.ch/de/services/stoerungen.html",
    area_text: "Stadt Zürich und ewz Versorgungsgebiet",
    trust_level: "official",
    check_interval_minutes: 15,
    priority: 90,
    adapter_config_json: '{"no_outage_terms":["keine störungsmeldungen"]}',
    firecrawl_enabled: 1,
    firecrawl_monitor_id: null,
    last_checked_at: null,
    last_success_at: null,
    last_error: null,
    health_status: "unknown",
    consecutive_failures: 0,
    enabled: 1,
    created_at: "2026-07-10 00:00:00",
    updated_at: "2026-07-10 00:00:00",
    ...patch
  };
}

function stored(input: Awaited<ReturnType<typeof makeSourceObservationFromText>>, id = 1): SourceObservation {
  return {
    id,
    source_registry_id: input.sourceRegistryId,
    source_key: input.sourceKey,
    source_type: input.sourceType,
    operator_name: input.operatorName,
    observation_hash: input.observationHash,
    canonical_status: input.canonicalStatus,
    event_type: input.eventType,
    title: input.title,
    url: input.url,
    location_text: input.locationText,
    area_text: input.areaText,
    started_at: input.startedAt,
    resolved_at: input.resolvedAt,
    observed_at: input.observedAt,
    published_at: input.publishedAt,
    evidence_excerpt: input.evidenceExcerpt,
    raw_payload_json: input.rawPayloadJson,
    extractor_version: input.extractorVersion,
    confidence: input.confidence,
    independence_key: input.independenceKey,
    alert_item_id: null,
    outage_event_id: null,
    created_at: "2026-07-10 00:00:00"
  };
}

function event(patch: Partial<OutageEvent> = {}): OutageEvent {
  return {
    id: 1,
    title: "Möglicher Stromausfall / Netzunterbruch: Zürich",
    status: "needs_review",
    event_type: "power_outage",
    location_text: "Zürich",
    normalized_location: "zurich",
    canton: null,
    country: "CH",
    first_seen_at: "2026-07-10T08:00:00.000Z",
    last_seen_at: "2026-07-10T08:30:00.000Z",
    started_at_estimate: null,
    resolved_at_estimate: null,
    summary: "Stromausfall in Zürich.",
    reason: "Operator observation.",
    confidence: 0.92,
    source_count: 1,
    primary_source_url: "https://www.ewz.ch/de/services/stoerungen.html",
    primary_source_title: "ewz: Störung",
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
    created_at: "2026-07-10 08:00:00",
    updated_at: "2026-07-10 08:00:00",
    ...patch
  };
}

function source(patch: Partial<OutageSource> = {}): OutageSource {
  const intel = classifySource({
    url: patch.source_url ?? "https://www.ewz.ch/de/services/stoerungen.html",
    title: patch.source_title ?? "ewz: Störung",
    sourceName: patch.source_name ?? "ewz"
  });
  return {
    id: 1,
    outage_event_id: 1,
    alert_item_id: 1,
    source_url: "https://www.ewz.ch/de/services/stoerungen.html",
    source_title: "ewz: Störung",
    source_name: "ewz",
    published_at: "2026-07-10T08:00:00.000Z",
    relation_score: 100,
    is_primary: 1,
    created_at: "2026-07-10 08:00:00",
    source_kind: intel.source_kind,
    source_weight: intel.source_weight,
    is_official: intel.is_official,
    independence_key: intel.independence_key,
    ...patch
  };
}

describe("source registry observations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("classifies real operator outages as official publishable candidates", async () => {
    const observation = stored(
      await makeSourceObservationFromText(registry(), {
        title: "Stromausfall in Zürich Höngg",
        text: "Aktuelle Störung aufgrund technischer Ursachen. Betroffen sind Höngg und Wipkingen.",
        locationText: "Zürich Höngg",
        observedAt: "2026-07-10T08:00:00.000Z"
      })
    );

    const assessment = assessSourceObservation(observation);
    expect(observation.canonical_status).toBe("unplanned");
    expect(assessment.publishable).toBe(true);
    expect(assessment.facts.every((fact) => fact.extractor_version === "source-registry/v1")).toBe(true);
    expect(observationToClassification(observation).country).toBe("CH");
  });

  it("separates planned, historical, resolved and irrelevant observations", async () => {
    const planned = stored(await makeSourceObservationFromText(registry(), {
      title: "Geplanter Stromunterbruch in Diegten",
      text: "Wegen Wartungsarbeiten kommt es zu einem geplanten Stromunterbruch in Diegten.",
      locationText: "Diegten",
      observedAt: "2026-07-10T08:00:00.000Z"
    }));
    const historical = stored(await makeSourceObservationFromText(registry(), {
      title: "Rückblick auf Stromausfall 2025",
      text: "Historischer Rückblick auf einen Stromausfall im Jahr 2025.",
      locationText: "Valzeina",
      observedAt: "2026-07-10T08:00:00.000Z"
    }));
    const resolved = stored(await makeSourceObservationFromText(registry(), {
      title: "Störung in Belp behoben",
      text: "Der Stromausfall in Belp ist behoben. Die Versorgung ist wiederhergestellt.",
      locationText: "Belp",
      observedAt: "2026-07-10T08:00:00.000Z"
    }));
    const irrelevant = stored(await makeSourceObservationFromText(registry(), {
      title: "ewz: keine Störungsmeldungen",
      text: "Keine Störungsmeldungen vorhanden.",
      locationText: null,
      observedAt: "2026-07-10T08:00:00.000Z"
    }));

    expect(planned.canonical_status).toBe("planned");
    expect(assessSourceObservation(planned).event_type).toBe("planned_outage");
    expect(historical.canonical_status).toBe("historical");
    expect(assessSourceObservation(historical).publishable).toBe(false);
    expect(resolved.canonical_status).toBe("resolved");
    expect(assessSourceObservation(resolved).facts.map((fact) => fact.fact_type)).toContain("end_time");
    expect(irrelevant.canonical_status).toBe("irrelevant");
    expect(assessSourceObservation(irrelevant).publishable).toBe(false);
    expect(assessSourceObservation(irrelevant).facts.map((fact) => fact.fact_type)).not.toContain("end_time");
  });

  it("keeps duplicate observations stable while updates remain mergeable", async () => {
    const first = await makeSourceObservationFromText(registry(), {
      title: "Stromausfall in Zürich Höngg",
      text: "Aktuelle Störung. Betroffen sind Höngg und Wipkingen.",
      locationText: "Zürich Höngg",
      observedAt: "2026-07-10T08:00:00.000Z"
    });
    const duplicate = await makeSourceObservationFromText(registry(), {
      title: "Stromausfall in Zürich Höngg",
      text: "Aktuelle Störung. Betroffen sind Höngg und Wipkingen.",
      locationText: "Zürich Höngg",
      observedAt: "2026-07-10T09:00:00.000Z"
    });
    const update = await makeSourceObservationFromText(registry(), {
      title: "Update Stromausfall in Zürich Höngg",
      text: "Aktuelle Störung in Zürich Höngg. Weitere Strassen sind betroffen, die Behebung läuft weiterhin.",
      locationText: "Zürich Höngg",
      observedAt: "2026-07-10T10:00:00.000Z"
    });

    expect(duplicate.observationHash).toBe(first.observationHash);
    expect(update.observationHash).not.toBe(first.observationHash);
    expect(update.canonicalStatus).toBe("unplanned");
    expect(update.locationText).toBe(first.locationText);
  });

  it("distinguishes no-current-outage pages from parser failures and unreachable sources", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response("<html><body>Aktuell Stromausfall Stadt Zürich. Aktuell sind keine Störungen bekannt.</body></html>", {
            status: 200,
            headers: { "content-type": "text/html" }
          })
        )
        .mockResolvedValueOnce(new Response("<html><script>window.app={}</script></html>", { status: 200 }))
        .mockResolvedValueOnce(new Response("Service unavailable", { status: 503 }))
        .mockResolvedValueOnce(
          new Response(`<html><body>${"Navigation ".repeat(300)}<div>Keine Einträge vorhanden</div></body></html>`, { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response('<html><body><div data-details-no-warnings-text="Aktuell liegen keine St&#xF6;rungsmeldungen vor"></div></body></html>', { status: 200 })
        )
    );

    const noOutage = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, registry(), "2026-07-10T08:00:00.000Z");
    const parserFailure = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, registry({ source_key: "spa-shell" }), "2026-07-10T08:00:00.000Z");
    const unreachable = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, registry({ source_key: "http-503" }), "2026-07-10T08:00:00.000Z");
    const deepNoOutage = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, registry({ source_key: "deep-no-outage" }), "2026-07-10T08:00:00.000Z");
    const attrNoOutage = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, registry({ source_key: "attr-no-outage" }), "2026-07-10T08:00:00.000Z");

    expect(noOutage.error).toBeNull();
    expect(noOutage.observations[0].canonicalStatus).toBe("irrelevant");
    expect(noOutage.observations[0].locationText).toBeNull();
    expect(parserFailure.error).toContain("parser_empty_content");
    expect(parserFailure.observations).toHaveLength(0);
    expect(unreachable.error).toBe("HTTP 503");
    expect(unreachable.observations).toHaveLength(0);
    expect(deepNoOutage.observations[0].canonicalStatus).toBe("irrelevant");
    expect(attrNoOutage.observations[0].canonicalStatus).toBe("irrelevant");
  });

  it("blocks generic positive HTML pages unless the source explicitly allows them", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response("<html><body>Archiv und Navigation. Stromausfall, geplant, behoben.</body></html>", { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response("<html><body>Aktueller Stromausfall in Zürich Höngg. Betroffen sind Höngg und Wipkingen.</body></html>", {
            status: 200
          })
        )
    );

    const blocked = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, registry(), "2026-07-10T08:00:00.000Z");
    const allowed = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      registry({ adapter_config_json: '{"allow_generic_positive":true}' }),
      "2026-07-10T08:00:00.000Z"
    );

    expect(blocked.error).toContain("parser_needs_adapter");
    expect(blocked.observations).toHaveLength(0);
    expect(allowed.error).toBeNull();
    expect(allowed.observations[0].canonicalStatus).toBe("unplanned");
  });

  it("keeps single non-official discoveries below public corroboration while official sources pass", () => {
    const mediaOnly = scoreEvent(event({ confidence: 0.98 }), [
      source({
        source_url: "https://www.blick.ch/schweiz/zuerich/stromausfall",
        source_title: "Stromausfall in Zürich",
        source_name: "Blick",
        source_kind: "national_media",
        source_weight: 0.6,
        is_official: 0,
        independence_key: "blick.ch"
      })
    ]);
    const official = scoreEvent(event(), [source()]);

    expect(mediaOnly.evidence_level).not.toBe("official");
    expect(mediaOnly.event_score).toBeLessThan(80);
    expect(official.evidence_level).toBe("official");
    expect(official.event_score).toBeGreaterThanOrEqual(70);
  });
});
