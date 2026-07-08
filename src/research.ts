import { assessResearch } from "./ai";
import {
  attachSourceToEvent,
  finishEventResearch,
  getAlertItemById,
  getKnownSourceUrlsForEvent,
  getOutageEvent,
  getOutageEventSnapshots,
  getOutageEventSources,
  insertAlertItem,
  refreshOutageEventAfterSource,
  refreshOutageEventSourceCount,
  startEventResearch
} from "./db";
import { refreshEventIntelligence } from "./event-intelligence";
import { normalizeLocation } from "./events";
import { itemHash } from "./rss";
import { createSourceSnapshot } from "./snapshots";
import type { Env, NormalizedRssItem, OutageEvent, OutageSource } from "./types";

interface ExaResult {
  id?: string;
  title?: string;
  url?: string;
  publishedDate?: string;
  author?: string;
  highlights?: string[];
  text?: string;
}

interface ScoredExaResult {
  result: ExaResult;
  score: number;
  reason: string;
}

const EXA_QUERY_LIMIT = 2;
const EXA_RESULT_LIMIT = 3;
const EXA_ACCEPT_SCORE = 64;
const SNAPSHOT_LIMIT = 4;
const SNAPSHOT_DELAY_MS = 8000;
const EXA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.searchParams.sort();
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value: string | null | undefined): string {
  return normalizeLocation(value ?? "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function containsAny(text: string, terms: string[]): boolean {
  const normalized = normalizeText(text);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function hostOf(value: string | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function publishedDateMs(result: ExaResult): number | null {
  if (!result.publishedDate) return null;
  const value = new Date(result.publishedDate).getTime();
  return Number.isFinite(value) ? value : null;
}

function daysBetween(left: number, right: number): number {
  return Math.abs(left - right) / 864e5;
}

function eventReferenceMs(event: OutageEvent): number {
  const candidates = [event.last_seen_at, event.first_seen_at]
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return candidates.length ? Math.max(...candidates) : Date.now();
}

function eventSearchWindow(event: OutageEvent): { start: string; end: string; year: string } {
  const first = new Date(event.first_seen_at).getTime();
  const last = new Date(event.last_seen_at).getTime();
  const anchor = Number.isFinite(first) ? first : Date.now();
  const startMs = (Number.isFinite(first) ? first : anchor) - 3 * 864e5;
  const endMs = (Number.isFinite(last) ? last : anchor) + 2 * 864e5;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    year: String(new Date(anchor).getUTCFullYear())
  };
}

export function scoreExaResultForEvent(result: ExaResult, event: OutageEvent): ScoredExaResult | null {
  if (!result.url) return null;

  const title = result.title ?? "";
  const highlights = (result.highlights ?? []).join(" ");
  const text = `${title} ${highlights} ${result.url}`;
  const location = event.location_text ?? "";
  const locationKey = normalizeText(location);
  const host = hostOf(result.url);
  let score = 0;
  const reasons: string[] = [];

  if (locationKey !== "unknown" && containsAny(text, [location])) {
    score += 35;
    reasons.push("location");
  }

  if (
    containsAny(text, [
      "stromausfall",
      "stromunterbruch",
      "netzausfall",
      "netzstörung",
      "netzstoerung",
      "panne de courant",
      "coupure de courant",
      "interruzione di corrente"
    ])
  ) {
    score += 30;
    reasons.push("outage-term");
  }

  if (containsAny(text, ["gemeinde", "stadt", "ew", "bkw", "energie", "stromversorgung", "netz"])) {
    score += 10;
    reasons.push("source-context");
  }

  if (host.endsWith(".ch") || host.includes("murgenthal") || host.includes("nau.ch")) {
    score += 8;
    reasons.push("swiss-host");
  }

  const publishedMs = publishedDateMs(result);
  const referenceMs = eventReferenceMs(event);
  if (publishedMs !== null) {
    const ageDays = daysBetween(publishedMs, referenceMs);
    if (ageDays <= 2) {
      score += 15;
      reasons.push("fresh");
    } else if (ageDays <= 14) {
      score += 8;
      reasons.push("recent");
    } else if (ageDays > 45) {
      score -= 35;
      reasons.push("old");
    } else {
      score -= 10;
      reasons.push("stale");
    }
  } else {
    score -= 12;
    reasons.push("undated");
  }

  if (containsAny(text, ["archiv", "forum", "community", "weihnachten", "heiligabend"])) {
    score -= 15;
    reasons.push("weak-context");
  }

  const clamped = Math.max(0, Math.min(publishedMs === null ? 58 : 100, score));
  return { result, score: clamped, reason: reasons.join(",") };
}

function researchQueries(event: OutageEvent): string[] {
  const location = event.location_text?.trim();
  if (!location || normalizeLocation(location) === "unknown") {
    return [
      `${event.title} Stromausfall`,
      `${event.title} Stromunterbruch`,
      `${event.title} Ursache Stromausfall`
    ];
  }

  return [
    `${location} Stromausfall ${eventSearchWindow(event).year}`,
    `${location} Stromunterbruch ${eventSearchWindow(event).year}`,
    `${location} Netzausfall ${eventSearchWindow(event).year}`,
    `${location} Netzstörung ${eventSearchWindow(event).year}`,
    `${location} wieder am Netz`,
    `${location} Ursache Stromausfall`,
    `${location} panne de courant`,
    `${location} coupure de courant`,
    `${location} interruzione di corrente`
  ];
}

async function cachedExaResults(
  env: Pick<Env, "DB">,
  query: string,
  event: OutageEvent
): Promise<ExaResult[] | null> {
  const queryHash = await sha256Hex(query);
  const row = await env.DB.prepare(
    `SELECT result_json, searched_at
     FROM exa_search_cache
     WHERE query_hash = ?`
  )
    .bind(queryHash)
    .first<{ result_json: string; searched_at: string }>();
  if (!row) return null;

  const searchedAt = new Date(row.searched_at).getTime();
  if (!Number.isFinite(searchedAt) || Date.now() - searchedAt > EXA_CACHE_TTL_MS) return null;

  try {
    const parsed = JSON.parse(row.result_json);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function storeExaResults(
  env: Pick<Env, "DB">,
  query: string,
  event: OutageEvent,
  results: ExaResult[]
): Promise<void> {
  const queryHash = await sha256Hex(query);
  await env.DB.prepare(
    `INSERT INTO exa_search_cache (
       query_hash, query, event_location_key, result_json, searched_at
     ) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(query_hash) DO UPDATE SET
       result_json = excluded.result_json,
       searched_at = excluded.searched_at,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(
      queryHash,
      query,
      normalizeLocation(event.location_text),
      JSON.stringify(results),
      new Date().toISOString()
    )
    .run();
}

async function searchExa(
  env: Pick<Env, "EXA_API_KEY" | "EXA_MOCK_MODE" | "DB">,
  query: string,
  event: OutageEvent
): Promise<ExaResult[]> {
  const cached = await cachedExaResults(env, query, event);
  if (cached) return cached;

  if (env.EXA_MOCK_MODE === "true") {
    const results = [
      {
        title: `Mock Quelle: ${query}`,
        url: `https://example.com/research/${encodeURIComponent(query)}`,
        highlights: [`Zusätzlicher Hinweis zu ${query}.`]
      }
    ];
    await storeExaResults(env, query, event, results);
    return results;
  }

  if (!env.EXA_API_KEY) throw new Error("EXA_API_KEY missing");

  const window = eventSearchWindow(event);
  const baseBody = {
    query,
    type: "auto",
    numResults: 5,
    startPublishedDate: window.start,
    endPublishedDate: window.end,
    contents: {
      highlights: true
    }
  };
  const noDateBody = {
    query,
    type: "auto",
    numResults: 5,
    contents: {
      highlights: true
    }
  };

  async function request(body: Record<string, unknown>) {
    return await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.EXA_API_KEY ?? ""
      },
      body: JSON.stringify(body)
    });
  }

  let response = await request({ ...baseBody, category: "news" });
  if (!response.ok && response.status === 400) {
    response = await request(baseBody);
  }
  if (!response.ok && response.status === 400) {
    response = await request(noDateBody);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Exa ${response.status}: ${text.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { results?: ExaResult[] };
  const results = payload.results ?? [];
  await storeExaResults(env, query, event, results);
  return results;
}

async function collectExaResults(
  env: Pick<Env, "EXA_API_KEY" | "EXA_MOCK_MODE" | "DB">,
  event: OutageEvent
): Promise<ExaResult[]> {
  const byUrl = new Map<string, ScoredExaResult>();
  for (const query of researchQueries(event).slice(0, EXA_QUERY_LIMIT)) {
    const results = await searchExa(env, query, event);
    for (const result of results) {
      if (!result.url) continue;
      const key = normalizeUrl(result.url);
      const scored = scoreExaResultForEvent(result, event);
      if (!scored || scored.score < EXA_ACCEPT_SCORE) continue;
      const existing = byUrl.get(key);
      if (!existing || scored.score > existing.score) byUrl.set(key, scored);
    }
    await sleep(300);
  }
  return [...byUrl.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, EXA_RESULT_LIMIT)
    .map((scored) => scored.result);
}

function resultToItem(result: ExaResult, event: OutageEvent, fetchedAt: string): NormalizedRssItem {
  return {
    feed_language: "de",
    title: result.title?.trim() || `Recherchequelle zu ${event.location_text || event.title}`,
    url: result.url ?? "",
    source: result.author?.trim() || "Exa Search",
    snippet: (result.highlights ?? []).join(" ").slice(0, 2000) || null,
    published_at: result.publishedDate ? new Date(result.publishedDate).toISOString() : null
  };
}

function sourceExcerpt(source: OutageSource, snapshotsBySource: Map<number, string>, fallback?: string | null) {
  return {
    title: source.source_title,
    url: source.source_url,
    excerpt: snapshotsBySource.get(source.id) || fallback || ""
  };
}

async function snapshotExistingSources(
  env: Env,
  event: OutageEvent,
  sources: OutageSource[],
  snapshotsAttempted: number
): Promise<number> {
  const snapshots = await getOutageEventSnapshots(env.DB, event.id);
  const alreadySnapshotted = new Set(
    snapshots
      .filter((snapshot) => snapshot.outage_source_id !== null)
      .map((snapshot) => snapshot.outage_source_id as number)
  );

  let attempts = snapshotsAttempted;
  const candidates = sources
    .filter((source) => !alreadySnapshotted.has(source.id))
    .sort((left, right) => right.is_primary - left.is_primary);

  for (const source of candidates) {
    if (attempts >= SNAPSHOT_LIMIT) break;
    const alertItem = await getAlertItemById(env.DB, source.alert_item_id);
    if (attempts > 0) await sleep(SNAPSHOT_DELAY_MS);
    await createSourceSnapshot(env, { event, source, alertItem });
    attempts += 1;
  }

  return attempts;
}

function normalizeFactConfidence(
  assessment: NonNullable<Awaited<ReturnType<typeof assessResearch>>["parsed"]>,
  sourceCount: number,
  successfulSnapshots: number
) {
  const hasConcreteNature = assessment.outage_nature !== "unknown";
  const hasConcreteCause = assessment.cause_category !== "unknown" || assessment.cause_text.trim().length > 0;
  const hasConcreteStatus = assessment.status !== "unknown";

  let heuristic = 0.25;
  if (sourceCount >= 2) heuristic += 0.15;
  if (sourceCount >= 3) heuristic += 0.1;
  if (successfulSnapshots > 0) heuristic += 0.15;
  if (hasConcreteNature) heuristic += 0.1;
  if (hasConcreteCause) heuristic += 0.12;
  if (hasConcreteStatus) heuristic += 0.08;

  const allKeyFactsUnknown = !hasConcreteNature && !hasConcreteCause && !hasConcreteStatus;
  const ceiling = allKeyFactsUnknown ? 0.55 : successfulSnapshots > 0 ? 0.9 : 0.75;

  return {
    ...assessment,
    fact_confidence: Math.max(0.1, Math.min(ceiling, Math.max(assessment.fact_confidence, heuristic)))
  };
}

export async function researchOutageEvent(
  env: Env,
  eventId: number,
  options: { automatic?: boolean } = {}
): Promise<{
  event: OutageEvent;
  addedSources: number;
  snapshots: number;
}> {
  const startedAt = new Date().toISOString();
  const event = await getOutageEvent(env.DB, eventId);
  if (!event) throw new Error(`Event ${eventId} not found`);

  const started = await startEventResearch(env.DB, eventId, startedAt, {
    automatic: options.automatic
  });
  if (!started) {
    throw new Error(
      options.automatic
        ? "Automatic research already ran or is running for this event"
        : "Research is already running for this event"
    );
  }

  let addedSources = 0;
  let snapshotCount = 0;

  try {
    const knownUrls = new Set((await getKnownSourceUrlsForEvent(env.DB, eventId)).map(normalizeUrl));
    const existingSources = await getOutageEventSources(env.DB, eventId);
    let snapshotsAttempted = await snapshotExistingSources(env, event, existingSources, 0);
    const results = await collectExaResults(env, event);
    const fetchedAt = new Date().toISOString();

    for (const result of results) {
      if (!result.url) continue;
      const urlKey = normalizeUrl(result.url);
      if (knownUrls.has(urlKey)) continue;

      const normalizedItem = resultToItem(result, event, fetchedAt);
      if (!normalizedItem.url) continue;
      const hash = await itemHash(normalizedItem);
      const stored = await insertAlertItem(env.DB, normalizedItem, hash, fetchedAt);
      const alertItem = await getAlertItemById(env.DB, stored.item.id);
      if (!alertItem) continue;

      const source = await attachSourceToEvent(env.DB, {
        eventId,
        alertItem,
        relationScore: scoreExaResultForEvent(result, event)?.score ?? 65,
        isPrimary: false
      });
      await refreshOutageEventAfterSource(env.DB, eventId, {
        lastSeenAt: normalizedItem.published_at ?? fetchedAt,
        confidence: event.confidence,
        summary: event.summary ?? "",
        reason: event.reason ?? ""
      });
      if (snapshotsAttempted < SNAPSHOT_LIMIT) {
        if (snapshotsAttempted > 0) await sleep(SNAPSHOT_DELAY_MS);
        await createSourceSnapshot(env, { event, source, alertItem });
        snapshotsAttempted += 1;
        snapshotCount += 1;
      }
      knownUrls.add(urlKey);
      addedSources += 1;
    }

    const [sources, snapshots] = await Promise.all([
      getOutageEventSources(env.DB, eventId),
      getOutageEventSnapshots(env.DB, eventId)
    ]);
    const snapshotsBySource = new Map(
      snapshots
        .filter((snapshot) => snapshot.outage_source_id !== null && snapshot.markdown_excerpt)
        .map((snapshot) => [snapshot.outage_source_id as number, snapshot.markdown_excerpt as string])
    );
    const sourceInputs = sources.map((source) =>
      sourceExcerpt(source, snapshotsBySource, source.source_name)
    );

    const assessment = await assessResearch(env, {
      title: event.title,
      location: event.location_text ?? "",
      summary: event.summary ?? "",
      sources: sourceInputs
    });
    if (!assessment.parsed) throw new Error(assessment.error ?? "Research assessment failed");

    const normalizedAssessment = normalizeFactConfidence(
      assessment.parsed,
      sources.length,
      snapshots.filter((snapshot) => snapshot.fetch_status === "success").length
    );

    await refreshEventIntelligence(env, eventId, {
      assessment: normalizedAssessment,
      useAiFactSheet: false
    });
    await finishEventResearch(env.DB, eventId, "completed", new Date().toISOString(), null);
    return {
      event: await refreshOutageEventSourceCount(env.DB, eventId),
      addedSources,
      snapshots: snapshotCount
    };
  } catch (error) {
    await finishEventResearch(
      env.DB,
      eventId,
      "failed",
      new Date().toISOString(),
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}
