import {
  createGeoSyncRun,
  finishGeoSyncRun,
  getAlertItemById,
  getGeoAliasCatalog,
  getLatestSourceSnapshot,
  getOutageEvent,
  getOutageSourceById,
  getPlaceExtractionTargets,
  refreshEventPlaces,
  replaceSourcePlaceMentions,
  upsertGeoPlace,
  upsertGeoPlaceAlias
} from "./db";
import type {
  Env,
  EventPlaceRole,
  GeoAliasCatalogRow,
  GeoPlaceType,
  OutageEvent,
  OutageSource,
  SourceSnapshot,
  StoredAlertItem
} from "./types";

const OPENPLZ_BASE = "https://openplzapi.org/ch";

export function normalizePlaceText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsTerm(normalizedText: string, normalizedTerm: string): boolean {
  if (!normalizedTerm || normalizedTerm.length < 3) return false;
  return (` ${normalizedText} `).includes(` ${normalizedTerm} `);
}

function evidenceQuote(rawText: string, matchedText: string): string {
  const normalizedRaw = normalizePlaceText(rawText);
  const normalizedMatch = normalizePlaceText(matchedText);
  const index = normalizedRaw.indexOf(normalizedMatch);
  if (index < 0) return rawText.replace(/\s+/g, " ").trim().slice(0, 280);
  const roughStart = Math.max(0, index - 90);
  const roughEnd = Math.min(rawText.length, index + matchedText.length + 170);
  return rawText.slice(roughStart, roughEnd).replace(/\s+/g, " ").trim();
}

function roleForMatch(placeType: GeoPlaceType, quote: string): EventPlaceRole {
  const normalized = normalizePlaceText(quote);
  if (placeType === "canton" || placeType === "district") return "context";
  if (/\b(netzgebiet|versorgungsgebiet|betreibergebiet)\b/.test(normalized)) return "operator_area";
  if (/\b(region|umgebung|bezirk|kanton)\b/.test(normalized)) return "possibly_affected";
  return "affected";
}

function confidenceForMatch(row: GeoAliasCatalogRow, quote: string): number {
  const hasPostcode = row.postcode && quote.includes(row.postcode);
  if (row.place_type === "locality" && hasPostcode) return 0.93;
  if (row.place_type === "locality") return 0.84;
  if (row.place_type === "municipality") return 0.78;
  if (row.place_type === "street") return 0.74;
  if (row.place_type === "district") return 0.55;
  return 0.45;
}

export function extractPlaceMentions(rawText: string, catalog: GeoAliasCatalogRow[]) {
  const normalizedText = normalizePlaceText(rawText);
  const bestByPlace = new Map<number, {
    matchedText: string;
    placeId: number;
    placeType: GeoPlaceType;
    role: EventPlaceRole;
    confidence: number;
    matchMethod: string;
    evidenceQuote: string;
  }>();

  for (const row of catalog) {
    if (!containsTerm(normalizedText, row.normalized_alias)) continue;
    const quote = evidenceQuote(rawText, row.alias);
    const role = roleForMatch(row.place_type, quote);
    const confidence = confidenceForMatch(row, quote);
    const existing = bestByPlace.get(row.id);
    if (existing && existing.confidence >= confidence) continue;
    bestByPlace.set(row.id, {
      matchedText: row.alias,
      placeId: row.id,
      placeType: row.place_type,
      role,
      confidence,
      matchMethod: row.postcode && quote.includes(row.postcode) ? "postal_code_alias" : "alias",
      evidenceQuote: quote
    });
  }

  return [...bestByPlace.values()]
    .filter((mention) => mention.confidence >= 0.45)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12);
}

export async function extractAndStoreSourcePlaces(
  env: Pick<Env, "DB">,
  input: {
    event: OutageEvent;
    source: OutageSource;
    alertItem?: StoredAlertItem | null;
    snapshot?: SourceSnapshot | null;
  }
) {
  const catalog = await getGeoAliasCatalog(env.DB);
  if (!catalog.length) return { mentions: [], eventPlaces: [] };

  const rawText = [
    input.source.source_title,
    input.source.source_name,
    input.alertItem?.snippet,
    input.alertItem?.summary,
    input.snapshot?.markdown_excerpt,
    input.event.location_text,
    input.event.summary
  ]
    .filter(Boolean)
    .join("\n");

  const mentions = extractPlaceMentions(rawText, catalog);
  await replaceSourcePlaceMentions(env.DB, {
    eventId: input.event.id,
    sourceId: input.source.id,
    alertItemId: input.alertItem?.id ?? input.source.alert_item_id ?? null,
    rawText,
    mentions
  });
  const eventPlaces = await refreshEventPlaces(env.DB, input.event.id);
  return { mentions, eventPlaces };
}

interface OpenPlzLocality {
  postalCode?: string;
  name?: string;
  key?: string;
  commune?: { key?: string; name?: string; shortName?: string };
  district?: { key?: string; name?: string; shortName?: string };
  canton?: { key?: string; name?: string; shortName?: string };
}

function aliasRows(inputValues: Iterable<string | undefined | null>): Array<{ alias: string; language?: string | null }> {
  const aliases = new Set<string>();
  for (const value of inputValues) {
    const trimmed = value?.trim();
    if (trimmed) aliases.add(trimmed);
  }
  return [...aliases].map((alias) => ({ alias, language: null }));
}

function aliasesForCanton(row: OpenPlzLocality): Array<{ alias: string; language?: string | null }> {
  const values = new Set<string>();
  if (row.canton?.shortName) values.add(row.canton.shortName);
  if (row.canton?.name) {
    for (const part of row.canton.name.split("/").map((part) => part.trim()).filter(Boolean)) {
      values.add(part);
      values.add(`Kanton ${part}`);
    }
  }
  return [...values].map((alias) => ({ alias, language: null }));
}

function aliasesForMunicipality(row: OpenPlzLocality): Array<{ alias: string; language?: string | null }> {
  return aliasRows([
    row.commune?.name,
    row.commune?.shortName,
    row.commune?.name ? `Gemeinde ${row.commune.name}` : null
  ]);
}

function aliasesForLocality(row: OpenPlzLocality): Array<{ alias: string; language?: string | null }> {
  return aliasRows([
    row.name,
    row.postalCode && row.name ? `${row.postalCode} ${row.name}` : null
  ]);
}

async function fetchOpenPlzPage(cantonKey: string, page: number, pageSize: number) {
  const url = new URL(`${OPENPLZ_BASE}/Cantons/${encodeURIComponent(cantonKey)}/Localities`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  const response = await fetch(url.toString(), {
    headers: { "Accept": "application/json", "User-Agent": "outage.ch geo-sync/1.0" }
  });
  if (!response.ok) throw new Error(`OpenPLZ ${response.status}`);
  const rows = await response.json<OpenPlzLocality[]>();
  return {
    rows,
    totalPages: Number(response.headers.get("x-total-pages") ?? page),
    page: Number(response.headers.get("x-page") ?? page)
  };
}

async function fetchOpenPlzLocalitiesByName(name: string, pageSize: number) {
  const url = new URL(`${OPENPLZ_BASE}/Localities`);
  url.searchParams.set("name", name);
  url.searchParams.set("pageSize", String(pageSize));
  const response = await fetch(url.toString(), {
    headers: { "Accept": "application/json", "User-Agent": "outage.ch geo-sync/1.0" }
  });
  if (!response.ok) throw new Error(`OpenPLZ ${response.status}`);
  return await response.json<OpenPlzLocality[]>();
}

export async function syncOpenPlzLocalities(
  env: Pick<Env, "DB">,
  input: { cantonKey?: string; name?: string; startPage?: number; maxPages?: number; pageSize?: number }
) {
  const startedAt = new Date().toISOString();
  const startPage = Math.max(1, input.startPage ?? 1);
  const name = input.name?.trim();
  const maxPages = name ? 1 : Math.max(1, Math.min(1, input.maxPages ?? 1));
  const pageSize = Math.max(1, Math.min(name ? 10 : 5, input.pageSize ?? (name ? 10 : 5)));
  const scope = name
    ? `ch:name:${name}`
    : `ch:canton:${input.cantonKey}:pages:${startPage}-${startPage + maxPages - 1}`;
  const runId = await createGeoSyncRun(env.DB, { provider: "openplz", scope, startedAt });
  let itemsSeen = 0;
  let itemsUpserted = 0;

  try {
    for (let page = startPage; page < startPage + maxPages; page += 1) {
      if (!name && !input.cantonKey) throw new Error("cantonKey or name is required");
      const payload = name
        ? { rows: await fetchOpenPlzLocalitiesByName(name, pageSize), page: 1, totalPages: 1 }
        : await fetchOpenPlzPage(input.cantonKey as string, page, pageSize);
      if (!payload.rows.length) break;
      for (const row of payload.rows) {
        if (!row.name || !row.postalCode) continue;
        itemsSeen += 1;
        const cantonExternalId = `openplz:ch:canton:${row.canton?.key ?? input.cantonKey}`;
        const municipalityExternalId = row.commune?.key ? `openplz:ch:municipality:${row.commune.key}` : null;

        if (row.canton?.key && row.canton.name) {
          const canton = await upsertGeoPlace(env.DB, {
            externalId: cantonExternalId,
            cantonKey: row.canton.key,
            cantonCode: row.canton.shortName ?? null,
            cantonName: row.canton.name,
            placeType: "canton",
            canonicalName: row.canton.shortName ? `${row.canton.name} (${row.canton.shortName})` : row.canton.name,
            normalizedName: normalizePlaceText(row.canton.name),
            source: "openplz"
          });
          for (const alias of aliasesForCanton(row)) {
            await upsertGeoPlaceAlias(env.DB, {
              placeId: canton.id,
              alias: alias.alias,
              normalizedAlias: normalizePlaceText(alias.alias),
              language: alias.language,
              source: "openplz"
            });
          }
        }

        if (municipalityExternalId && row.commune?.name) {
          const municipality = await upsertGeoPlace(env.DB, {
            externalId: municipalityExternalId,
            cantonKey: row.canton?.key ?? null,
            cantonCode: row.canton?.shortName ?? null,
            cantonName: row.canton?.name ?? null,
            districtKey: row.district?.key ?? null,
            districtName: row.district?.name ?? null,
            municipalityKey: row.commune.key ?? null,
            municipalityName: row.commune.name,
            placeType: "municipality",
            canonicalName: row.commune.name,
            normalizedName: normalizePlaceText(row.commune.name),
            parentExternalId: cantonExternalId,
            source: "openplz"
          });
          for (const alias of aliasesForMunicipality(row)) {
            await upsertGeoPlaceAlias(env.DB, {
              placeId: municipality.id,
              alias: alias.alias,
              normalizedAlias: normalizePlaceText(alias.alias),
              language: alias.language,
              source: "openplz"
            });
          }
        }

        const locality = await upsertGeoPlace(env.DB, {
          externalId: `openplz:ch:locality:${row.postalCode}:${row.name}:${row.commune?.key ?? "unknown"}`,
          cantonKey: row.canton?.key ?? null,
          cantonCode: row.canton?.shortName ?? null,
          cantonName: row.canton?.name ?? null,
          districtKey: row.district?.key ?? null,
          districtName: row.district?.name ?? null,
          municipalityKey: row.commune?.key ?? null,
          municipalityName: row.commune?.name ?? null,
          localityKey: row.key ?? null,
          localityName: row.name,
          postcode: row.postalCode,
          placeType: "locality",
          canonicalName: `${row.name} ${row.postalCode}`,
          normalizedName: normalizePlaceText(`${row.name} ${row.postalCode}`),
          parentExternalId: municipalityExternalId,
          source: "openplz"
        });
        for (const alias of aliasesForLocality(row)) {
          await upsertGeoPlaceAlias(env.DB, {
            placeId: locality.id,
            alias: alias.alias,
            normalizedAlias: normalizePlaceText(alias.alias),
            language: alias.language,
            source: "openplz"
          });
        }
        itemsUpserted += 1;
      }
      if (payload.page >= payload.totalPages) break;
    }
    await finishGeoSyncRun(env.DB, runId, { status: "success", itemsSeen, itemsUpserted });
    return { runId, status: "success", itemsSeen, itemsUpserted };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishGeoSyncRun(env.DB, runId, { status: "failed", itemsSeen, itemsUpserted, error: message });
    throw error;
  }
}

export async function backfillSourcePlaceMentions(
  env: Pick<Env, "DB">,
  input: { limit?: number; eventId?: number | null } = {}
) {
  const limit = Math.max(1, Math.min(100, input.limit ?? 20));
  const targets = await getPlaceExtractionTargets(env.DB, limit, input.eventId ?? null);
  let processed = 0;
  let mentions = 0;
  const errors: string[] = [];

  for (const target of targets) {
    try {
      const [event, source, alertItem, snapshot] = await Promise.all([
        getOutageEvent(env.DB, target.outage_event_id),
        getOutageSourceById(env.DB, target.source_id),
        target.alert_item_id ? getAlertItemById(env.DB, target.alert_item_id) : Promise.resolve(null),
        getLatestSourceSnapshot(env.DB, target.source_id)
      ]);
      if (!event || !source) continue;
      const result = await extractAndStoreSourcePlaces(env, { event, source, alertItem, snapshot });
      processed += 1;
      mentions += result.mentions.length;
    } catch (error) {
      errors.push(`source ${target.source_id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { processed, mentions, errors };
}
