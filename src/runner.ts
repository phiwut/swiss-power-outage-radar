import { classifyItem } from "./ai";
import {
  attachSourceToEvent,
  createWorkflowRun,
  createOutageEvent,
  findCandidateEvents,
  finishWorkflowRun,
  getAlertItemById,
  getEventsNeedingIntelligence,
  getOutageEventSources,
  getPendingOutageEventEmails,
  getUnlinkedRelevantItems,
  insertAlertItem,
  markAiError,
  markAlertLinkedToEvent,
  markOutageEventEmailSent,
  markOutageEventUpdateEmailSent,
  markFiltered,
  refreshOutageEventAfterSource,
  updateOutageEventMailDecision,
  updateClassification,
  upsertFeedHealth
} from "./db";
import { generateMergeSuggestions, refreshEventIntelligence } from "./event-intelligence";
import { canAutoMergeLocation, canCreateEvent, makeEventTitle, normalizeLocation, scoreEventCandidate } from "./events";
import { decideNewEventMail, decideUpdateMail } from "./intelligence";
import { sendEventEmail } from "./email";
import { cheapFilterItem } from "./filter";
import { itemHash, parseRssFeed } from "./rss";
import { researchOutageEvent } from "./research";
import { createSourceSnapshot } from "./snapshots";
import type {
  AiClassification,
  Env,
  FeedLanguage,
  NormalizedRssItem,
  OutageEvent,
  StoredAlertItem,
  WorkflowRunSummary
} from "./types";

interface FeedConfig {
  language: FeedLanguage;
  url?: string;
}

interface FetchedFeed {
  language: FeedLanguage;
  items: NormalizedRssItem[];
  error: string | null;
}

function feedsFromEnv(env: Env): FeedConfig[] {
  return [
    { language: "de", url: env.ALERT_FEED_DE },
    { language: "fr", url: env.ALERT_FEED_FR },
    { language: "it", url: env.ALERT_FEED_IT }
  ];
}

async function fetchFeed(feed: FeedConfig): Promise<FetchedFeed> {
  if (!feed.url) {
    return {
      language: feed.language,
      items: [],
      error: `ALERT_FEED_${feed.language.toUpperCase()} missing`
    };
  }

  try {
    const response = await fetch(feed.url, {
      headers: {
        "User-Agent": "swiss-power-outage-radar/0.1"
      }
    });
    if (!response.ok) {
      return {
        language: feed.language,
        items: [],
        error: `HTTP ${response.status}`
      };
    }

    const xml = await response.text();
    return {
      language: feed.language,
      items: parseRssFeed(xml, feed.language),
      error: null
    };
  } catch (error) {
    return {
      language: feed.language,
      items: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function storeNewItems(
  env: Env,
  feed: FetchedFeed,
  fetchedAt: string
): Promise<{ newItems: StoredAlertItem[]; seen: number; errors: string[] }> {
  const newItems: StoredAlertItem[] = [];
  const errors: string[] = [];

  for (const item of feed.items) {
    try {
      const hash = await itemHash(item);
      const stored = await insertAlertItem(env.DB, item, hash, fetchedAt);
      if (stored.inserted) newItems.push(stored.item);
    } catch (error) {
      errors.push(
        `insert ${feed.language} "${item.title}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return { newItems, seen: feed.items.length, errors };
}

async function classifyAndNotify(
  env: Env,
  item: StoredAlertItem
): Promise<{ filtered: boolean; classified: boolean; emailSent: boolean; error?: string }> {
  const filter = cheapFilterItem(item);
  if (!filter.candidate) {
    await markFiltered(env.DB, item.id, filter.reason);
    return { filtered: true, classified: false, emailSent: false };
  }

  const classification = await classifyItem(env, item);
  if (!classification.parsed) {
    await markAiError(env.DB, item.id, classification.raw);
    return {
      filtered: false,
      classified: false,
      emailSent: false,
      error: classification.error ?? "AI classification failed"
    };
  }

  await updateClassification(env.DB, item.id, classification.parsed, classification.raw);

  const freshItem = await getAlertItemById(env.DB, item.id);
  if (!freshItem) {
    return { filtered: false, classified: true, emailSent: false, error: "Item vanished" };
  }

  if (!canCreateEvent(classification.parsed)) {
    return { filtered: false, classified: true, emailSent: false };
  }

  try {
    const result = await linkAlertToOutageEvent(env, freshItem, classification.parsed);
    return { filtered: false, classified: true, emailSent: result.emailSent };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { filtered: false, classified: true, emailSent: false, error: message };
  }
}

async function findBestEvent(
  env: Env,
  item: StoredAlertItem,
  classification: AiClassification,
  normalizedLocation: string
): Promise<{ event: OutageEvent; score: number } | null> {
  if (!canAutoMergeLocation(normalizedLocation)) return null;

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const candidates = await findCandidateEvents(env.DB, since);
  let best: { event: OutageEvent; score: number } | null = null;

  for (const event of candidates) {
    const score = scoreEventCandidate(event, item, classification, normalizedLocation);
    if (!best || score > best.score) best = { event, score };
  }

  return best && best.score >= 70 ? best : null;
}

async function shouldSendUpdateEmail(event: OutageEvent, now: string): Promise<boolean> {
  if (event.source_count < 2) return false;
  if (!event.email_sent_at) return false;

  const nowMs = new Date(now).getTime();
  const firstMailMs = new Date(event.email_sent_at).getTime();
  if (!Number.isFinite(nowMs) || !Number.isFinite(firstMailMs)) return false;
  if (nowMs - firstMailMs < 30 * 60 * 1000) return false;

  if (!event.update_email_sent_at) return true;
  const updateMs = new Date(event.update_email_sent_at).getTime();
  return Number.isFinite(updateMs) && nowMs - updateMs >= 6 * 60 * 60 * 1000;
}

async function maybeAutoResearchHighConfidenceEvent(
  env: Env,
  event: OutageEvent
): Promise<string | null> {
  if (Number(event.event_score ?? 0) < 85) return null;
  if (event.status === "dismissed") return null;
  if ((event.research_status ?? "not_started") !== "not_started") return null;
  if (event.auto_research_started_at) return null;

  try {
    await researchOutageEvent(env, event.id, { automatic: true });
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Automatic research already ran")) return null;
    return `auto research event ${event.id}: ${message}`;
  }
}

async function linkAlertToOutageEvent(
  env: Env,
  item: StoredAlertItem,
  classification: AiClassification,
  options: { suppressNewEventEmail?: boolean } = {}
): Promise<{ event: OutageEvent; created: boolean; emailSent: boolean }> {
  const now = new Date().toISOString();
  const normalizedLocation = normalizeLocation(classification.location_text);
  const best = await findBestEvent(env, item, classification, normalizedLocation);

  let event = best?.event;
  let created = false;
  let relationScore = best?.score ?? 100;

  if (!event) {
    event = await createOutageEvent(env.DB, {
      title: makeEventTitle(classification),
      eventType: classification.event_type,
      locationText: classification.location_text,
      normalizedLocation,
      canton: null,
      country: classification.country,
      seenAt: item.published_at ?? item.fetched_at ?? now,
      summary: classification.summary,
      reason: classification.reason,
      confidence: classification.confidence,
      primarySourceUrl: item.url,
      primarySourceTitle: item.title
    });
    created = true;
  }

  const source = await attachSourceToEvent(env.DB, {
    eventId: event.id,
    alertItem: item,
    relationScore,
    isPrimary: created
  });
  await markAlertLinkedToEvent(env.DB, item.id, event.id, now);
  event = await refreshOutageEventAfterSource(env.DB, event.id, {
    lastSeenAt: item.published_at ?? item.fetched_at ?? now,
    confidence: classification.confidence,
    summary: classification.summary,
    reason: classification.reason
  });
  await createSourceSnapshot(env, { event, source, alertItem: item });

  event = await refreshEventIntelligence(env, event.id);
  await generateMergeSuggestions(env, event.id);

  const sources = await getOutageEventSources(env.DB, event.id);
  const autoResearchError = await maybeAutoResearchHighConfidenceEvent(env, event);
  if (autoResearchError) console.warn(autoResearchError);

  if (created) {
    if (options.suppressNewEventEmail) {
      if (item.email_sent === 1) {
        await markOutageEventEmailSent(env.DB, event.id, item.email_sent_at ?? now);
      }
      return { event, created, emailSent: false };
    }

    const mailDecision = decideNewEventMail(event, sources);
    await updateOutageEventMailDecision(env.DB, event.id, mailDecision.reason);
    if (mailDecision.send) {
      await sendEventEmail(env, event, sources, "new");
      await markOutageEventEmailSent(env.DB, event.id, now);
      return { event, created, emailSent: true };
    }
    return { event, created, emailSent: false };
  }

  const updateDecision = decideUpdateMail(event, sources, now);
  await updateOutageEventMailDecision(env.DB, event.id, updateDecision.reason);
  if (updateDecision.send) {
    await sendEventEmail(env, event, sources, "update");
    await markOutageEventUpdateEmailSent(env.DB, event.id, now);
    return { event, created, emailSent: true };
  }

  return { event, created, emailSent: false };
}

function classificationFromStoredItem(item: StoredAlertItem): AiClassification | null {
  if (
    item.is_relevant !== 1 ||
    item.confidence === null ||
    !item.country ||
    !item.event_type ||
    !item.summary ||
    !item.reason
  ) {
    return null;
  }

  if (!["CH", "other", "unknown"].includes(item.country)) return null;
  if (
    ![
      "power_outage",
      "grid_disturbance",
      "planned_outage",
      "unclear",
      "not_relevant"
    ].includes(item.event_type)
  ) {
    return null;
  }

  return {
    is_relevant: true,
    confidence: item.confidence,
    country: item.country,
    location_text: item.location_text ?? "",
    event_type: item.event_type as AiClassification["event_type"],
    summary: item.summary,
    reason: item.reason.replace(/\s*Email error:.*$/s, "")
  };
}

async function backfillUnlinkedEvents(env: Env): Promise<{ linked: number; errors: string[] }> {
  const items = await getUnlinkedRelevantItems(env.DB);
  let linked = 0;
  const errors: string[] = [];

  for (const item of items) {
    const classification = classificationFromStoredItem(item);
    if (!classification || !canCreateEvent(classification)) continue;

    try {
      await linkAlertToOutageEvent(env, item, classification, {
        suppressNewEventEmail: item.email_sent === 1
      });
      linked += 1;
    } catch (error) {
      errors.push(
        `backfill item ${item.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { linked, errors };
}

async function retryPendingEventEmails(
  env: Env
): Promise<{ emailsSent: number; errors: string[] }> {
  const events = await getPendingOutageEventEmails(env.DB);
  let emailsSent = 0;
  const errors: string[] = [];

  for (const event of events) {
    try {
      const sources = await getOutageEventSources(env.DB, event.id);
      const mailDecision = decideNewEventMail(event, sources);
      await updateOutageEventMailDecision(env.DB, event.id, mailDecision.reason);
      if (!mailDecision.send) continue;

      await sendEventEmail(env, event, sources, "new");
      await markOutageEventEmailSent(env.DB, event.id, new Date().toISOString());
      emailsSent += 1;
    } catch (error) {
      errors.push(
        `event ${event.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { emailsSent, errors };
}

async function backfillEventIntelligence(env: Env): Promise<{ updated: number; errors: string[] }> {
  const events = await getEventsNeedingIntelligence(env.DB, 5);
  let updated = 0;
  const errors: string[] = [];

  for (const event of events) {
    try {
      const refreshed = await refreshEventIntelligence(env, event.id);
      await generateMergeSuggestions(env, refreshed.id);
      const sources = await getOutageEventSources(env.DB, refreshed.id);
      const mailDecision = decideNewEventMail(refreshed, sources);
      await updateOutageEventMailDecision(env.DB, refreshed.id, mailDecision.reason);
      updated += 1;
    } catch (error) {
      errors.push(
        `event intelligence ${event.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { updated, errors };
}

export async function runAlertCheck(env: Env): Promise<WorkflowRunSummary> {
  const startedAt = new Date().toISOString();
  const runId = await createWorkflowRun(env.DB, startedAt);
  const summary: WorkflowRunSummary = {
    runId,
    itemsSeen: 0,
    itemsNew: 0,
    itemsFiltered: 0,
    itemsClassified: 0,
    emailsSent: 0,
    errors: []
  };

  try {
    for (const feed of feedsFromEnv(env)) {
      const checkedAt = new Date().toISOString();
      const fetched = await fetchFeed(feed);

      if (fetched.error) {
        summary.errors.push(`${feed.language}: ${fetched.error}`);
        await upsertFeedHealth(env.DB, feed.language, {
          checkedAt,
          error: fetched.error,
          itemsSeen: 0,
          itemsNew: 0
        });
        continue;
      }

      const stored = await storeNewItems(env, fetched, checkedAt);
      summary.itemsSeen += stored.seen;
      summary.itemsNew += stored.newItems.length;
      summary.errors.push(...stored.errors);

      await upsertFeedHealth(env.DB, feed.language, {
        checkedAt,
        successAt: checkedAt,
        error: null,
        itemsSeen: stored.seen,
        itemsNew: stored.newItems.length
      });

      for (const item of stored.newItems) {
        try {
          const result = await classifyAndNotify(env, item);
          if (result.filtered) summary.itemsFiltered += 1;
          if (result.classified) summary.itemsClassified += 1;
          if (result.emailSent) summary.emailsSent += 1;
          if (result.error) summary.errors.push(`item ${item.id}: ${result.error}`);
        } catch (error) {
          summary.errors.push(
            `item ${item.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    const backfill = await backfillUnlinkedEvents(env);
    summary.errors.push(...backfill.errors);

    const intelligenceBackfill = await backfillEventIntelligence(env);
    summary.errors.push(...intelligenceBackfill.errors);

    const eventRetry = await retryPendingEventEmails(env);
    summary.emailsSent += eventRetry.emailsSent;
    for (const error of eventRetry.errors) {
      console.warn(`pending email retry failed: ${error}`);
    }

    await finishWorkflowRun(
      env.DB,
      runId,
      summary.errors.length > 0 ? "partial_error" : "success",
      {
        itemsSeen: summary.itemsSeen,
        itemsNew: summary.itemsNew,
        itemsFiltered: summary.itemsFiltered,
        itemsClassified: summary.itemsClassified,
        emailsSent: summary.emailsSent,
        error: summary.errors.length > 0 ? summary.errors.join("; ").slice(0, 2000) : null
      },
      new Date().toISOString()
    );

    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summary.errors.push(message);
    await finishWorkflowRun(
      env.DB,
      runId,
      "error",
      {
        itemsSeen: summary.itemsSeen,
        itemsNew: summary.itemsNew,
        itemsFiltered: summary.itemsFiltered,
        itemsClassified: summary.itemsClassified,
        emailsSent: summary.emailsSent,
        error: summary.errors.join("; ").slice(0, 2000)
      },
      new Date().toISOString()
    );
    return summary;
  }
}
