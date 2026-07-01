ALTER TABLE outage_events ADD COLUMN event_score REAL DEFAULT 0;
ALTER TABLE outage_events ADD COLUMN evidence_level TEXT DEFAULT 'weak';
ALTER TABLE outage_events ADD COLUMN fact_sheet_json TEXT;
ALTER TABLE outage_events ADD COLUMN fact_sheet_updated_at TEXT;
ALTER TABLE outage_events ADD COLUMN auto_research_started_at TEXT;
ALTER TABLE outage_events ADD COLUMN mail_decision_reason TEXT;

ALTER TABLE outage_sources ADD COLUMN source_kind TEXT DEFAULT 'other';
ALTER TABLE outage_sources ADD COLUMN source_weight REAL DEFAULT 0.4;
ALTER TABLE outage_sources ADD COLUMN is_official INTEGER DEFAULT 0;
ALTER TABLE outage_sources ADD COLUMN independence_key TEXT;

CREATE TABLE IF NOT EXISTS event_merge_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_event_id INTEGER NOT NULL,
  target_event_id INTEGER NOT NULL,
  heuristic_score REAL NOT NULL,
  ai_confidence REAL,
  same_event INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_event_id) REFERENCES outage_events(id),
  FOREIGN KEY (target_event_id) REFERENCES outage_events(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_merge_suggestions_pair
ON event_merge_suggestions(source_event_id, target_event_id);

CREATE INDEX IF NOT EXISTS idx_event_merge_suggestions_source
ON event_merge_suggestions(source_event_id, status);

CREATE INDEX IF NOT EXISTS idx_outage_events_score
ON outage_events(event_score, evidence_level);

CREATE INDEX IF NOT EXISTS idx_outage_sources_quality
ON outage_sources(outage_event_id, is_official, independence_key);
