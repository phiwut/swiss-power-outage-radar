CREATE TABLE IF NOT EXISTS outage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_review',
  event_type TEXT NOT NULL DEFAULT 'unclear',

  location_text TEXT,
  normalized_location TEXT,
  canton TEXT,
  country TEXT DEFAULT 'CH',

  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,

  started_at_estimate TEXT,
  resolved_at_estimate TEXT,

  summary TEXT,
  reason TEXT,
  confidence REAL DEFAULT 0,

  source_count INTEGER DEFAULT 0,
  primary_source_url TEXT,
  primary_source_title TEXT,

  email_sent INTEGER DEFAULT 0,
  email_sent_at TEXT,
  update_email_sent_at TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outage_events_status ON outage_events(status);
CREATE INDEX IF NOT EXISTS idx_outage_events_location_time ON outage_events(normalized_location, first_seen_at);
CREATE INDEX IF NOT EXISTS idx_outage_events_last_seen ON outage_events(last_seen_at);

CREATE TABLE IF NOT EXISTS outage_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  outage_event_id INTEGER NOT NULL,
  alert_item_id INTEGER NOT NULL,

  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_name TEXT,
  published_at TEXT,

  relation_score REAL DEFAULT 0,
  is_primary INTEGER DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (outage_event_id) REFERENCES outage_events(id),
  FOREIGN KEY (alert_item_id) REFERENCES alert_items(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outage_sources_unique
ON outage_sources(outage_event_id, alert_item_id);

CREATE INDEX IF NOT EXISTS idx_outage_sources_event
ON outage_sources(outage_event_id);

ALTER TABLE alert_items ADD COLUMN outage_event_id INTEGER;
ALTER TABLE alert_items ADD COLUMN event_linked_at TEXT;
