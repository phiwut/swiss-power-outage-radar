import { canonicalLocation, normalizeLocation } from "./events";

interface GeoAdminResult {
  attrs?: {
    label?: string;
    detail?: string;
    origin?: string;
  };
}

interface GeoAdminResponse {
  results?: GeoAdminResult[];
}

export interface SwissLocationNormalization {
  normalizedLocation: string;
  label: string | null;
  source: "geo.admin.ch" | "fallback";
  reason: string;
}

function hasMultipleConcretePlaces(location: string): boolean {
  const parts = location
    .split(",")
    .map((part) => canonicalLocation(part))
    .filter((part) => part && part !== "unknown");
  return new Set(parts).size > 1;
}

function extractLabel(label: string | undefined, detail: string | undefined): string {
  const bold = label?.match(/<b>(.*?)<\/b>/i)?.[1];
  const raw = bold || label || detail || "";
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d{4}\b/g, " ")
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function normalizeSwissLocation(
  location: string | null | undefined
): Promise<SwissLocationNormalization> {
  const fallback = canonicalLocation(location);
  const raw = (location ?? "").trim();
  if (!raw || fallback === "unknown") {
    return { normalizedLocation: fallback, label: null, source: "fallback", reason: "missing" };
  }
  if (hasMultipleConcretePlaces(raw)) {
    return { normalizedLocation: fallback, label: raw, source: "fallback", reason: "multi_place" };
  }

  const url = new URL("https://api3.geo.admin.ch/rest/services/ech/SearchServer");
  url.searchParams.set("searchText", raw);
  url.searchParams.set("type", "locations");
  url.searchParams.set("origins", "gg25,zipcode,district,kantone");
  url.searchParams.set("limit", "3");
  url.searchParams.set("returnGeometry", "false");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "swiss-power-outage-radar/0.1" },
      signal: controller.signal
    });
    if (!response.ok) {
      return {
        normalizedLocation: fallback,
        label: null,
        source: "fallback",
        reason: `geo_http_${response.status}`
      };
    }

    const data = (await response.json()) as GeoAdminResponse;
    const result = data.results?.[0];
    const label = extractLabel(result?.attrs?.label, result?.attrs?.detail);
    const normalized = canonicalLocation(label) || normalizeLocation(label);
    if (!label || normalized === "unknown") {
      return { normalizedLocation: fallback, label: null, source: "fallback", reason: "geo_empty" };
    }

    return {
      normalizedLocation: normalized,
      label,
      source: "geo.admin.ch",
      reason: result?.attrs?.origin ?? "match"
    };
  } catch (error) {
    return {
      normalizedLocation: fallback,
      label: null,
      source: "fallback",
      reason: error instanceof Error ? error.message : "geo_error"
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
