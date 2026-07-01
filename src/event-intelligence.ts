import { assessMergeSuggestion, assessResearch } from "./ai";
import {
  findCandidateEvents,
  getOutageEvent,
  getOutageEventSnapshots,
  getOutageEventSources,
  updateEventIntelligence,
  updateEventResearchAssessment,
  upsertMergeSuggestion
} from "./db";
import {
  buildFactSheet,
  mergeHeuristicScore,
  scoreEvent
} from "./intelligence";
import type { Env, OutageEvent, OutageSource, ResearchAssessment, SourceSnapshot } from "./types";

function sourceExcerpt(source: OutageSource, snapshots: SourceSnapshot[]) {
  const snapshot = snapshots.find(
    (candidate) => candidate.outage_source_id === source.id && candidate.markdown_excerpt
  );
  return {
    title: source.source_title,
    url: source.source_url,
    excerpt: snapshot?.markdown_excerpt || source.source_name || ""
  };
}

function shouldUseAiFactSheet(sources: OutageSource[], snapshots: SourceSnapshot[]): boolean {
  if (sources.length < 2) return false;
  return snapshots.some((snapshot) => snapshot.fetch_status === "success") || sources.length >= 3;
}

export async function refreshEventIntelligence(
  env: Env,
  eventId: number,
  options: {
    useAiFactSheet?: boolean;
    assessment?: ResearchAssessment | null;
    mailDecisionReason?: string | null;
  } = {}
): Promise<OutageEvent> {
  let event = await getOutageEvent(env.DB, eventId);
  if (!event) throw new Error(`Event ${eventId} not found`);

  const [sources, snapshots] = await Promise.all([
    getOutageEventSources(env.DB, eventId),
    getOutageEventSnapshots(env.DB, eventId)
  ]);

  let assessment = options.assessment ?? null;
  if (!assessment && (options.useAiFactSheet || shouldUseAiFactSheet(sources, snapshots))) {
    const result = await assessResearch(env, {
      title: event.title,
      location: event.location_text ?? "",
      summary: event.summary ?? "",
      sources: sources.map((source) => sourceExcerpt(source, snapshots))
    });
    assessment = result.parsed;
  }

  const factSheet = buildFactSheet(event, sources, snapshots, assessment);
  if (assessment) {
    event = await updateEventResearchAssessment(env.DB, eventId, assessment, factSheet);
  }

  const score = scoreEvent(event, sources);
  return await updateEventIntelligence(env.DB, eventId, {
    eventScore: score.event_score,
    evidenceLevel: score.evidence_level,
    factSheet,
    mailDecisionReason: options.mailDecisionReason ?? score.reason
  });
}

export async function generateMergeSuggestions(env: Env, eventId: number): Promise<number> {
  const event = await getOutageEvent(env.DB, eventId);
  if (!event || event.status === "dismissed") return 0;

  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const candidates = (await findCandidateEvents(env.DB, since))
    .filter((candidate) => candidate.id !== event.id)
    .map((candidate) => ({
      candidate,
      score: mergeHeuristicScore(event, candidate)
    }))
    .filter((candidate) => candidate.score >= 60)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  let stored = 0;
  for (const { candidate, score } of candidates) {
    const ai = await assessMergeSuggestion(env, event, candidate, score);
    await upsertMergeSuggestion(env.DB, {
      sourceEventId: event.id,
      targetEventId: candidate.id,
      heuristicScore: score,
      aiConfidence: ai.parsed?.confidence ?? null,
      sameEvent: ai.parsed?.same_event ?? false,
      reason: ai.parsed
        ? `${ai.parsed.reason}${ai.parsed.risk ? ` Risiko: ${ai.parsed.risk}` : ""}`
        : ai.error ?? "AI merge assessment failed"
    });
    stored += 1;
  }

  return stored;
}
