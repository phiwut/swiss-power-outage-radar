import type {
  AiClassification,
  CandidateAssessment,
  CandidateFactInput,
  CanonicalObservationStatus,
  OutageNature,
  RelevanceRole,
  SourceObservation
} from "./types";

function statusNature(status: CanonicalObservationStatus): OutageNature {
  if (status === "planned") return "planned";
  if (status === "unplanned" || status === "resolved") return "unplanned";
  return "unknown";
}

function observationLifecycle(status: CanonicalObservationStatus): CandidateAssessment["status"] {
  if (status === "resolved") return "resolved";
  if (status === "planned" || status === "unplanned") return "active";
  return "unknown";
}

function roleForStatus(status: CanonicalObservationStatus): RelevanceRole {
  if (status === "planned") return "official_notice";
  if (status === "resolved") return "incident_update";
  if (status === "unplanned") return "primary_report";
  if (status === "historical") return "incidental_mention";
  if (status === "irrelevant") return "background";
  return "unknown";
}

function eventTypeForStatus(status: CanonicalObservationStatus): AiClassification["event_type"] {
  if (status === "planned") return "planned_outage";
  if (status === "unplanned" || status === "resolved") return "power_outage";
  return "unclear";
}

function locationGranularity(location: string | null): CandidateAssessment["location_granularity"] {
  if (!location) return "unknown";
  if (/strasse|straße|weg|gasse|platz|route|rue|via/i.test(location)) return "street";
  if (/kanton|canton/i.test(location)) return "canton";
  if (/region|bezirk|district/i.test(location)) return "region";
  return "municipality";
}

function fact(
  observation: SourceObservation,
  fact_type: CandidateFactInput["fact_type"],
  value_text: string,
  confidence: number
): CandidateFactInput {
  return {
    fact_type,
    value_text,
    confidence,
    evidence_excerpt: observation.evidence_excerpt,
    source_role: "operator",
    verified_by: "official_source",
    source_observation_id: observation.id,
    observed_at: observation.observed_at,
    extractor_version: observation.extractor_version
  };
}

export function observationToClassification(observation: SourceObservation): AiClassification {
  const status = observation.canonical_status;
  const relevant = status === "planned" || status === "unplanned" || status === "resolved";
  return {
    is_relevant: relevant,
    confidence: observation.confidence,
    country: "CH",
    location_text: observation.location_text || observation.area_text || "",
    event_type: eventTypeForStatus(status),
    summary: observation.title,
    reason: `Netzbetreiber-Beobachtung ${observation.source_key}: ${status}`
  };
}

export function assessSourceObservation(observation: SourceObservation): CandidateAssessment {
  const status = observation.canonical_status;
  const publishable = status === "planned" || status === "unplanned" || status === "resolved";
  const location = observation.location_text || observation.area_text || "";
  const facts: CandidateFactInput[] = [];

  if (location) facts.push(fact(observation, "location", location, 0.9));
  if (status === "planned") facts.push(fact(observation, "planned_outage_notice", "true", 0.92));
  if (status === "unplanned" || status === "resolved") facts.push(fact(observation, "outage_happened", "true", 0.92));
  if (status === "planned" || status === "unplanned") {
    facts.push(fact(observation, "status", "active", 0.72));
  }
  if (status === "resolved") {
    facts.push(fact(observation, "status", "resolved", 0.9));
    if (observation.resolved_at) facts.push(fact(observation, "end_time", observation.resolved_at, 0.82));
  }
  if (observation.started_at) facts.push(fact(observation, "start_time", observation.started_at, 0.82));
  facts.push(fact(observation, "planned_nature", statusNature(status), 0.78));

  return {
    publishable,
    needs_admin: !publishable && status === "unverified",
    is_ch_incident: publishable || status === "unverified",
    location_text: location,
    location_granularity: locationGranularity(location),
    event_type: eventTypeForStatus(status),
    relevance_role: roleForStatus(status),
    quality_score: publishable ? 95 : status === "unverified" ? 35 : 0,
    quality_reasons: [`source_registry:${observation.source_key}`, `status:${status}`],
    rejection_reason: publishable ? null : `Nicht öffentliche Quellenbeobachtung: ${status}`,
    outage_nature: statusNature(status),
    status: observationLifecycle(status),
    summary_de: observation.title,
    facts
  };
}
