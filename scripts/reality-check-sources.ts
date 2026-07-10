import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assessSourceObservation } from "../src/source-quality";
import { fetchSourceObservations } from "../src/source-adapters";
import { SOURCE_REGISTRY_SEEDS } from "../src/source-registry-seeds";
import type { SourceRegistryEntry } from "../src/types";

const sources: SourceRegistryEntry[] = SOURCE_REGISTRY_SEEDS.map((seed, index) => ({
  id: index + 1,
  source_key: seed.source_key,
  operator_name: seed.operator_name,
  source_type: seed.source_type,
  source_category: seed.source_category,
  url: seed.url,
  area_text: seed.area_text,
  trust_level: seed.trust_level,
  check_interval_minutes: seed.check_interval_minutes,
  priority: seed.priority,
  adapter_config_json: JSON.stringify(seed.adapter_config),
  firecrawl_enabled: seed.firecrawl_enabled,
  firecrawl_monitor_id: null,
  last_checked_at: null,
  last_success_at: null,
  last_error: null,
  health_status: "unknown",
  consecutive_failures: 0,
  enabled: 1,
  created_at: "",
  updated_at: ""
}));

async function directFetch(url: string) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "swiss-power-outage-radar-reality-check/0.1",
        "Accept": "text/html,application/json,text/plain;q=0.9,*/*;q=0.1"
      },
      redirect: "follow"
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      elapsedMs: Date.now() - startedAt,
      contentType: response.headers.get("content-type"),
      text,
      error: null as string | null
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      elapsedMs: Date.now() - startedAt,
      contentType: null,
      text: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join(process.cwd(), "artifacts", "source-reality-check", runId);
await mkdir(outDir, { recursive: true });

const observedAt = new Date().toISOString();
const summary = [];

for (const source of sources) {
  const fetched = await directFetch(source.url);
  const rawPath = join(outDir, `${source.source_key}.raw.txt`);
  const metaPath = join(outDir, `${source.source_key}.meta.json`);
  await writeFile(rawPath, fetched.text, "utf8");
  await writeFile(
    metaPath,
    JSON.stringify(
      {
        source_key: source.source_key,
        operator_name: source.operator_name,
        source_category: source.source_category,
        url: source.url,
        ok: fetched.ok,
        http_status: fetched.status,
        final_url: fetched.finalUrl,
        elapsed_ms: fetched.elapsedMs,
        content_type: fetched.contentType,
        bytes: new TextEncoder().encode(fetched.text).length,
        error: fetched.error,
        observed_at: observedAt
      },
      null,
      2
    ),
    "utf8"
  );

  const adapter = await fetchSourceObservations(
    { FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY },
    source,
    observedAt
  );
  const observations = adapter.observations.map((observation) => ({
    source_observation: observation,
    candidate_assessment: assessSourceObservation({
      id: 0,
      source_registry_id: observation.sourceRegistryId,
      source_key: observation.sourceKey,
      source_type: observation.sourceType,
      operator_name: observation.operatorName,
      observation_hash: observation.observationHash,
      canonical_status: observation.canonicalStatus,
      event_type: observation.eventType,
      title: observation.title,
      url: observation.url,
      location_text: observation.locationText,
      area_text: observation.areaText,
      started_at: observation.startedAt,
      resolved_at: observation.resolvedAt,
      observed_at: observation.observedAt,
      published_at: observation.publishedAt,
      evidence_excerpt: observation.evidenceExcerpt,
      raw_payload_json: observation.rawPayloadJson,
      extractor_version: observation.extractorVersion,
      confidence: observation.confidence,
      independence_key: observation.independenceKey,
      alert_item_id: null,
      outage_event_id: null,
      created_at: observedAt
    })
  }));

  await writeFile(
    join(outDir, `${source.source_key}.adapter.json`),
    JSON.stringify(
      {
        adapter_error: adapter.error,
        used_firecrawl: adapter.usedFirecrawl,
        observations
      },
      null,
      2
    ),
    "utf8"
  );

  summary.push({
    source_key: source.source_key,
    operator_name: source.operator_name,
    source_category: source.source_category,
    source_type: source.source_type,
    check_interval_minutes: source.check_interval_minutes,
    direct_http_status: fetched.status,
    direct_ok: fetched.ok,
    direct_error: fetched.error,
    used_firecrawl: adapter.usedFirecrawl,
    adapter_error: adapter.error,
    observation_count: adapter.observations.length,
    statuses: adapter.observations.map((observation) => observation.canonicalStatus),
    titles: adapter.observations.map((observation) => observation.title),
    raw_file: rawPath,
    adapter_file: join(outDir, `${source.source_key}.adapter.json`)
  });
}

await writeFile(join(outDir, "summary.json"), JSON.stringify({ run_id: runId, observed_at: observedAt, summary }, null, 2), "utf8");
console.log(JSON.stringify({ outDir, summary }, null, 2));
