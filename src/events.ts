import type { AiClassification, OutageEvent, StoredAlertItem } from "./types";

const GENERIC_LOCATIONS = new Set([
  "schweiz",
  "suisse",
  "svizzera",
  "switzerland",
  "unbekannt",
  "unknown",
  "nicht eindeutig erkannt",
  "ort unbekannt"
]);

const OUTAGE_TERMS = [
  "stromausfall",
  "stromunterbruch",
  "netzausfall",
  "netzstoerung",
  "netzstörung",
  "panne courant",
  "coupure courant",
  "interruption courant",
  "guasto elettrico",
  "interruzione corrente",
  "blackout"
];

export function normalizeLocation(location: string | null | undefined): string {
  const normalized = (location ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || "unknown";
}

export function canAutoMergeLocation(normalizedLocation: string): boolean {
  return normalizedLocation !== "unknown" && !GENERIC_LOCATIONS.has(normalizedLocation);
}

export function canCreateEvent(classification: AiClassification): boolean {
  if (!classification.is_relevant) return false;
  if (classification.confidence < 0.65) return false;
  if (!(classification.country === "CH" || classification.country === "unknown")) return false;
  if (classification.event_type === "not_relevant") return false;
  if (classification.event_type === "unclear" && classification.confidence < 0.8) return false;
  return true;
}

function compatibleEventType(left: string | null, right: string): boolean {
  if (!left) return false;
  if (left === right) return true;
  return (
    (left === "power_outage" && right === "grid_disturbance") ||
    (left === "grid_disturbance" && right === "power_outage")
  );
}

function timeScore(item: StoredAlertItem, event: OutageEvent): number {
  const itemTime = new Date(item.published_at ?? item.fetched_at).getTime();
  const eventTime = new Date(event.first_seen_at).getTime();
  if (!Number.isFinite(itemTime) || !Number.isFinite(eventTime)) return 0;

  const hours = Math.abs(itemTime - eventTime) / 36e5;
  if (hours <= 12) return 10;
  if (hours <= 48) return 5;
  return 0;
}

function containsOutageTerm(text: string): boolean {
  const normalized = normalizeLocation(text);
  return OUTAGE_TERMS.some((term) => normalized.includes(normalizeLocation(term)));
}

function titleTermScore(item: StoredAlertItem, event: OutageEvent): number {
  return containsOutageTerm(item.title) && containsOutageTerm(event.title) ? 10 : 0;
}

export function scoreEventCandidate(
  event: OutageEvent,
  item: StoredAlertItem,
  classification: AiClassification,
  normalizedLocation: string
): number {
  let score = 0;
  const eventLocation = event.normalized_location ?? "unknown";

  if (eventLocation === normalizedLocation) {
    score += 50;
  } else if (
    eventLocation !== "unknown" &&
    normalizedLocation !== "unknown" &&
    (eventLocation.includes(normalizedLocation) || normalizedLocation.includes(eventLocation))
  ) {
    score += 20;
  }

  if (compatibleEventType(event.event_type, classification.event_type)) score += 10;
  score += timeScore(item, event);
  score += titleTermScore(item, event);

  return score;
}

export function makeEventTitle(classification: AiClassification): string {
  const location = classification.location_text.trim() || "Ort unklar";
  return `Möglicher Stromausfall / Netzunterbruch: ${location}`;
}
