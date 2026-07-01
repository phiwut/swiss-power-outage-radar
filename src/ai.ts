import type {
  AiClassification,
  AiClassificationResult,
  Env,
  MergeAssessment,
  NormalizedRssItem,
  OutageEvent,
  ResearchAssessment
} from "./types";
import { cheapFilterItem } from "./filter";

const MODEL = "@cf/ibm-granite/granite-4.0-h-micro";

function promptForItem(item: NormalizedRssItem): string {
  return `Du bist ein Schweizer Stromausfall-Monitoring-Assistent.

Analysiere diese Google-Alert-Meldung.

Titel:
${item.title}

Quelle:
${item.source ?? ""}

Snippet:
${item.snippet ?? ""}

URL:
${item.url}

Aufgabe:

1. Ist dies wahrscheinlich eine konkrete Meldung über einen Stromausfall, Stromunterbruch, Netzausfall oder eine Netzstörung?
2. Betrifft es wahrscheinlich die Schweiz?
3. Welcher Ort oder Kanton ist erkennbar?
4. Fasse die Meldung in 2-4 Sätzen sachlich zusammen.
5. Nenne, warum sie relevant oder nicht relevant ist.

Antworte ausschliesslich als valides JSON:

{
"is_relevant": true,
"confidence": 0.0,
"country": "CH",
"location_text": "",
"event_type": "power_outage",
"summary": "",
"reason": ""
}

Zulässige Werte:
country: "CH", "other", "unknown"
event_type: "power_outage", "grid_disturbance", "planned_outage", "unclear", "not_relevant"
confidence: Zahl zwischen 0 und 1`;
}

function extractResponseText(response: unknown): string {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object") return JSON.stringify(response);

  const record = response as Record<string, unknown>;
  if (typeof record.response === "string") return record.response;
  if (typeof record.result === "string") return record.result;
  if (Array.isArray(record.choices)) {
    const first = record.choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    if (typeof message?.content === "string") return message.content;
  }

  return JSON.stringify(response);
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return JSON.parse(trimmed);

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("AI response did not contain JSON");
}

function validateClassification(value: unknown): AiClassification {
  if (!value || typeof value !== "object") {
    throw new Error("AI JSON is not an object");
  }

  const record = value as Record<string, unknown>;
  const country = record.country;
  const eventType = record.event_type;
  const confidence = Number(record.confidence);

  if (typeof record.is_relevant !== "boolean") throw new Error("is_relevant missing");
  if (!Number.isFinite(confidence)) throw new Error("confidence missing");
  if (!["CH", "other", "unknown"].includes(String(country))) throw new Error("country invalid");
  if (
    ![
      "power_outage",
      "grid_disturbance",
      "planned_outage",
      "unclear",
      "not_relevant"
    ].includes(String(eventType))
  ) {
    throw new Error("event_type invalid");
  }

  return {
    is_relevant: record.is_relevant,
    confidence: Math.max(0, Math.min(1, confidence)),
    country: country as AiClassification["country"],
    location_text: String(record.location_text ?? ""),
    event_type: eventType as AiClassification["event_type"],
    summary: String(record.summary ?? ""),
    reason: String(record.reason ?? "")
  };
}

function validateResearchAssessment(value: unknown): ResearchAssessment {
  if (!value || typeof value !== "object") {
    throw new Error("Research JSON is not an object");
  }

  const record = value as Record<string, unknown>;
  const outageNature = String(record.outage_nature ?? "unknown");
  const causeCategory = String(record.cause_category ?? "unknown");
  const status = String(record.status ?? "unknown");
  const factConfidence =
    record.fact_confidence === undefined || record.fact_confidence === null
      ? 0.35
      : Number(record.fact_confidence);

  if (!["planned", "unplanned", "unknown"].includes(outageNature)) {
    throw new Error("outage_nature invalid");
  }
  if (
    ![
      "planned_maintenance",
      "weather",
      "tree_or_overhead_line",
      "construction_damage",
      "cable_damage",
      "transformer_or_substation",
      "technical_fault",
      "fire",
      "overload",
      "third_party_damage",
      "water_or_flooding",
      "unknown"
    ].includes(causeCategory)
  ) {
    throw new Error("cause_category invalid");
  }
  if (!["active", "resolved", "unknown"].includes(status)) {
    throw new Error("status invalid");
  }
  if (!Number.isFinite(factConfidence)) {
    throw new Error("fact_confidence invalid");
  }

  return {
    outage_nature: outageNature as ResearchAssessment["outage_nature"],
    cause_category: causeCategory as ResearchAssessment["cause_category"],
    cause_text: String(record.cause_text ?? ""),
    status: status as ResearchAssessment["status"],
    research_summary_de: String(record.research_summary_de ?? ""),
    fact_confidence: Math.max(0, Math.min(1, factConfidence))
  };
}

function validateMergeAssessment(value: unknown): MergeAssessment {
  if (!value || typeof value !== "object") {
    throw new Error("Merge JSON is not an object");
  }

  const record = value as Record<string, unknown>;
  const confidence = Number(record.confidence);
  if (typeof record.same_event !== "boolean") throw new Error("same_event missing");
  if (!Number.isFinite(confidence)) throw new Error("confidence missing");

  return {
    same_event: record.same_event,
    confidence: Math.max(0, Math.min(1, confidence)),
    reason: String(record.reason ?? ""),
    risk: String(record.risk ?? "")
  };
}

function promptForResearch(input: {
  title: string;
  location: string;
  summary: string;
  sources: Array<{ title: string; url: string; excerpt: string }>;
}): string {
  const sources = input.sources
    .slice(0, 8)
    .map(
      (source, index) => `Quelle ${index + 1}
Titel: ${source.title}
URL: ${source.url}
Auszug: ${source.excerpt.slice(0, 1400)}`
    )
    .join("\n\n");

  return `Du bist ein vorsichtiger Schweizer Stromausfall-Monitoring-Assistent.

Analysiere die vorhandenen Quellen zu einer möglichen Stromausfall-Akte.
Erfinde keine Fakten. Wenn Ursache, Status oder geplante Natur nicht klar ableitbar sind, antworte "unknown" beziehungsweise kurze Unsicherheit.

Event:
${input.title}

Ort:
${input.location}

Bisherige Kurzfassung:
${input.summary}

Quellen:
${sources}

Aufgabe:
1. Ist der Unterbruch geplant, ungeplant oder unklar?
2. Welche Ursache/Kategorie ist aus den Quellen ableitbar?
3. Ist der Status aktiv, behoben oder unklar?
4. Schreibe eine sachliche deutsche Kurz-Zusammenfassung in 2-4 Sätzen.
5. Gib eine vorsichtige Confidence zwischen 0 und 1.
   0.15-0.35 = nur schwache Hinweise oder viele Fakten unklar.
   0.40-0.60 = plausible Akte, aber Art/Ursache/Status nicht vollständig belegt.
   0.65-0.85 = mehrere passende Quellen und mindestens Art oder Ursache klar ableitbar.
   Über 0.85 nur, wenn Quellen, Ort, Art, Ursache und Status klar zusammenpassen.

Antworte ausschliesslich als valides JSON:

{
  "outage_nature": "unknown",
  "cause_category": "unknown",
  "cause_text": "",
  "status": "unknown",
  "research_summary_de": "",
  "fact_confidence": 0.0
}

Zulässige Werte:
outage_nature: "planned", "unplanned", "unknown"
status: "active", "resolved", "unknown"
cause_category: "planned_maintenance", "weather", "tree_or_overhead_line", "construction_damage", "cable_damage", "transformer_or_substation", "technical_fault", "fire", "overload", "third_party_damage", "water_or_flooding", "unknown"`;
}

function promptForMerge(left: OutageEvent, right: OutageEvent, heuristicScore: number): string {
  return `Du bist ein vorsichtiger Schweizer Stromausfall-Monitoring-Assistent.

Prüfe, ob diese zwei Event-Akten wahrscheinlich denselben Vorfall beschreiben.
Antworte nur anhand der angegebenen Felder. Erfinde keine Fakten.

Event A:
ID: ${left.id}
Ort: ${left.location_text ?? ""}
Zeitfenster: ${left.first_seen_at} bis ${left.last_seen_at}
Typ: ${left.event_type}
Kurzfassung: ${left.research_summary_de || left.summary || ""}
Quelle: ${left.primary_source_title || ""}

Event B:
ID: ${right.id}
Ort: ${right.location_text ?? ""}
Zeitfenster: ${right.first_seen_at} bis ${right.last_seen_at}
Typ: ${right.event_type}
Kurzfassung: ${right.research_summary_de || right.summary || ""}
Quelle: ${right.primary_source_title || ""}

Heuristischer Score: ${heuristicScore}/100

Aufgabe:
1. Sind das wahrscheinlich dieselben Ereignisse?
2. Wie sicher ist diese Einschätzung?
3. Warum?
4. Welches Risiko hätte ein Merge?

Antworte ausschliesslich als valides JSON:

{
  "same_event": false,
  "confidence": 0.0,
  "reason": "",
  "risk": ""
}`;
}

function mockClassify(item: NormalizedRssItem): AiClassificationResult {
  const filter = cheapFilterItem(item);
  const text = `${item.title} ${item.source ?? ""} ${item.snippet ?? ""}`;
  const chTerms = /\b(schweiz|suisse|svizzera|swiss|zürich|zurich|bern|basel|luzern|aargau|genf|geneve|lausanne|ticino|tessin|kanton)\b/i;
  const country = chTerms.test(text) ? "CH" : "unknown";
  const location = text.match(/\b(Zürich|Zurich|Bern|Basel|Luzern|Aargau|Genf|Geneve|Lausanne|Ticino|Tessin)\b/i)?.[0] ?? "";
  const parsed: AiClassification = {
    is_relevant: filter.candidate,
    confidence: filter.candidate ? 0.86 : 0.2,
    country,
    location_text: location,
    event_type: filter.candidate ? "power_outage" : "not_relevant",
    summary: filter.candidate
      ? `Mögliche Stromausfallmeldung: ${item.title}`
      : `Nicht relevante Meldung: ${item.title}`,
    reason: filter.reason
  };

  return { parsed, raw: JSON.stringify(parsed) };
}

export async function classifyItem(
  env: Pick<Env, "AI" | "AI_MOCK_MODE">,
  item: NormalizedRssItem
): Promise<AiClassificationResult> {
  if (env.AI_MOCK_MODE === "true") {
    return mockClassify(item);
  }

  try {
    const response = await env.AI.run(MODEL, {
      messages: [
        {
          role: "user",
          content: promptForItem(item)
        }
      ]
    });
    const raw = extractResponseText(response);
    return { parsed: validateClassification(extractJson(raw)), raw };
  } catch (error) {
    return {
      parsed: null,
      raw: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function assessResearch(
  env: Pick<Env, "AI" | "AI_MOCK_MODE">,
  input: {
    title: string;
    location: string;
    summary: string;
    sources: Array<{ title: string; url: string; excerpt: string }>;
  }
): Promise<{ parsed: ResearchAssessment | null; raw: string; error?: string }> {
  if (env.AI_MOCK_MODE === "true") {
    const parsed: ResearchAssessment = {
      outage_nature: "unknown",
      cause_category: "unknown",
      cause_text: "",
      status: "unknown",
      research_summary_de: `Manuelle Recherche zu ${input.location || input.title}. Die Quellen reichen für eine vorsichtige Einordnung, aber nicht für eine offizielle Verifikation.`,
      fact_confidence: input.sources.length > 1 ? 0.65 : 0.45
    };
    return { parsed, raw: JSON.stringify(parsed) };
  }

  try {
    const response = await env.AI.run(MODEL, {
      messages: [
        {
          role: "user",
          content: promptForResearch(input)
        }
      ]
    });
    const raw = extractResponseText(response);
    return { parsed: validateResearchAssessment(extractJson(raw)), raw };
  } catch (error) {
    return {
      parsed: null,
      raw: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function assessMergeSuggestion(
  env: Pick<Env, "AI" | "AI_MOCK_MODE">,
  left: OutageEvent,
  right: OutageEvent,
  heuristicScore: number
): Promise<{ parsed: MergeAssessment | null; raw: string; error?: string }> {
  if (env.AI_MOCK_MODE === "true") {
    const sameLocation =
      (left.normalized_location || left.location_text || "") ===
      (right.normalized_location || right.location_text || "");
    const parsed: MergeAssessment = {
      same_event: sameLocation && heuristicScore >= 70,
      confidence: Math.max(0.25, Math.min(0.9, heuristicScore / 100)),
      reason: sameLocation
        ? "Mock: gleicher Ort und ähnliches Zeitfenster."
        : "Mock: Ort oder Zeitfenster weicht ab.",
      risk: heuristicScore >= 80 ? "Niedrig, aber manuell prüfen." : "Mittel, manuell prüfen."
    };
    return { parsed, raw: JSON.stringify(parsed) };
  }

  try {
    const response = await env.AI.run(MODEL, {
      messages: [
        {
          role: "user",
          content: promptForMerge(left, right, heuristicScore)
        }
      ]
    });
    const raw = extractResponseText(response);
    return { parsed: validateMergeAssessment(extractJson(raw)), raw };
  } catch (error) {
    return {
      parsed: null,
      raw: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
