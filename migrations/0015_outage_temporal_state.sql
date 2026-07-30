ALTER TABLE outage_events ADD COLUMN last_confirmed_active_at TEXT;
ALTER TABLE outage_events ADD COLUMN expected_restore_at TEXT;
ALTER TABLE outage_events ADD COLUMN resolution_earliest_at TEXT;
ALTER TABLE outage_events ADD COLUMN resolution_latest_at TEXT;
ALTER TABLE outage_events ADD COLUMN time_confidence TEXT NOT NULL DEFAULT 'unknown';

CREATE TABLE IF NOT EXISTS outage_event_source_presence (
  outage_event_id INTEGER NOT NULL,
  source_registry_id INTEGER NOT NULL,
  last_confirmed_at TEXT NOT NULL,
  first_missing_at TEXT,
  consecutive_missing_checks INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (outage_event_id, source_registry_id),
  FOREIGN KEY (outage_event_id) REFERENCES outage_events(id),
  FOREIGN KEY (source_registry_id) REFERENCES source_registry(id)
);

CREATE INDEX IF NOT EXISTS idx_outage_event_source_presence_source
ON outage_event_source_presence(source_registry_id, consecutive_missing_checks);

UPDATE outage_events
SET last_confirmed_active_at = last_seen_at
WHERE status != 'resolved'
  AND last_confirmed_active_at IS NULL;
