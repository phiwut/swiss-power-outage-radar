CREATE TABLE IF NOT EXISTS event_public_location_misses (
  outage_event_id INTEGER PRIMARY KEY,
  query_text TEXT NOT NULL,
  retry_after TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  FOREIGN KEY (outage_event_id) REFERENCES outage_events(id)
);

CREATE INDEX IF NOT EXISTS idx_event_public_location_misses_retry
ON event_public_location_misses(retry_after);
