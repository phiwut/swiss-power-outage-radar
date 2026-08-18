import { afterEach, describe, expect, it, vi } from "vitest";
import { scoreEvent, classifySource } from "../src/intelligence";
import { fetchSourceObservations, makeSourceObservationFromText } from "../src/source-adapters";
import { assessSourceObservation, observationToClassification } from "../src/source-quality";
import type { OutageEvent, OutageSource, SourceObservation, SourceRegistryEntry } from "../src/types";
import bkwFixture from "./fixtures/operators/bkw.json?raw";
import bkwTrafoFixture from "./fixtures/operators/bkw-trafo.json?raw";
import ewzFixture from "./fixtures/operators/ewz.html?raw";
import ewzNoCurrentFixture from "./fixtures/operators/ewz-no-current.html?raw";
import primeoFixture from "./fixtures/operators/primeo.json?raw";
import romandeFixture from "./fixtures/operators/romande-energie.json?raw";
import sakFixture from "./fixtures/operators/sak.json?raw";
import alertswissFixture from "./fixtures/operators/alertswiss.json?raw";

function geoIdentifyBody(municipality: string, canton = "BE"): string {
  return JSON.stringify({
    results: [
      {
        attributes: {
          gemname: municipality,
          label: municipality,
          is_current_jahr: true,
          jahr: 2024,
          kanton: canton
        }
      }
    ]
  });
}

function stubOperatorFetch(operatorBody: string, municipalityForCoords: (lat: number, lon: number) => string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("geo.admin.ch") && url.includes("identify")) {
        const geometry = new URL(url).searchParams.get("geometry") ?? "";
        const [lon, lat] = geometry.split(",").map(Number);
        return new Response(geoIdentifyBody(municipalityForCoords(lat, lon)), { status: 200 });
      }
      return new Response(operatorBody, { status: 200 });
    })
  );
}

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
    expect(resolved.resolved_at).toBeNull();
    expect(assessSourceObservation(resolved).facts.map((fact) => fact.fact_type)).not.toContain("end_time");
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
          new Response("<html><body>Aktuell Stromausfall Stadt Zürich. Aktuell sind keine Störungen bekannt.<article class='stoerung-card'>Archiv: Stromausfall in Bern.</article></body></html>", {
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

    const noOutage = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, registry({ source_key: "generic-no-outage" }), "2026-07-10T08:00:00.000Z");
    const parserFailure = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, registry({ source_key: "spa-shell" }), "2026-07-10T08:00:00.000Z");
    const unreachable = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, registry({ source_key: "http-503" }), "2026-07-10T08:00:00.000Z");
    const deepNoOutage = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, registry({ source_key: "deep-no-outage" }), "2026-07-10T08:00:00.000Z");
    const attrNoOutage = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, registry({ source_key: "attr-no-outage" }), "2026-07-10T08:00:00.000Z");

    expect(noOutage.error).toBeNull();
    expect(noOutage.transportStatus).toBe("ok");
    expect(noOutage.parserStatus).toBe("no_current_outage");
    expect(noOutage.observations[0].canonicalStatus).toBe("irrelevant");
    expect(noOutage.observations[0].locationText).toBeNull();
    expect(parserFailure.error).toContain("parser_empty_content");
    expect(parserFailure.parserStatus).toBe("error");
    expect(parserFailure.observations).toHaveLength(0);
    expect(unreachable.error).toBe("HTTP 503");
    expect(unreachable.transportStatus).toBe("error");
    expect(unreachable.observations).toHaveLength(0);
    expect(deepNoOutage.observations[0].canonicalStatus).toBe("irrelevant");
    expect(attrNoOutage.observations[0].canonicalStatus).toBe("irrelevant");
  });

  it("blocks generic positive HTML pages even when legacy config allowed whole-page positives", async () => {
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

    const blocked = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, registry({ source_key: "generic-positive" }), "2026-07-10T08:00:00.000Z");
    const allowed = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      registry({ source_key: "generic-positive-legacy", adapter_config_json: '{"allow_generic_positive":true}' }),
      "2026-07-10T08:00:00.000Z"
    );

    expect(blocked.error).toContain("parser_needs_adapter");
    expect(blocked.observations).toHaveLength(0);
    expect(blocked.parserStatus).toBe("needs_adapter");
    expect(allowed.error).toContain("parser_needs_adapter");
    expect(allowed.observations).toHaveLength(0);
  });

  it.each([
    ["bkw-outage", "BKW", bkwFixture, "https://api-outage.bkw.ch/api/services/supplyZone/state", "unplanned", "3011 Bern"],
    ["sak-netzstatus", "SAK", sakFixture, "https://netzstatus.sak.ch/api/v1/failures", "planned", "Herrentoebeli"],
    ["primeo-netzstatus", "Primeo Energie", primeoFixture, "https://www.primeo-energie.ch/magnolia/.rest/primeo/v1/gridStatus.json?limit=20", "unplanned", "Liestal"]
  ])("parses the verified %s operator API contract", async (sourceKey, operatorName, payload, apiUrl, status, location) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(payload, { status: 200 })));
    const source = registry({
      source_key: sourceKey,
      operator_name: operatorName,
      adapter_config_json: JSON.stringify({ api_url: apiUrl })
    });
    const result = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      source,
      "2026-07-15T09:00:00.000Z"
    );

    expect(result.error).toBeNull();
    expect(result.transportStatus).toBe("ok");
    expect(result.parserStatus).toBe("ready");
    expect(result.observations).toHaveLength(sourceKey === "primeo-netzstatus" ? 2 : 1);
    expect(result.observations[0].canonicalStatus).toBe(status);
    expect(result.observations[0].locationText).toContain(location);
    if (sourceKey === "primeo-netzstatus") {
      expect(result.observations[1].canonicalStatus).toBe("resolved");
      expect(result.observations[1].resolvedAt).toBe("2026-07-14T00:30:00.000Z");
    }
  });

  it("keeps a recent SAK resolution and uses its official end time", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: "rossfall",
      title: "Stromunterbruch Rossfall - Schwägalp",
      description: "Die Stromversorgung wurde wiederhergestellt.",
      status: 1,
      category: 0,
      publish_date: "2026-07-29T14:12:00.000+02:00",
      start_date: "2026-07-29T13:52:00.000+02:00",
      end_date: "2026-07-29T20:17:00.000+02:00"
    }]), { status: 200 })));
    const result = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      registry({
        source_key: "sak-netzstatus",
        operator_name: "SAK",
        adapter_config_json: '{"api_url":"https://netzstatus.sak.ch/api/v1/failures"}'
      }),
      "2026-07-30T09:00:00.000Z"
    );

    expect(result.parserStatus).toBe("ready");
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].canonicalStatus).toBe("resolved");
    expect(result.observations[0].startedAt).toBe("2026-07-29T11:52:00.000Z");
    expect(result.observations[0].resolvedAt).toBe("2026-07-29T18:17:00.000Z");
    const assessment = assessSourceObservation(stored(result.observations[0]));
    expect(assessment.status).toBe("resolved");
    expect(assessment.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ fact_type: "end_time", value_text: "2026-07-29T18:17:00.000Z" })
    ]));
  });

  it("does not re-import old SAK history as new resolved incidents", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: "old",
      title: "Stromunterbruch Alter Fall",
      description: "Die Störung wurde behoben.",
      status: 2,
      category: 0,
      publish_date: "2026-05-01T10:00:00.000+02:00",
      start_date: "2026-05-01T10:00:00.000+02:00",
      end_date: "2026-05-01T11:00:00.000+02:00"
    }]), { status: 200 })));
    const result = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      registry({
        source_key: "sak-netzstatus",
        operator_name: "SAK",
        adapter_config_json: '{"api_url":"https://netzstatus.sak.ch/api/v1/failures"}'
      }),
      "2026-07-30T09:00:00.000Z"
    );

    expect(result.parserStatus).toBe("no_current_outage");
    expect(result.observations).toHaveLength(0);
  });

  it("parses Romande Energie geometry and resolves a municipality from coordinates at intake", async () => {
    stubOperatorFetch(romandeFixture, () => "Montricher");
    const result = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      registry({
        source_key: "romande-energie-pannes",
        operator_name: "Romande Energie",
        adapter_config_json: '{"api_url":"https://www.romande-energie.ch/re_infopannes/data"}'
      }),
      "2026-07-15T09:00:00.000Z"
    );

    expect(result.parserStatus).toBe("ready");
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].canonicalStatus).toBe("planned");
    expect(result.observations[0].locationText).toBe("Montricher");
    const observation = stored(result.observations[0]);
    const assessment = assessSourceObservation(observation);
    expect(assessment.publishable).toBe(true);
    expect(assessment.location_text).toBe("Montricher");
    expect(assessment.facts.some((candidate) => candidate.fact_type === "location")).toBe(true);
    expect(observationToClassification(observation).location_text).toBe("Montricher");
  });

  it("ingests the BKW transformer incident feed and aggregates nearby failures by municipality", async () => {
    stubOperatorFetch(bkwTrafoFixture, (lat) => {
      if (lat < 46.8) return "Höfen";
      if (lat < 46.95) return "Köniz";
      return "Lützelflüh";
    });
    const result = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      registry({
        source_key: "bkw-outage",
        operator_name: "BKW",
        adapter_config_json: '{"api_url":"https://api-outage.bkw.ch/api/services/trafo/state?supplier=bkw"}'
      }),
      "2026-08-14T08:00:00.000Z"
    );

    expect(result.error).toBeNull();
    expect(result.parserStatus).toBe("ready");
    const locations = result.observations.map((observation) => `${observation.canonicalStatus}:${observation.locationText}`).sort();
    expect(locations).toEqual(["planned:Köniz", "unplanned:Höfen", "unplanned:Lützelflüh"]);
    expect(result.observations.every((observation) => !/Bracher|Schnetzenschachen|Höfen-Dorf|Föhrenweg/i.test(observation.locationText ?? ""))).toBe(true);
    const planned = result.observations.find((observation) => observation.canonicalStatus === "planned");
    expect(planned?.startedAt).toBe("2026-08-14T06:00:00.000Z");
    expect(planned?.resolvedAt).toBe("2026-08-14T09:00:00.000Z");
    expect(assessSourceObservation(stored(result.observations[0])).publishable).toBe(true);
  });

  it("keeps known BKW incidents when a single row uses an unknown enum", async () => {
    stubOperatorFetch(
      JSON.stringify([
        {
          trafoNumber: 1,
          trafoName: "Kirchplatz 4",
          supplyState: "FAILURE",
          latitude: 47.00787,
          longitude: 7.68643,
          affectedCustomers: 0
        },
        {
          trafoNumber: 2,
          trafoName: "Unknown",
          supplyState: "MAINTENANCE",
          latitude: 47.00787,
          longitude: 7.68643,
          affectedCustomers: 0
        }
      ]),
      () => "Lützelflüh"
    );
    const result = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      registry({
        source_key: "bkw-outage",
        adapter_config_json: '{"api_url":"https://api-outage.bkw.ch/api/services/trafo/state?supplier=bkw"}'
      }),
      "2026-08-14T08:00:00.000Z"
    );

    expect(result.parserStatus).toBe("ready");
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].locationText).toBe("Lützelflüh");
  });

  it("treats an empty BKW transformer list as no current outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200 })));
    const result = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      registry({
        source_key: "bkw-outage",
        adapter_config_json: '{"api_url":"https://api-outage.bkw.ch/api/services/trafo/state?supplier=bkw"}'
      }),
      "2026-08-14T08:00:00.000Z"
    );

    expect(result.parserStatus).toBe("no_current_outage");
    expect(result.observations).toHaveLength(0);
  });

  it("parses the live ewz incident component and recognizes its real no-current message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response(ewzFixture, { status: 200 }))
        .mockResolvedValueOnce(new Response(ewzNoCurrentFixture, { status: 200 }))
    );
    const source = registry({ source_key: "ewz-stoerungen", operator_name: "ewz" });

    const positive = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, source, "2026-07-15T09:00:00.000Z");
    const negative = await fetchSourceObservations({ FIRECRAWL_API_KEY: undefined }, source, "2026-07-15T09:00:00.000Z");

    expect(positive.parserStatus).toBe("ready");
    expect(positive.observations).toHaveLength(1);
    expect(positive.observations[0].locationText).toBe("Zürich");
    expect(negative.parserStatus).toBe("no_current_outage");
    expect(negative.observations).toHaveLength(0);
  });

  it("fails closed when a verified operator API changes schema", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"unexpected":true}', { status: 200 })));
    const result = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      registry({
        source_key: "bkw-outage",
        adapter_config_json: '{"api_url":"https://api-outage.bkw.ch/api/services/supplyZone/state"}'
      }),
      "2026-07-15T09:00:00.000Z"
    );

    expect(result.parserStatus).toBe("needs_adapter");
    expect(result.observations).toHaveLength(0);
    expect(result.error).toContain("schema_changed");
  });

  it.each([
    ["bkw-outage", "https://api-outage.bkw.ch/api/services/supplyZone/state", '[{"supplyState":"MAINTENANCE","city":"Bern"}]'],
    ["sak-netzstatus", "https://netzstatus.sak.ch/api/v1/failures", '[{"title":"Netzstörung Bern","status":9,"category":0,"start_date":"2026-07-15T08:00:00Z"}]'],
    ["romande-energie-pannes", "https://www.romande-energie.ch/re_infopannes/data", '[{"genre":"information","date_debut":"2026-07-15T08:00:00Z","geojson":{"type":"FeatureCollection","features":[]}}]'],
    ["primeo-netzstatus", "https://www.primeo-energie.ch/magnolia/.rest/primeo/v1/gridStatus.json?limit=20", '{"current":[{"status":"ACKNOWLEDGED","title":"Liestal"}],"done":[]}'],
    ["alertswiss", "https://www.alert.swiss/content/alertswiss-internet/de/home/_jcr_content/polyalert.alertswiss_alerts.actual.json", '{"heartbeatAgeInMillis":1}']
  ])("fails closed on unknown %s operator enums", async (sourceKey, apiUrl, payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(payload, { status: 200 })));
    const result = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      registry({ source_key: sourceKey, adapter_config_json: JSON.stringify({ api_url: apiUrl }) }),
      "2026-07-15T09:00:00.000Z"
    );

    expect(result.parserStatus).toBe("needs_adapter");
    expect(result.observations).toHaveLength(0);
    expect(result.error).toContain("schema_changed");
  });

  it("keeps only electricity-related Alertswiss alerts and does not copy full alert bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(alertswissFixture, { status: 200 })));
    const result = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      registry({
        source_key: "alertswiss",
        operator_name: "Alertswiss",
        source_category: "discovery_only",
        url: "https://www.alert.swiss/",
        adapter_config_json: JSON.stringify({
          api_url: "https://www.alert.swiss/content/alertswiss-internet/de/home/_jcr_content/polyalert.alertswiss_alerts.actual.json"
        })
      }),
      "2026-08-18T09:00:00.000Z"
    );

    expect(result.error).toBeNull();
    expect(result.parserStatus).toBe("ready");
    expect(result.observations).toHaveLength(2);
    expect(result.observations.map((item) => item.canonicalStatus).sort()).toEqual(["resolved", "unplanned"]);
    expect(result.observations.every((item) => item.locationText === "Chur")).toBe(true);
    expect(result.observations.some((item) => item.title.includes("Stromausfall in Teilen der Stadt Chur"))).toBe(true);
    expect(result.observations.every((item) => item.evidenceExcerpt.includes("Quelle: www.alertswiss.ch"))).toBe(true);
    expect(result.observations.some((item) => item.evidenceExcerpt.includes("Volltext"))).toBe(false);
    expect(result.observations.some((item) => item.title.includes("Feuerverbot"))).toBe(false);
    expect(result.observations.some((item) => item.title.includes("Test:"))).toBe(false);
  });

  it("treats an Alertswiss feed without electricity alerts as no current outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      heartbeatAgeInMillis: 800,
      renderTime: "18.08.2026 11:18:18.291 +0200",
      alerts: [{
        identifier: "FIRE-2",
        title: { title: "Feuerverbot" },
        description: { description: "Waldbrandgefahr." },
        event: "Feuerverbot",
        allClear: false,
        testAlert: false,
        technicalTestAlert: false,
        areas: [{ description: { description: "Kanton Wallis" } }]
      }]
    }), { status: 200 })));
    const result = await fetchSourceObservations(
      { FIRECRAWL_API_KEY: undefined },
      registry({
        source_key: "alertswiss",
        adapter_config_json: '{"api_url":"https://www.alert.swiss/content/alertswiss-internet/de/home/_jcr_content/polyalert.alertswiss_alerts.actual.json"}'
      }),
      "2026-08-18T09:00:00.000Z"
    );

    expect(result.error).toBeNull();
    expect(result.parserStatus).toBe("no_current_outage");
    expect(result.observations).toHaveLength(0);
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
