CREATE TABLE IF NOT EXISTS alert_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_language TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT,
  snippet TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  item_hash TEXT NOT NULL UNIQUE,

  status TEXT DEFAULT 'new',
  is_relevant INTEGER DEFAULT 0,
  confidence REAL,
  country TEXT,
  location_text TEXT,
  event_type TEXT,
  summary TEXT,
  reason TEXT,
  ai_raw TEXT,

  email_sent INTEGER DEFAULT 0,
  email_sent_at TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_items_hash ON alert_items(item_hash);
CREATE INDEX IF NOT EXISTS idx_alert_items_relevant ON alert_items(is_relevant, email_sent);
CREATE INDEX IF NOT EXISTS idx_alert_items_fetched ON alert_items(fetched_at);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  items_seen INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  items_filtered INTEGER DEFAULT 0,
  items_classified INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  error TEXT
);

CREATE TABLE IF NOT EXISTS feed_health (
  feed_language TEXT PRIMARY KEY,
  last_checked_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  items_seen_last_run INTEGER DEFAULT 0,
  items_new_last_run INTEGER DEFAULT 0
);
