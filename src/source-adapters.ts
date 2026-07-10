import { normalizeLocation } from "./events";
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
}

export interface AdapterResult {
  observations: SourceObservationInput[];
  error: string | null;
  usedFirecrawl: boolean;
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
  if (config.allow_generic_positive === true) return false;
  return true;
}

function likelyLocation(text: string, source: SourceRegistryEntry): string | null {
  if (inferStatus(text, parseConfig(source)) === "irrelevant") return null;
  const explicit = text.match(/\b(?:in|für|fuer|betroffen(?:e)?|commune de|à|a)\s+([A-ZÄÖÜ][A-Za-zÀ-ÿÄÖÜäöü' -]{2,60})/);
  if (explicit?.[1]) return compact(explicit[1].replace(/\b(?:ist|sind|wurde|wurden|kam|kommt)\b.*$/i, ""));
  if (source.operator_name.toLowerCase() === "ewz") return "Zürich";
  if (source.operator_name.toLowerCase().includes("bern")) return "Bern";
  return null;
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
  }
): Promise<SourceObservationInput> {
  const config = parseConfig(source);
  const fullText = compact(patch.text);
  const evidence = fullText.slice(0, 1200) || patch.title;
  const status = inferStatus(`${patch.title}. ${fullText}`, config);
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
    startedAt: null,
    resolvedAt: status === "resolved" ? observedAt : null,
    observedAt,
    publishedAt: patch.publishedAt ?? null,
    evidenceExcerpt: evidence,
    rawPayloadJson: patch.raw ? JSON.stringify(patch.raw).slice(0, 5000) : null,
    extractorVersion: SOURCE_EXTRACTOR_VERSION,
    confidence: status === "irrelevant" ? 0 : source.trust_level === "official" ? 0.92 : 0.72,
    independenceKey: hostOf(url)
  };
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
    if (source.source_type === "rss" || source.source_type === "google_alert") {
      const fetched = await fetchText(source.url);
      if (fetched.error) return { observations: [], error: fetched.error, usedFirecrawl: false };
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
        usedFirecrawl: false
      };
    }

    if (source.source_type === "json_api") {
      const fetched = await fetchText(source.url);
      if (fetched.error) return { observations: [], error: fetched.error, usedFirecrawl: false };
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
      return { observations, error: null, usedFirecrawl: false };
    }

    const fetched = await fetchText(source.url);
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
      return { observations: [], error: fetched.error, usedFirecrawl: false };
    }
    if (!text.trim()) {
      return {
        observations: [],
        error: "parser_empty_content: direct HTML returned no extractable text",
        usedFirecrawl
      };
    }
    const status = inferStatus(text, config);
    if (requiresItemLevelAdapter(source, config, status)) {
      return {
        observations: [],
        error: "parser_needs_adapter: item-level extraction required for non-negative status",
        usedFirecrawl
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
      usedFirecrawl
    };
  } catch (error) {
    return {
      observations: [],
      error: error instanceof Error ? error.message : String(error),
      usedFirecrawl: false
    };
  }
}

export async function observationHashForAlert(observation: SourceObservationInput): Promise<string> {
  return await itemHash({
    title: observation.title,
    url: observation.url
  });
}
