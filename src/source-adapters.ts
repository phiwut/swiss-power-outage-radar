import { normalizeLocation } from "./events";
import { geojsonCentroid, locateIncidentClusters, resolveIncidentLocation } from "./intake-location";
import { itemHash, parseRssFeed } from "./rss";
import type {
  AiClassification,
  CanonicalObservationStatus,
  Env,
  SourceObservationInput,
  SourceRegistryEntry
} from "./types";

export const SOURCE_EXTRACTOR_VERSION = "source-registry/v1";

interface AdapterConfig {
  language?: "de" | "fr" | "it";
  status_mode?: string;
  allow_generic_positive?: boolean;
  no_outage_terms?: string[];
  historical_terms?: string[];
  planned_terms?: string[];
  utility_filter?: "electricity_only";
  json_path?: string;
  api_url?: string;
}

export interface AdapterResult {
  observations: SourceObservationInput[];
  error: string | null;
  usedFirecrawl: boolean;
  transportStatus: "ok" | "error";
  parserStatus: "ready" | "no_current_outage" | "needs_adapter" | "error";
}

function compact(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function parseConfig(source: SourceRegistryEntry): AdapterConfig {
  if (!source.adapter_config_json) return {};
  try {
    const parsed = JSON.parse(source.adapter_config_json);
    return parsed && typeof parsed === "object" ? (parsed as AdapterConfig) : {};
  } catch {
    return {};
  }
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

function hostOf(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return normalizeLocation(value).slice(0, 80);
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&uuml;/g, "ü")
    .replace(/&ouml;/g, "ö")
    .replace(/&auml;/g, "ä")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Auml;/g, "Ä")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function dataAttributeText(html: string): string {
  return [...html.matchAll(/\bdata-[a-z0-9-]+=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .join(" ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&uuml;/g, "ü")
    .replace(/&ouml;/g, "ö")
    .replace(/&auml;/g, "ä")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Auml;/g, "Ä")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function inferStatus(text: string, config: AdapterConfig): CanonicalObservationStatus {
  const normalized = normalizeLocation(text);
  const noOutageTerms = [
    "aktuell sind keine störungen bekannt",
    "aktuell sind keine stoerungen bekannt",
    "momentan sind keine netzstörungen bekannt",
    "momentan sind keine netzstoerungen bekannt",
    "keine störungsmeldungen",
    "keine stoerungsmeldungen",
    "keine einträge vorhanden",
    "keine eintraege vorhanden",
    "aktuell liegen keine störungsmeldungen vor",
    "aktuell liegen keine stoerungsmeldungen vor",
    ...(config.no_outage_terms ?? [])
  ];
  if (noOutageTerms.some((term) => normalized.includes(normalizeLocation(term)))) return "irrelevant";
  if (/\b(archiv|historisch|rueckblick|rückblick)\b/i.test(text)) return "historical";
  if ((config.historical_terms ?? []).some((term) => normalized.includes(normalizeLocation(term)))) {
    return "historical";
  }
  if (/\b(behoben|wiederhergestellt|wieder am netz|resolved|rétabli|retabli|ripristinat)\b/i.test(text)) {
    return "resolved";
  }
  if (/\b(geplant\w*|wartung\w*|unterhalt\w*|maintenance|travaux|programmata)\b/i.test(text)) {
    return "planned";
  }
  if (
    /\b(stromausfall|stromunterbruch|netzunterbruch|netzstoerung|netzstörung|coupure de courant|panne de courant|interruzione di corrente)\b/i.test(
      text
    )
  ) {
    return "unplanned";
  }
  return "unverified";
}

function eventTypeForStatus(status: CanonicalObservationStatus): AiClassification["event_type"] {
  if (status === "planned") return "planned_outage";
  if (status === "unplanned" || status === "resolved") return "power_outage";
  return "unclear";
}

function titleFromText(text: string, fallback: string): string {
  const firstSentence = compact(text).split(/(?<=[.!?])\s+/)[0] ?? "";
  return (firstSentence || fallback).slice(0, 180);
}

function requiresItemLevelAdapter(source: SourceRegistryEntry, config: AdapterConfig, status: CanonicalObservationStatus): boolean {
  if (status === "irrelevant" || status === "unverified") return false;
  return true;
}

function explicitLocation(text: string): string | null {
  const match = text.match(/(?:^|\s)(?:in|für|fuer|betroffen(?:e)?|commune de|à|a)\s+([A-ZÄÖÜ][A-Za-zÀ-ÿÄÖÜäöü' -]{2,60})/);
  return match?.[1]
    ? compact(match[1].replace(/\b(?:ist|sind|wurde|wurden|kam|kommt|seit|am|vom)\b.*$/i, ""))
    : null;
}

function likelyLocation(text: string, source: SourceRegistryEntry): string | null {
  if (inferStatus(text, parseConfig(source)) === "irrelevant") return null;
  const explicit = explicitLocation(text);
  if (explicit) return explicit;
  if (source.operator_name.toLowerCase() === "ewz") return "Zürich";
  if (source.operator_name.toLowerCase().includes("bern")) return "Bern";
  return null;
}

export async function extractStructuredHtmlOutageItems(
  source: SourceRegistryEntry,
  html: string,
  observedAt: string
): Promise<SourceObservationInput[]> {
  const config = parseConfig(source);
  const markers = [
    "data-outage-item", "outage-item", "incident-item", "alert-item", "stoerung-item", "panne-item"
  ];
  const blocks = html.matchAll(/<(article|li|tr|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi);
  const seen = new Set<string>();
  const observations: SourceObservationInput[] = [];

  for (const match of blocks) {
    const attributes = normalizeLocation(match[2] ?? "");
    if (!markers.some((marker) => attributes.includes(normalizeLocation(marker)))) continue;
    const blockHtml = match[3] ?? "";
    const text = compact(stripHtml(blockHtml));
    if (!text || seen.has(text)) continue;
    const status = inferStatus(text, config);
    if (!["planned", "unplanned", "resolved"].includes(status)) continue;
    const location = explicitLocation(text);
    if (!location) continue;
    seen.add(text);
    const href = blockHtml.match(/\bhref=["']([^"']+)["']/i)?.[1];
    let itemUrl = source.url;
    if (href) {
      try {
        itemUrl = new URL(href, source.url).toString();
      } catch {
        itemUrl = source.url;
      }
    }
    observations.push(
      await makeSourceObservationFromText(source, {
        title: titleFromText(text, `${source.operator_name}: Stromnetz-Meldung`),
        url: itemUrl,
        text,
        locationText: location,
        raw: { excerpt: text.slice(0, 2000), adapter: "structured-html-items" },
        observedAt
      })
    );
  }
  return observations;
}

export async function makeSourceObservationFromText(
  source: SourceRegistryEntry,
  patch: {
    title: string;
    url?: string;
    text: string;
    locationText?: string | null;
    publishedAt?: string | null;
    raw?: unknown;
    observedAt: string;
    canonicalStatus?: CanonicalObservationStatus;
    startedAt?: string | null;
    resolvedAt?: string | null;
  }
): Promise<SourceObservationInput> {
  const config = parseConfig(source);
  const fullText = compact(patch.text);
  const evidence = fullText.slice(0, 1200) || patch.title;
  const status = patch.canonicalStatus ?? inferStatus(`${patch.title}. ${fullText}`, config);
  const url = canonicalUrl(patch.url ?? source.url);
  const observedAt = patch.observedAt;
  const hash = await sha256Hex(
    [source.source_key, status, url, patch.title, evidence, patch.publishedAt ?? "", patch.locationText ?? ""].join("\n")
  );

  return {
    sourceRegistryId: source.id,
    sourceKey: source.source_key,
    sourceType: source.source_type,
    operatorName: source.operator_name,
    observationHash: hash,
    canonicalStatus: status,
    eventType: eventTypeForStatus(status),
    title: patch.title.slice(0, 220),
    url,
    locationText: patch.locationText ?? likelyLocation(`${patch.title}. ${evidence}`, source),
    areaText: source.area_text,
    startedAt: patch.startedAt ?? null,
    resolvedAt: patch.resolvedAt ?? null,
    observedAt,
    publishedAt: patch.publishedAt ?? null,
    evidenceExcerpt: evidence,
    rawPayloadJson: patch.raw ? JSON.stringify(patch.raw).slice(0, 5000) : null,
    extractorVersion: SOURCE_EXTRACTOR_VERSION,
    confidence: status === "irrelevant" ? 0 : source.trust_level === "official" ? 0.92 : 0.72,
    independenceKey: hostOf(url)
  };
}

interface KnownAdapterPayload {
  observations: SourceObservationInput[];
  schemaMatched: boolean;
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isoOrNull(value: unknown): string | null {
  const raw = stringOrNull(value);
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function earliestIso(values: Array<string | null | undefined>): string | null {
  const timestamps = values.filter((value): value is string => Boolean(value)).map((value) => Date.parse(value)).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
}

function latestIso(values: Array<string | null | undefined>): string | null {
  const timestamps = values.filter((value): value is string => Boolean(value)).map((value) => Date.parse(value)).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function operatorLocation(title: string): string | null {
  const withoutPrefix = title
    .replace(/^(?:behobener?|beendeter?|geplanter?)\s+/i, "")
    .replace(/^(?:netzstörung|netzstoerung|stromunterbruch|stromausfall|panne(?: de courant)?)\s+/i, "")
    .replace(/^(?:in|im|bei|à)\s+/i, "")
    .replace(/\s+(?:und|et)\s+umgebung.*$/i, "")
    .trim();
  if (!withoutPrefix) return null;
  const parenthesis = withoutPrefix.match(/^([^()]{2,80})\s*\(/)?.[1];
  return compact(parenthesis ?? withoutPrefix).slice(0, 120) || null;
}

async function makeKnownObservation(
  source: SourceRegistryEntry,
  input: {
    status: CanonicalObservationStatus;
    title: string;
    text: string;
    location: string | null;
    observedAt: string;
    startedAt?: string | null;
    resolvedAt?: string | null;
    publishedAt?: string | null;
    raw: unknown;
  }
): Promise<SourceObservationInput> {
  return makeSourceObservationFromText(source, {
    title: input.title,
    text: input.text,
    locationText: input.location,
    observedAt: input.observedAt,
    startedAt: input.startedAt,
    resolvedAt: input.resolvedAt,
    publishedAt: input.publishedAt,
    canonicalStatus: input.status,
    raw: input.raw
  });
}

async function parseBkwPayload(
  source: SourceRegistryEntry,
  payload: unknown,
  observedAt: string
): Promise<KnownAdapterPayload> {
  if (!Array.isArray(payload)) return { observations: [], schemaMatched: false };
  const rows = payload.map(recordOf);
  const allowedStates = new Set(["SUPPLIED", "DISCONNECTION", "FAILURE"]);
  const zoneRows = rows.filter((row) =>
    typeof row.supplyState === "string" && allowedStates.has(row.supplyState) && typeof row.city === "string"
  );
  const trafoRows = rows.filter((row) =>
    typeof row.supplyState === "string" &&
    allowedStates.has(row.supplyState) &&
    typeof row.trafoName === "string" &&
    finiteNumber(row.latitude) !== null &&
    finiteNumber(row.longitude) !== null
  );
  if (rows.length > 0 && zoneRows.length === 0 && trafoRows.length === 0) {
    return { observations: [], schemaMatched: false };
  }

  if (trafoRows.length > 0) {
    const incidents = trafoRows.flatMap((row) => {
      if (row.supplyState !== "FAILURE" && row.supplyState !== "DISCONNECTION") return [];
      const latitude = finiteNumber(row.latitude);
      const longitude = finiteNumber(row.longitude);
      if (latitude === null || longitude === null) return [];
      const planned = row.supplyState === "DISCONNECTION";
      return [{
        status: (planned ? "planned" : "unplanned") as CanonicalObservationStatus,
        latitude,
        longitude,
        startedAt: isoOrNull(row.disconnectionStartTime),
        resolvedAt: isoOrNull(row.disconnectionEndTime),
        name: compact(String(row.trafoName)),
        raw: row
      }];
    });
    const clusters = await locateIncidentClusters(incidents);
    return {
      schemaMatched: true,
      observations: await Promise.all(clusters.map((cluster) => {
        const planned = cluster.status === "planned";
        const place = cluster.location || "unbekanntem Ort";
        const title = planned ? `Geplanter Stromunterbruch in ${place}` : `Stromausfall in ${place}`;
        const names = cluster.items.map((item) => item.name).filter(Boolean).slice(0, 8).join(", ");
        return makeKnownObservation(source, {
          status: cluster.status,
          title,
          text: compact(`${title}. ${cluster.items.length} Trafostationen betroffen${names ? `: ${names}` : ""}.`),
          location: cluster.location,
          observedAt,
          startedAt: earliestIso(cluster.items.map((item) => item.startedAt)),
          resolvedAt: latestIso(cluster.items.map((item) => item.resolvedAt)),
          raw: {
            adapter: "bkw-trafo-state",
            latitude: cluster.latitude,
            longitude: cluster.longitude,
            transformers: cluster.items.map((item) => item.raw)
          }
        });
      }))
    };
  }

  const affected = zoneRows.filter((row) => row.supplyState === "FAILURE" || row.supplyState === "DISCONNECTION");
  return {
    schemaMatched: true,
    observations: await Promise.all(affected.map((row) => {
      const city = compact(String(row.city));
      const postalCode = Number.isFinite(Number(row.plz)) ? String(row.plz) : "";
      const planned = row.supplyState === "DISCONNECTION";
      const status: CanonicalObservationStatus = planned ? "planned" : "unplanned";
      const title = planned ? `Geplanter Stromunterbruch in ${city}` : `Stromausfall in ${city}`;
      return makeKnownObservation(source, {
        status,
        title,
        text: `${title}. Netzstatus: ${String(row.supplyState)}.`,
        location: compact(`${postalCode} ${city}`),
        observedAt,
        raw: row
      });
    }))
  };
}

async function parseSakPayload(
  source: SourceRegistryEntry,
  payload: unknown,
  observedAt: string
): Promise<KnownAdapterPayload> {
  if (!Array.isArray(payload)) return { observations: [], schemaMatched: false };
  const rows = payload.map(recordOf);
  const allowedStatuses = new Set([0, 1, 2]);
  const allowedCategories = new Set([0, 1, 2]);
  const matching = rows.filter((row) =>
    typeof row.title === "string" && typeof row.status === "number" && allowedStatuses.has(row.status) &&
    typeof row.category === "number" && allowedCategories.has(row.category) && typeof row.start_date === "string"
  );
  if (rows.length > 0 && matching.length === 0) return { observations: [], schemaMatched: false };
  const now = Date.parse(observedAt);
  const recentResolutionCutoff = now - 7 * 24 * 60 * 60 * 1000;
  const relevant = matching.filter((row) => {
    const end = Date.parse(String(row.end_date ?? ""));
    const explicitlyResolved = Number(row.status) === 2;
    const ended = Number.isFinite(end) && end <= now;
    if (explicitlyResolved) {
      const timestamps = [end, Date.parse(String(row.publish_date ?? "")), Date.parse(String(row.start_date ?? ""))]
        .filter(Number.isFinite);
      const resolutionReference = timestamps.length ? Math.max(...timestamps) : NaN;
      return Number.isFinite(resolutionReference) && resolutionReference >= recentResolutionCutoff;
    }
    return !ended || end >= recentResolutionCutoff;
  });
  return {
    schemaMatched: true,
    observations: await Promise.all(relevant.map((row) => {
      const title = compact(String(row.title));
      const startedAt = isoOrNull(row.start_date);
      const endedAt = isoOrNull(row.end_date);
      const officialEndHasPassed = Boolean(endedAt && Date.parse(endedAt) <= now);
      const resolved = Number(row.status) === 2 || officialEndHasPassed;
      const planned = Number(row.category) !== 0 && (startedAt ? Date.parse(startedAt) > now : false);
      const status: CanonicalObservationStatus = resolved ? "resolved" : planned ? "planned" : "unplanned";
      return makeKnownObservation(source, {
        status,
        title,
        text: compact(`${title}. ${String(row.description ?? "")}`),
        location: operatorLocation(title),
        observedAt,
        startedAt,
        resolvedAt: resolved && officialEndHasPassed ? endedAt : null,
        publishedAt: isoOrNull(row.publish_date),
        raw: row
      });
    }))
  };
}

async function parsePrimeoPayload(
  source: SourceRegistryEntry,
  payload: unknown,
  observedAt: string
): Promise<KnownAdapterPayload> {
  const root = recordOf(payload);
  if (!Array.isArray(root.current) || !Array.isArray(root.done)) {
    return { observations: [], schemaMatched: false };
  }
  const current = root.current.map(recordOf);
  const done = root.done.map(recordOf);
  const allowedStatuses = new Set(["PROGRESS", "PLANNED", "RESOLVED"]);
  const matching = [...current, ...done].filter((row) =>
    typeof row.status === "string" && allowedStatuses.has(row.status) && typeof row.title === "string"
  );
  if ((current.length > 0 || done.length > 0) && matching.length === 0) {
    return { observations: [], schemaMatched: false };
  }
  const matchingCurrent = new Set(matching);
  const active = current.filter((row) => matchingCurrent.has(row) && (row.status === "PROGRESS" || row.status === "PLANNED"));
  const resolved = done.filter((row) => matchingCurrent.has(row) && row.status === "RESOLVED");
  return {
    schemaMatched: true,
    observations: await Promise.all([...active, ...resolved].map((row) => {
      const titleLocation = compact(String(row.title));
      const status: CanonicalObservationStatus = row.status === "PLANNED"
        ? "planned"
        : row.status === "RESOLVED"
          ? "resolved"
          : "unplanned";
      const title = status === "planned"
        ? `Geplanter Stromunterbruch in ${titleLocation}`
        : status === "resolved"
          ? `Behobener Stromausfall in ${titleLocation}`
        : `Stromausfall in ${titleLocation}`;
      return makeKnownObservation(source, {
        status,
        title,
        text: title,
        location: operatorLocation(titleLocation) ?? (compact(titleLocation).slice(0, 120) || null),
        observedAt,
        startedAt: isoOrNull(row.from),
        resolvedAt: isoOrNull(row.to),
        raw: row
      });
    }))
  };
}

async function parseRomandePayload(
  source: SourceRegistryEntry,
  payload: unknown,
  observedAt: string
): Promise<KnownAdapterPayload> {
  if (!Array.isArray(payload)) return { observations: [], schemaMatched: false };
  const rows = payload.map(recordOf);
  const allowedGenres = new Set(["coupure", "panne"]);
  const matching = rows.filter((row) =>
    typeof row.genre === "string" && allowedGenres.has(row.genre) &&
    typeof row.date_debut === "string" && recordOf(row.geojson).type === "FeatureCollection"
  );
  if (rows.length > 0 && matching.length === 0) return { observations: [], schemaMatched: false };
  const now = Date.parse(observedAt);
  const currentOrUpcoming = matching.filter((row) => {
    const end = Date.parse(String(row.date_fin ?? ""));
    return !Number.isFinite(end) || end >= now;
  });
  return {
    schemaMatched: true,
    observations: await Promise.all(currentOrUpcoming.map(async (row) => {
      const planned = row.genre === "coupure";
      const status: CanonicalObservationStatus = planned ? "planned" : "unplanned";
      const geojson = recordOf(row.geojson);
      const features = Array.isArray(geojson.features) ? geojson.features.map(recordOf) : [];
      const properties = recordOf(features[0]?.properties);
      const centroid = geojsonCentroid(row.geojson);
      const location = await resolveIncidentLocation({
        namedLocation: stringOrNull(properties.LOCATION ?? properties.LIEU ?? row.location),
        latitude: centroid?.latitude,
        longitude: centroid?.longitude
      });
      const title = planned ? "Interruption de courant planifiée" : "Panne de courant";
      const cause = stringOrNull(properties.CAUSE);
      return makeKnownObservation(source, {
        status,
        title: location ? `${title} à ${location}` : title,
        text: compact(`${title}. ${cause ? `Cause: ${cause}.` : ""}`),
        location,
        observedAt,
        startedAt: isoOrNull(row.date_debut),
        resolvedAt: isoOrNull(row.date_fin),
        raw: row
      });
    }))
  };
}

async function parseEwzHtml(
  source: SourceRegistryEntry,
  html: string,
  observedAt: string
): Promise<KnownAdapterPayload> {
  const matches = [...html.matchAll(/<ewz-incident-messages\b([^>]*)>([\s\S]*?)<\/ewz-incident-messages>/gi)];
  if (matches.length === 0) return { observations: [], schemaMatched: false };
  const observations: SourceObservationInput[] = [];
  for (const match of matches) {
    const heading = compact(match[1]?.match(/\btitle=["']([^"']+)["']/i)?.[1] ?? "Stromausfall");
    const body = compact(stripHtml(match[2] ?? ""));
    const combined = compact(`${heading}. ${body}`);
    const status = inferStatus(combined, parseConfig(source));
    if (status === "irrelevant" || status === "unverified" || status === "historical") continue;
    const headingLocation = heading.replace(/^Stromausfall\s+/i, "").trim();
    observations.push(await makeKnownObservation(source, {
      status,
      title: titleFromText(combined, heading),
      text: combined,
      location: explicitLocation(body) ?? (headingLocation || null),
      observedAt,
      raw: { component: "ewz-incident-messages", title: heading, excerpt: body.slice(0, 2000) }
    }));
  }
  return { observations, schemaMatched: true };
}

async function parseKnownApiPayload(
  source: SourceRegistryEntry,
  payload: unknown,
  observedAt: string
): Promise<KnownAdapterPayload | null> {
  if (source.source_key === "bkw-outage") return parseBkwPayload(source, payload, observedAt);
  if (source.source_key === "sak-netzstatus") return parseSakPayload(source, payload, observedAt);
  if (source.source_key === "romande-energie-pannes") return parseRomandePayload(source, payload, observedAt);
  if (source.source_key === "primeo-netzstatus") return parsePrimeoPayload(source, payload, observedAt);
  return null;
}

async function fetchText(url: string): Promise<{ text: string; error: string | null }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "swiss-power-outage-radar/0.3",
      "Accept": "text/html,application/rss+xml,application/json,text/plain;q=0.9,*/*;q=0.1"
    }
  });
  const text = await response.text().catch(() => "");
  if (!response.ok) return { text, error: `HTTP ${response.status}` };
  return { text, error: null };
}

async function fetchFirecrawlMarkdown(
  env: Pick<Env, "FIRECRAWL_API_KEY">,
  url: string
): Promise<{ markdown: string; error: string | null }> {
  if (!env.FIRECRAWL_API_KEY) return { markdown: "", error: "FIRECRAWL_API_KEY missing" };
  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true
    })
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) return { markdown: "", error: `Firecrawl HTTP ${response.status}` };
  const data = payload.data as Record<string, unknown> | undefined;
  const markdown = typeof data?.markdown === "string" ? data.markdown : "";
  return markdown.trim() ? { markdown, error: null } : { markdown: "", error: "Firecrawl markdown empty" };
}

function jsonItems(payload: unknown, config: AdapterConfig): unknown[] {
  let current = payload;
  for (const segment of (config.json_path ?? "").split(".").filter(Boolean)) {
    if (!current || typeof current !== "object") return [];
    current = (current as Record<string, unknown>)[segment];
  }
  if (Array.isArray(current)) return current;
  if (current && typeof current === "object") {
    const record = current as Record<string, unknown>;
    for (const key of ["items", "data", "events", "outages"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return [];
}

export async function fetchSourceObservations(
  env: Pick<Env, "FIRECRAWL_API_KEY">,
  source: SourceRegistryEntry,
  observedAt = new Date().toISOString()
): Promise<AdapterResult> {
  const config = parseConfig(source);
  try {
    const knownApiUrl = config.api_url;
    if (knownApiUrl && ["bkw-outage", "sak-netzstatus", "romande-energie-pannes", "primeo-netzstatus"].includes(source.source_key)) {
      const fetched = await fetchText(knownApiUrl);
      if (fetched.error) {
        return { observations: [], error: fetched.error, usedFirecrawl: false, transportStatus: "error", parserStatus: "error" };
      }
      let payload: unknown;
      try {
        payload = JSON.parse(fetched.text);
      } catch {
        return {
          observations: [],
          error: "parser_invalid_json: operator API did not return JSON",
          usedFirecrawl: false,
          transportStatus: "ok",
          parserStatus: "error"
        };
      }
      const parsed = await parseKnownApiPayload(source, payload, observedAt);
      if (!parsed?.schemaMatched) {
        return {
          observations: [],
          error: "parser_schema_changed: operator API no longer matches the verified contract",
          usedFirecrawl: false,
          transportStatus: "ok",
          parserStatus: "needs_adapter"
        };
      }
      return {
        observations: parsed.observations,
        error: null,
        usedFirecrawl: false,
        transportStatus: "ok",
        parserStatus: parsed.observations.length > 0 ? "ready" : "no_current_outage"
      };
    }

    if (source.source_type === "rss" || source.source_type === "google_alert") {
      const fetched = await fetchText(source.url);
      if (fetched.error) return { observations: [], error: fetched.error, usedFirecrawl: false, transportStatus: "error", parserStatus: "error" };
      const items = parseRssFeed(fetched.text, config.language ?? "de");
      return {
        observations: await Promise.all(
          items.map((item) =>
            makeSourceObservationFromText(source, {
              title: item.title,
              url: item.url,
              text: [item.title, item.source, item.snippet].filter(Boolean).join(". "),
              locationText: null,
              publishedAt: item.published_at,
              raw: item,
              observedAt
            })
          )
        ),
        error: null,
        usedFirecrawl: false,
        transportStatus: "ok",
        parserStatus: "ready"
      };
    }

    if (source.source_type === "json_api") {
      const fetched = await fetchText(source.url);
      if (fetched.error) return { observations: [], error: fetched.error, usedFirecrawl: false, transportStatus: "error", parserStatus: "error" };
      const payload = JSON.parse(fetched.text) as unknown;
      const observations = await Promise.all(
        jsonItems(payload, config).map((item) => {
          const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          const title = compact(String(record.title ?? record.name ?? record.message ?? "Netzbetreiber-Meldung"));
          return makeSourceObservationFromText(source, {
            title,
            url: typeof record.url === "string" ? record.url : source.url,
            text: compact(String(record.description ?? record.summary ?? record.text ?? title)),
            locationText: typeof record.location === "string" ? record.location : null,
            publishedAt: typeof record.published_at === "string" ? record.published_at : null,
            raw: item,
            observedAt
          });
        })
      );
      return { observations, error: null, usedFirecrawl: false, transportStatus: "ok", parserStatus: "ready" };
    }

    const fetched = await fetchText(source.url);
    if (source.source_key === "ewz-stoerungen" && !fetched.error) {
      const parsed = await parseEwzHtml(source, fetched.text, observedAt);
      if (!parsed.schemaMatched) {
        return {
          observations: [],
          error: "parser_schema_changed: ewz-incident-messages component missing",
          usedFirecrawl: false,
          transportStatus: "ok",
          parserStatus: "needs_adapter"
        };
      }
      return {
        observations: parsed.observations,
        error: null,
        usedFirecrawl: false,
        transportStatus: "ok",
        parserStatus: parsed.observations.length > 0 ? "ready" : "no_current_outage"
      };
    }
    let text = compact(`${stripHtml(fetched.text)} ${dataAttributeText(fetched.text)}`);
    let usedFirecrawl = false;
    if (
      (fetched.error || text.length < 80) &&
      source.firecrawl_enabled === 1 &&
      source.priority >= 85 &&
      env.FIRECRAWL_API_KEY
    ) {
      const firecrawl = await fetchFirecrawlMarkdown(env, source.url);
      if (!firecrawl.error) {
        text = firecrawl.markdown;
        usedFirecrawl = true;
      }
    }
    if (fetched.error && !usedFirecrawl) {
      return { observations: [], error: fetched.error, usedFirecrawl: false, transportStatus: "error", parserStatus: "error" };
    }
    if (!text.trim()) {
      return {
        observations: [],
        error: "parser_empty_content: direct HTML returned no extractable text",
        usedFirecrawl,
        transportStatus: "ok",
        parserStatus: "error"
      };
    }
    const status = inferStatus(text, config);
    const structured = ["planned", "unplanned", "resolved"].includes(status)
      ? await extractStructuredHtmlOutageItems(source, fetched.text, observedAt)
      : [];
    if (structured.length > 0) {
      return {
        observations: structured,
        error: null,
        usedFirecrawl,
        transportStatus: "ok",
        parserStatus: "ready"
      };
    }
    if (requiresItemLevelAdapter(source, config, status)) {
      return {
        observations: [],
        error: "parser_needs_adapter: item-level extraction required for non-negative status",
        usedFirecrawl,
        transportStatus: "ok",
        parserStatus: "needs_adapter"
      };
    }
    const title = status === "irrelevant" ? `${source.operator_name}: keine aktuelle Stromstörung` : titleFromText(text, `${source.operator_name}: Stromnetz-Meldung`);
    return {
      observations: [
        await makeSourceObservationFromText(source, {
          title,
          text,
          locationText: likelyLocation(text, source),
          raw: { excerpt: compact(text).slice(0, 2000), usedFirecrawl },
          observedAt
        })
      ],
      error: null,
      usedFirecrawl,
      transportStatus: "ok",
      parserStatus: "no_current_outage"
    };
  } catch (error) {
    return {
      observations: [],
      error: error instanceof Error ? error.message : String(error),
      usedFirecrawl: false,
      transportStatus: "error",
      parserStatus: "error"
    };
  }
}

export async function observationHashForAlert(observation: SourceObservationInput): Promise<string> {
  return await itemHash({
    title: observation.title,
    url: observation.url
  });
}
