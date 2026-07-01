CREATE TABLE IF NOT EXISTS source_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_item_id INTEGER,
  outage_event_id INTEGER,
  outage_source_id INTEGER,
  url TEXT NOT NULL,
  final_url TEXT,
  fetch_method TEXT NOT NULL,
  fetch_status TEXT NOT NULL,
  http_status INTEGER,
  title TEXT,
  markdown_r2_key TEXT,
  markdown_excerpt TEXT,
  content_hash TEXT,
  fetched_at TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alert_item_id) REFERENCES alert_items(id),
  FOREIGN KEY (outage_event_id) REFERENCES outage_events(id),
  FOREIGN KEY (outage_source_id) REFERENCES outage_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_source_snapshots_event ON source_snapshots(outage_event_id);
CREATE INDEX IF NOT EXISTS idx_source_snapshots_source ON source_snapshots(outage_source_id);
CREATE INDEX IF NOT EXISTS idx_source_snapshots_status ON source_snapshots(fetch_status);
CREATE INDEX IF NOT EXISTS idx_source_snapshots_hash ON source_snapshots(content_hash);

ALTER TABLE outage_events ADD COLUMN outage_nature TEXT DEFAULT 'unknown';
ALTER TABLE outage_events ADD COLUMN cause_category TEXT DEFAULT 'unknown';
ALTER TABLE outage_events ADD COLUMN cause_text TEXT;
ALTER TABLE outage_events ADD COLUMN research_status TEXT DEFAULT 'not_started';
ALTER TABLE outage_events ADD COLUMN research_started_at TEXT;
ALTER TABLE outage_events ADD COLUMN research_finished_at TEXT;
ALTER TABLE outage_events ADD COLUMN research_summary_de TEXT;
ALTER TABLE outage_events ADD COLUMN fact_confidence REAL;
