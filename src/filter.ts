import type { NormalizedRssItem } from "./types";

const POSITIVE_TERMS = [
  "stromausfall",
  "stromunterbruch",
  "netzausfall",
  "netzstörung",
  "netzstoerung",
  "netzunterbruch",
  "panne de courant",
  "coupure de courant",
  "interruption de courant",
  "panne electrique",
  "panne électrique",
  "guasto elettrico",
  "guasto alla rete",
  "interruzione di corrente",
  "blackout"
];

const NEGATIVE_TERMS = [
  "ukraine",
  "russland",
  "russisch",
  "moskau",
  "gaza",
  "israel",
  "film",
  "gaming",
  "sport",
  "ratgeber",
  "blackout vorsorge",
  "blackout-vorsorge"
];

export interface CheapFilterResult {
  candidate: boolean;
  reason: string;
}

export function normalizeForFilter(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cheapFilterItem(item: NormalizedRssItem): CheapFilterResult {
  const haystack = normalizeForFilter(
    [item.title, item.source, item.snippet, item.url].filter(Boolean).join(" ")
  );
  const hasPositive = POSITIVE_TERMS.some((term) =>
    haystack.includes(normalizeForFilter(term))
  );

  if (!hasPositive) {
    return { candidate: false, reason: "Keine Stromausfall-Begriffe gefunden." };
  }

  const negative = NEGATIVE_TERMS.find((term) =>
    haystack.includes(normalizeForFilter(term))
  );

  if (negative) {
    return { candidate: false, reason: `Negativer Begriff gefunden: ${negative}` };
  }

  return { candidate: true, reason: "Stromausfall-Begriff ohne Ausschluss gefunden." };
}
