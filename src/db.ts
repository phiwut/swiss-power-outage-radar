import type {
  AiClassification,
  EventMergeSuggestion,
  EvidenceLevel,
  FactSheet,
  FeedLanguage,
  NormalizedRssItem,
  OutageEvent,
  OutageSource,
  ResearchAssessment,
  ResearchStatus,
  SourceSnapshot,
  StoredAlertItem
} from "./types";
import { classifySource } from "./intelligence";

function changes(result: D1Result<unknown>): number {
  const meta = result.meta as { changes?: number } | undefined;
  return meta?.changes ?? 0;
}

export async function createWorkflowRun(db: D1Database, now: string): Promise<number> {
  const result = await db
    .prepare(
      "INSERT INTO workflow_runs (workflow_name, started_at, status) VALUES (?, ?, 'running')"
    )
    .bind("check-alert-feeds", now)
    .run();
  const meta = result.meta as { last_row_id?: number } | undefined;
  if (typeof meta?.last_row_id === "number") return meta.last_row_id;

  const row = await db
    .prepare("SELECT id FROM workflow_runs WHERE started_at = ? ORDER BY id DESC LIMIT 1")
    .bind(now)
    .first<{ id: number }>();
  if (!row) throw new Error("Could not create workflow run");
  return row.id;
}

export async function finishWorkflowRun(
  db: D1Database,
  runId: number,
  status: "success" | "partial_error" | "error",
  stats: {
    itemsSeen: number;
    itemsNew: number;
    itemsFiltered: number;
    itemsClassified: number;
    emailsSent: number;
    error: string | null;
  },
  now: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE workflow_runs
       SET finished_at = ?, status = ?, items_seen = ?, items_new = ?, items_filtered = ?,
           items_classified = ?, emails_sent = ?, error = ?
       WHERE id = ?`
    )
    .bind(
      now,
      status,
      stats.itemsSeen,
      stats.itemsNew,
      stats.itemsFiltered,
      stats.itemsClassified,
      stats.emailsSent,
      stats.error,
      runId
    )
    .run();
}

export async function upsertFeedHealth(
  db: D1Database,
  feedLanguage: FeedLanguage,
  patch: {
    checkedAt: string;
    successAt?: string | null;
    error?: string | null;
    itemsSeen: number;
    itemsNew: number;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO feed_health (
         feed_language, last_checked_at, last_success_at, last_error,
         items_seen_last_run, items_new_last_run
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(feed_language) DO UPDATE SET
         last_checked_at = excluded.last_checked_at,
         last_success_at = COALESCE(excluded.last_success_at, feed_health.last_success_at),
         last_error = excluded.last_error,
         items_seen_last_run = excluded.items_seen_last_run,
         items_new_last_run = excluded.items_new_last_run`
    )
    .bind(
      feedLanguage,
      patch.checkedAt,
      patch.successAt ?? null,
      patch.error ?? null,
      patch.itemsSeen,
      patch.itemsNew
    )
    .run();
}

export async function insertAlertItem(
  db: D1Database,
  item: NormalizedRssItem,
  hash: string,
  fetchedAt: string
): Promise<{ inserted: boolean; item: StoredAlertItem }> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO alert_items (
         feed_language, title, url, source, snippet, published_at, fetched_at, item_hash
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      item.feed_language,
      item.title,
      item.url,
      item.source,
      item.snippet,
      item.published_at,
      fetchedAt,
      hash
    )
    .run();

  const stored = await getAlertItemByHash(db, hash);
  if (!stored) throw new Error("Inserted alert item could not be loaded");
  return { inserted: changes(result) > 0, item: stored };
}

export async function getAlertItemByHash(
  db: D1Database,
  hash: string
): Promise<StoredAlertItem | null> {
  return await db.prepare("SELECT * FROM alert_items WHERE item_hash = ?").bind(hash).first<StoredAlertItem>();
}

export async function getAlertItemById(
  db: D1Database,
  id: number
): Promise<StoredAlertItem | null> {
  return await db.prepare("SELECT * FROM alert_items WHERE id = ?").bind(id).first<StoredAlertItem>();
}

export async function markFiltered(db: D1Database, id: number, reason: string): Promise<void> {
  await db
    .prepare("UPDATE alert_items SET status = 'filtered', reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(reason, id)
    .run();
}

export async function updateClassification(
  db: D1Database,
  id: number,
  classification: AiClassification,
  raw: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE alert_items
       SET status = 'classified',
           is_relevant = ?,
           confidence = ?,
           country = ?,
           location_text = ?,
           event_type = ?,
           summary = ?,
           reason = ?,
           ai_raw = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      classification.is_relevant ? 1 : 0,
      classification.confidence,
      classification.country,
      classification.location_text,
      classification.event_type,
      classification.summary,
      classification.reason,
      raw,
      id
    )
    .run();
}

export async function markAiError(db: D1Database, id: number, raw: string): Promise<void> {
  await db
    .prepare(
      "UPDATE alert_items SET status = 'ai_error', ai_raw = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(raw, id)
    .run();
}

export async function markEmailSent(db: D1Database, id: number, sentAt: string): Promise<void> {
  await db
    .prepare(
      "UPDATE alert_items SET status = 'email_sent', email_sent = 1, email_sent_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(sentAt, id)
    .run();
}

export async function markAlertLinkedToEvent(
  db: D1Database,
  alertItemId: number,
  outageEventId: number,
  linkedAt: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE alert_items
       SET outage_event_id = ?, event_linked_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(outageEventId, linkedAt, alertItemId)
    .run();
}

export async function markEmailError(db: D1Database, id: number, error: string): Promise<void> {
  await db
    .prepare(
      "UPDATE alert_items SET status = 'email_error', reason = COALESCE(reason, '') || ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(` Email error: ${error}`, id)
    .run();
}

export async function getPublicStatus(db: D1Database) {
  const [lastRun, feedHealth, totals, statusCounts, activity, runs, events] = await Promise.all([
    db.prepare("SELECT * FROM workflow_runs ORDER BY id DESC LIMIT 1").first(),
    db.prepare("SELECT * FROM feed_health ORDER BY feed_language").all(),
    db
      .prepare(
        `SELECT
           COUNT(*) AS items_last_24h,
           SUM(CASE WHEN is_relevant = 1 THEN 1 ELSE 0 END) AS relevant_last_24h,
           (
             SELECT COUNT(*)
             FROM outage_events
             WHERE email_sent_at >= datetime('now', '-24 hours')
                OR update_email_sent_at >= datetime('now', '-24 hours')
           ) AS emails_last_24h,
           (SELECT COUNT(*) FROM outage_events WHERE first_seen_at >= datetime('now', '-24 hours')) AS events_last_24h
         FROM alert_items
         WHERE fetched_at >= datetime('now', '-24 hours')`
      )
      .first(),
    db
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM outage_events
         GROUP BY status`
      )
      .all(),
    db
      .prepare(
        `WITH RECURSIVE days(day) AS (
           SELECT date('now', '-27 days')
           UNION ALL
           SELECT date(day, '+1 day') FROM days WHERE day < date('now')
         )
         SELECT
           days.day,
           (SELECT COUNT(*) FROM outage_events WHERE date(first_seen_at) = days.day) AS events,
           (SELECT COUNT(*) FROM alert_items WHERE date(fetched_at) = days.day) AS items,
           (SELECT COUNT(*) FROM alert_items WHERE date(fetched_at) = days.day AND is_relevant = 1) AS relevant,
           (
             SELECT COUNT(*)
             FROM outage_events
             WHERE date(email_sent_at) = days.day
                OR date(update_email_sent_at) = days.day
           ) AS emails
         FROM days
         ORDER BY days.day`
      )
      .all(),
    db
      .prepare(
        `SELECT id, started_at, finished_at, status, items_seen, items_new,
                items_filtered, items_classified, emails_sent, error
         FROM workflow_runs
         ORDER BY id DESC
         LIMIT 12`
      )
      .all(),
    db
      .prepare(
        `SELECT id, title, status, event_type, location_text, first_seen_at, last_seen_at,
                confidence, source_count, primary_source_title, primary_source_url,
                email_sent_at, update_email_sent_at, merged_into_event_id,
                outage_nature, cause_category, cause_text, research_status,
                research_summary_de, fact_confidence, event_score, evidence_level,
                fact_sheet_json, fact_sheet_updated_at, auto_research_started_at,
                mail_decision_reason
         FROM outage_events
         ORDER BY last_seen_at DESC
         LIMIT 200`
      )
      .all()
  ]);

  return {
    lastRun,
    feedHealth: feedHealth.results,
    totals,
    statusCounts: statusCounts.results,
    activity: activity.results,
    runs: runs.results,
    events: events.results
  };
}

export async function getDebugStatus(db: D1Database) {
  const [
    runLogs,
    feedHealth,
    eventStats,
    snapshotStats,
    researchStats,
    researchErrors,
    recentEvents,
    relevant
  ] = await Promise.all([
    db.prepare("SELECT * FROM workflow_runs ORDER BY id DESC LIMIT 20").all(),
    db.prepare("SELECT * FROM feed_health ORDER BY feed_language").all(),
    db
      .prepare(
        `SELECT
           COUNT(*) AS events_last_24h,
           SUM(CASE WHEN status = 'needs_review' THEN 1 ELSE 0 END) AS needs_review,
           SUM(CASE WHEN status = 'corroborated' THEN 1 ELSE 0 END) AS corroborated
         FROM outage_events
         WHERE first_seen_at >= datetime('now', '-24 hours')`
      )
      .first(),
    db
      .prepare(
        `SELECT
           COUNT(*) AS snapshots_total,
           SUM(CASE WHEN fetch_status = 'success' THEN 1 ELSE 0 END) AS snapshots_success,
           SUM(CASE WHEN fetch_status = 'failed' THEN 1 ELSE 0 END) AS snapshots_failed
         FROM source_snapshots`
      )
      .first(),
    db
      .prepare(
        `SELECT COALESCE(research_status, 'not_started') AS research_status, COUNT(*) AS count
         FROM outage_events
         GROUP BY COALESCE(research_status, 'not_started')`
      )
      .all(),
    db
      .prepare(
        `SELECT id, title, location_text, research_status, admin_note, research_finished_at
         FROM outage_events
         WHERE research_status = 'failed'
         ORDER BY research_finished_at DESC, updated_at DESC
         LIMIT 10`
      )
      .all(),
    db
      .prepare(
        `SELECT id, title, status, event_type, location_text, first_seen_at, last_seen_at,
                confidence, source_count, primary_source_title, primary_source_url,
                outage_nature, cause_category, research_status, fact_confidence,
                event_score, evidence_level, mail_decision_reason
         FROM outage_events
         ORDER BY last_seen_at DESC
         LIMIT 20`
      )
      .all(),
    db
      .prepare(
        `SELECT *
         FROM alert_items
         WHERE is_relevant = 1
         ORDER BY COALESCE(published_at, fetched_at) DESC
         LIMIT 20`
      )
      .all()
  ]);

  return {
    run_logs: runLogs.results,
    feed_health: feedHealth.results,
    event_stats: eventStats,
    snapshot_stats: snapshotStats,
    research_status_counts: researchStats.results,
    last_research_errors: researchErrors.results,
    recent_events: recentEvents.results,
    relevant_items: relevant.results
  };
}

export async function getRecentItems(db: D1Database) {
  const result = await db
    .prepare("SELECT * FROM alert_items ORDER BY id DESC LIMIT 20")
    .all();
  return result.results;
}

export async function getPendingEmailItems(db: D1Database): Promise<StoredAlertItem[]> {
  const result = await db
    .prepare(
      `SELECT *
       FROM alert_items
       WHERE email_sent = 0
         AND is_relevant = 1
         AND status = 'email_error'
         AND confidence >= 0.65
         AND country IN ('CH', 'unknown')
       ORDER BY COALESCE(published_at, fetched_at) DESC
       LIMIT 20`
    )
    .all<StoredAlertItem>();
  return result.results;
}

export async function getUnlinkedRelevantItems(db: D1Database): Promise<StoredAlertItem[]> {
  const result = await db
    .prepare(
      `SELECT *
       FROM alert_items
       WHERE outage_event_id IS NULL
         AND is_relevant = 1
         AND confidence >= 0.65
         AND country IN ('CH', 'unknown')
       ORDER BY COALESCE(published_at, fetched_at) DESC
       LIMIT 20`
    )
    .all<StoredAlertItem>();
  return result.results;
}

export async function findCandidateEvents(
  db: D1Database,
  sinceIso: string
): Promise<OutageEvent[]> {
  const result = await db
    .prepare(
      `SELECT *
       FROM outage_events
       WHERE status != 'dismissed'
         AND last_seen_at >= ?
       ORDER BY last_seen_at DESC
       LIMIT 50`
    )
    .bind(sinceIso)
    .all<OutageEvent>();
  return result.results;
}

export async function createOutageEvent(
  db: D1Database,
  input: {
    title: string;
    eventType: string;
    locationText: string;
    normalizedLocation: string;
    canton: string | null;
    country: string;
    seenAt: string;
    summary: string;
    reason: string;
    confidence: number;
    primarySourceUrl: string;
    primarySourceTitle: string;
  }
): Promise<OutageEvent> {
  const result = await db
    .prepare(
      `INSERT INTO outage_events (
         title, status, event_type, location_text, normalized_location, canton, country,
         first_seen_at, last_seen_at, summary, reason, confidence,
         source_count, primary_source_url, primary_source_title
       ) VALUES (?, 'needs_review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .bind(
      input.title,
      input.eventType,
      input.locationText,
      input.normalizedLocation,
      input.canton,
      input.country,
      input.seenAt,
      input.seenAt,
      input.summary,
      input.reason,
      input.confidence,
      input.primarySourceUrl,
      input.primarySourceTitle
    )
    .run();

  const meta = result.meta as { last_row_id?: number } | undefined;
  const id = meta?.last_row_id;
  if (typeof id !== "number") throw new Error("Could not create outage event");

  const event = await getOutageEvent(db, id);
  if (!event) throw new Error("Created outage event could not be loaded");
  return event;
}

export async function attachSourceToEvent(
  db: D1Database,
  input: {
    eventId: number;
    alertItem: StoredAlertItem;
    relationScore: number;
    isPrimary: boolean;
  }
): Promise<OutageSource> {
  const sourceIntel = classifySource({
    url: input.alertItem.url,
    title: input.alertItem.title,
    sourceName: input.alertItem.source
  });
  await db
    .prepare(
      `INSERT OR IGNORE INTO outage_sources (
         outage_event_id, alert_item_id, source_url, source_title, source_name,
         published_at, relation_score, is_primary, source_kind, source_weight,
         is_official, independence_key
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.eventId,
      input.alertItem.id,
      input.alertItem.url,
      input.alertItem.title,
      input.alertItem.source,
      input.alertItem.published_at,
      input.relationScore,
      input.isPrimary ? 1 : 0,
      sourceIntel.source_kind,
      sourceIntel.source_weight,
      sourceIntel.is_official,
      sourceIntel.independence_key
    )
    .run();

  const source = await db
    .prepare(
      `SELECT *
       FROM outage_sources
       WHERE outage_event_id = ? AND alert_item_id = ?
       ORDER BY id DESC
       LIMIT 1`
    )
    .bind(input.eventId, input.alertItem.id)
    .first<OutageSource>();
  if (!source) throw new Error("Outage source could not be loaded after attach");
  return source;
}

export async function refreshOutageEventAfterSource(
  db: D1Database,
  eventId: number,
  patch: {
    lastSeenAt: string;
    confidence: number;
    summary: string;
    reason: string;
  }
): Promise<OutageEvent> {
  await db
    .prepare(
      `UPDATE outage_events
       SET first_seen_at = CASE
             WHEN ? < first_seen_at THEN ? ELSE first_seen_at
           END,
           last_seen_at = CASE
             WHEN ? > last_seen_at THEN ? ELSE last_seen_at
           END,
           source_count = (SELECT COUNT(*) FROM outage_sources WHERE outage_event_id = ?),
           status = CASE
             WHEN (SELECT COUNT(*) FROM outage_sources WHERE outage_event_id = ?) >= 2
                  AND status = 'needs_review'
             THEN 'corroborated'
             ELSE status
           END,
           confidence = MAX(confidence, ?),
           summary = CASE WHEN LENGTH(COALESCE(summary, '')) = 0 THEN ? ELSE summary END,
           reason = CASE WHEN LENGTH(COALESCE(reason, '')) = 0 THEN ? ELSE reason END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      patch.lastSeenAt,
      patch.lastSeenAt,
      patch.lastSeenAt,
      patch.lastSeenAt,
      eventId,
      eventId,
      patch.confidence,
      patch.summary,
      patch.reason,
      eventId
    )
    .run();

  const event = await getOutageEvent(db, eventId);
  if (!event) throw new Error("Updated outage event could not be loaded");
  return event;
}

export async function markOutageEventEmailSent(
  db: D1Database,
  eventId: number,
  sentAt: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE outage_events
       SET email_sent = 1, email_sent_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(sentAt, eventId)
    .run();
}

export async function markOutageEventUpdateEmailSent(
  db: D1Database,
  eventId: number,
  sentAt: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE outage_events
       SET update_email_sent_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(sentAt, eventId)
    .run();
}

export async function getOutageEvent(
  db: D1Database,
  eventId: number
): Promise<OutageEvent | null> {
  return await db.prepare("SELECT * FROM outage_events WHERE id = ?").bind(eventId).first<OutageEvent>();
}

export async function getOutageEventSources(
  db: D1Database,
  eventId: number
): Promise<OutageSource[]> {
  const result = await db
    .prepare(
      `SELECT *
       FROM outage_sources
       WHERE outage_event_id = ?
       ORDER BY is_primary DESC, COALESCE(published_at, created_at) DESC`
    )
    .bind(eventId)
    .all<OutageSource>();
  return result.results.map((source) => {
    const intel = classifySource({
      url: source.source_url,
      title: source.source_title,
      sourceName: source.source_name
    });
    const hasUsefulStoredIntel =
      Boolean(source.independence_key) &&
      source.source_kind !== null &&
      source.source_kind !== "other" &&
      source.source_weight !== null &&
      source.is_official !== null;
    if (hasUsefulStoredIntel) return source;

    return {
      ...source,
      source_kind: intel.source_kind,
      source_weight: intel.source_weight,
      is_official: intel.is_official,
      independence_key: intel.independence_key
    };
  });
}

export async function getOutageEventSnapshots(
  db: D1Database,
  eventId: number
): Promise<SourceSnapshot[]> {
  const result = await db
    .prepare(
      `SELECT *
       FROM source_snapshots
       WHERE outage_event_id = ?
       ORDER BY fetched_at DESC, id DESC`
    )
    .bind(eventId)
    .all<SourceSnapshot>();
  return result.results;
}

export async function insertSourceSnapshot(
  db: D1Database,
  snapshot: {
    alertItemId: number | null;
    outageEventId: number | null;
    outageSourceId: number | null;
    url: string;
    finalUrl: string | null;
    fetchMethod: string;
    fetchStatus: "success" | "failed";
    httpStatus: number | null;
    title: string | null;
    markdownR2Key: string | null;
    markdownExcerpt: string | null;
    contentHash: string | null;
    fetchedAt: string;
    error: string | null;
  }
): Promise<SourceSnapshot> {
  const result = await db
    .prepare(
      `INSERT INTO source_snapshots (
         alert_item_id, outage_event_id, outage_source_id, url, final_url,
         fetch_method, fetch_status, http_status, title, markdown_r2_key,
         markdown_excerpt, content_hash, fetched_at, error
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      snapshot.alertItemId,
      snapshot.outageEventId,
      snapshot.outageSourceId,
      snapshot.url,
      snapshot.finalUrl,
      snapshot.fetchMethod,
      snapshot.fetchStatus,
      snapshot.httpStatus,
      snapshot.title,
      snapshot.markdownR2Key,
      snapshot.markdownExcerpt,
      snapshot.contentHash,
      snapshot.fetchedAt,
      snapshot.error
    )
    .run();

  const meta = result.meta as { last_row_id?: number } | undefined;
  if (typeof meta?.last_row_id === "number") {
    const row = await db
      .prepare("SELECT * FROM source_snapshots WHERE id = ?")
      .bind(meta.last_row_id)
      .first<SourceSnapshot>();
    if (row) return row;
  }

  const row = await db
    .prepare(
      `SELECT *
       FROM source_snapshots
       WHERE url = ? AND fetched_at = ?
       ORDER BY id DESC
       LIMIT 1`
    )
    .bind(snapshot.url, snapshot.fetchedAt)
    .first<SourceSnapshot>();
  if (!row) throw new Error("Source snapshot could not be loaded after insert");
  return row;
}

export async function getKnownSourceUrlsForEvent(
  db: D1Database,
  eventId: number
): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT source_url AS url FROM outage_sources WHERE outage_event_id = ?
       UNION
       SELECT url FROM source_snapshots WHERE outage_event_id = ?`
    )
    .bind(eventId, eventId)
    .all<{ url: string }>();
  return result.results.map((row) => row.url);
}

export async function startEventResearch(
  db: D1Database,
  eventId: number,
  startedAt: string,
  options: { automatic?: boolean } = {}
): Promise<boolean> {
  const statusPredicate = options.automatic
    ? "COALESCE(research_status, 'not_started') = 'not_started' AND auto_research_started_at IS NULL"
    : "COALESCE(research_status, 'not_started') != 'running'";

  const result = await db
    .prepare(
      `UPDATE outage_events
       SET research_status = 'running',
           research_started_at = ?,
           auto_research_started_at = CASE
             WHEN ? = 1 AND auto_research_started_at IS NULL THEN ?
             ELSE auto_research_started_at
           END,
           research_finished_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND ${statusPredicate}`
    )
    .bind(startedAt, options.automatic ? 1 : 0, startedAt, eventId)
    .run();
  return changes(result) > 0;
}

export async function finishEventResearch(
  db: D1Database,
  eventId: number,
  status: Extract<ResearchStatus, "completed" | "failed">,
  finishedAt: string,
  error: string | null
): Promise<void> {
  const event = await getOutageEvent(db, eventId);
  await db
    .prepare(
      `UPDATE outage_events
       SET research_status = ?,
           research_finished_at = ?,
           admin_note = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      status,
      finishedAt,
      error ? composeAdminNote(event?.admin_note ?? null, error, "research failed") : event?.admin_note ?? null,
      eventId
    )
    .run();
}

export async function updateEventResearchAssessment(
  db: D1Database,
  eventId: number,
  assessment: ResearchAssessment,
  factSheet?: FactSheet | null
): Promise<OutageEvent> {
  await db
    .prepare(
      `UPDATE outage_events
       SET outage_nature = ?,
           cause_category = ?,
           cause_text = ?,
           status = CASE
             WHEN ? = 'resolved' AND status != 'dismissed' THEN 'resolved'
             ELSE status
           END,
           research_summary_de = ?,
           fact_confidence = ?,
           fact_sheet_json = COALESCE(?, fact_sheet_json),
           fact_sheet_updated_at = CASE WHEN ? IS NULL THEN fact_sheet_updated_at ELSE CURRENT_TIMESTAMP END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      assessment.outage_nature,
      assessment.cause_category,
      assessment.cause_text,
      assessment.status,
      assessment.research_summary_de,
      assessment.fact_confidence,
      factSheet ? JSON.stringify(factSheet) : null,
      factSheet ? 1 : null,
      eventId
    )
    .run();

  const event = await getOutageEvent(db, eventId);
  if (!event) throw new Error("Event vanished after research assessment update");
  return event;
}

export async function updateEventIntelligence(
  db: D1Database,
  eventId: number,
  input: {
    eventScore: number;
    evidenceLevel: EvidenceLevel;
    factSheet: FactSheet;
    mailDecisionReason?: string | null;
  }
): Promise<OutageEvent> {
  await db
    .prepare(
      `UPDATE outage_events
       SET event_score = ?,
           evidence_level = ?,
           fact_sheet_json = ?,
           fact_sheet_updated_at = ?,
           mail_decision_reason = COALESCE(?, mail_decision_reason),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      input.eventScore,
      input.evidenceLevel,
      JSON.stringify(input.factSheet),
      input.factSheet.generated_at,
      input.mailDecisionReason ?? null,
      eventId
    )
    .run();

  const event = await getOutageEvent(db, eventId);
  if (!event) throw new Error("Event vanished after intelligence update");
  return event;
}

export async function updateOutageEventMailDecision(
  db: D1Database,
  eventId: number,
  reason: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE outage_events
       SET mail_decision_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(reason, eventId)
    .run();
}

export async function upsertMergeSuggestion(
  db: D1Database,
  input: {
    sourceEventId: number;
    targetEventId: number;
    heuristicScore: number;
    aiConfidence: number | null;
    sameEvent: boolean;
    reason: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO event_merge_suggestions (
         source_event_id, target_event_id, heuristic_score, ai_confidence,
         same_event, reason, status
       ) VALUES (?, ?, ?, ?, ?, ?, 'open')
       ON CONFLICT(source_event_id, target_event_id) DO UPDATE SET
         heuristic_score = excluded.heuristic_score,
         ai_confidence = excluded.ai_confidence,
         same_event = excluded.same_event,
         reason = excluded.reason,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(
      input.sourceEventId,
      input.targetEventId,
      input.heuristicScore,
      input.aiConfidence,
      input.sameEvent ? 1 : 0,
      input.reason
    )
    .run();
}

export async function getMergeSuggestionsForEvent(
  db: D1Database,
  eventId: number
): Promise<EventMergeSuggestion[]> {
  const result = await db
    .prepare(
      `SELECT *
       FROM event_merge_suggestions
       WHERE source_event_id = ?
         AND status = 'open'
       ORDER BY same_event DESC, COALESCE(ai_confidence, 0) DESC, heuristic_score DESC
       LIMIT 8`
    )
    .bind(eventId)
    .all<EventMergeSuggestion>();
  return result.results;
}

export async function refreshOutageEventSourceCount(
  db: D1Database,
  eventId: number
): Promise<OutageEvent> {
  return await refreshOutageEventAggregates(db, eventId);
}

export async function getPendingOutageEventEmails(db: D1Database): Promise<OutageEvent[]> {
  const result = await db
    .prepare(
      `SELECT *
       FROM outage_events
       WHERE email_sent = 0
         AND status != 'dismissed'
         AND (
           COALESCE(event_score, 0) >= 80
           OR (COALESCE(event_score, 0) >= 70 AND evidence_level = 'official')
         )
       ORDER BY first_seen_at DESC
       LIMIT 10`
    )
    .all<OutageEvent>();
  return result.results;
}

export async function getEventsNeedingIntelligence(
  db: D1Database,
  limit = 5
): Promise<OutageEvent[]> {
  const result = await db
    .prepare(
      `SELECT *
       FROM outage_events
       WHERE status != 'dismissed'
         AND (
           COALESCE(event_score, 0) = 0
           OR fact_sheet_json IS NULL
           OR evidence_level IS NULL
         )
       ORDER BY last_seen_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<OutageEvent>();
  return result.results;
}

async function refreshOutageEventAggregates(db: D1Database, eventId: number): Promise<OutageEvent> {
  await db
    .prepare(
      `UPDATE outage_events
       SET source_count = (SELECT COUNT(*) FROM outage_sources WHERE outage_event_id = ?),
           status = CASE
             WHEN (SELECT COUNT(*) FROM outage_sources WHERE outage_event_id = ?) >= 2
                  AND status = 'needs_review'
             THEN 'corroborated'
             ELSE status
           END,
           first_seen_at = COALESCE(
             (SELECT MIN(COALESCE(published_at, created_at)) FROM outage_sources WHERE outage_event_id = ?),
             first_seen_at
           ),
           last_seen_at = COALESCE(
             (SELECT MAX(COALESCE(published_at, created_at)) FROM outage_sources WHERE outage_event_id = ?),
             last_seen_at
           ),
           primary_source_url = COALESCE(
             (SELECT source_url FROM outage_sources WHERE outage_event_id = ? ORDER BY is_primary DESC, id ASC LIMIT 1),
             primary_source_url
           ),
           primary_source_title = COALESCE(
             (SELECT source_title FROM outage_sources WHERE outage_event_id = ? ORDER BY is_primary DESC, id ASC LIMIT 1),
             primary_source_title
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(eventId, eventId, eventId, eventId, eventId, eventId, eventId)
    .run();

  const event = await getOutageEvent(db, eventId);
  if (!event) throw new Error("Outage event could not be loaded after aggregate refresh");
  return event;
}

function composeAdminNote(existing: string | null, note: string | null, action: string): string {
  const stamp = new Date().toISOString();
  const entry = `[${stamp}] ${action}${note ? `: ${note}` : ""}`;
  return existing ? `${existing}\n${entry}` : entry;
}

export async function mergeOutageEvent(
  db: D1Database,
  sourceEventId: number,
  targetEventId: number,
  adminNote: string | null
): Promise<{ source: OutageEvent; target: OutageEvent }> {
  if (sourceEventId === targetEventId) {
    throw new Error("Source and target event must differ");
  }

  const [source, target] = await Promise.all([
    getOutageEvent(db, sourceEventId),
    getOutageEvent(db, targetEventId)
  ]);
  if (!source) throw new Error(`Source event ${sourceEventId} not found`);
  if (!target) throw new Error(`Target event ${targetEventId} not found`);
  if (source.status === "dismissed" && source.merged_into_event_id === targetEventId) {
    return { source, target };
  }

  await db
    .prepare(
      `UPDATE outage_sources
       SET outage_event_id = ?,
           is_primary = 0
       WHERE outage_event_id = ?
         AND alert_item_id NOT IN (
           SELECT alert_item_id FROM outage_sources WHERE outage_event_id = ?
         )`
    )
    .bind(targetEventId, sourceEventId, targetEventId)
    .run();

  await db
    .prepare("DELETE FROM outage_sources WHERE outage_event_id = ?")
    .bind(sourceEventId)
    .run();

  await db
    .prepare(
      `UPDATE alert_items
       SET outage_event_id = ?, event_linked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE outage_event_id = ?`
    )
    .bind(targetEventId, sourceEventId)
    .run();

  const updatedTarget = await refreshOutageEventAggregates(db, targetEventId);

  await db
    .prepare(
      `UPDATE event_merge_suggestions
       SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE source_event_id = ? AND target_event_id = ?`
    )
    .bind(sourceEventId, targetEventId)
    .run();

  await db
    .prepare(
      `UPDATE outage_events
       SET status = 'dismissed',
           merged_into_event_id = ?,
           source_count = 0,
           admin_note = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      targetEventId,
      composeAdminNote(source.admin_note, adminNote, `merged into event ${targetEventId}`),
      sourceEventId
    )
    .run();

  const dismissedSource = await getOutageEvent(db, sourceEventId);
  if (!dismissedSource) throw new Error("Source event vanished after merge");
  return { source: dismissedSource, target: updatedTarget };
}

export async function dismissOutageEvent(
  db: D1Database,
  eventId: number,
  adminNote: string | null
): Promise<OutageEvent> {
  const event = await getOutageEvent(db, eventId);
  if (!event) throw new Error(`Event ${eventId} not found`);

  await db
    .prepare(
      `UPDATE outage_events
       SET status = 'dismissed',
           admin_note = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(composeAdminNote(event.admin_note, adminNote, "dismissed"), eventId)
    .run();

  const updated = await getOutageEvent(db, eventId);
  if (!updated) throw new Error("Event vanished after dismiss");
  return updated;
}

export async function markOutageEventCorroborated(
  db: D1Database,
  eventId: number,
  adminNote: string | null
): Promise<OutageEvent> {
  const event = await getOutageEvent(db, eventId);
  if (!event) throw new Error(`Event ${eventId} not found`);

  await db
    .prepare(
      `UPDATE outage_events
       SET status = 'corroborated',
           admin_note = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(composeAdminNote(event.admin_note, adminNote, "marked corroborated"), eventId)
    .run();

  const updated = await getOutageEvent(db, eventId);
  if (!updated) throw new Error("Event vanished after corroboration");
  return updated;
}
