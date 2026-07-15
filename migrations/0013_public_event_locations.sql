CREATE TABLE IF NOT EXISTS event_public_locations (
  outage_event_id INTEGER PRIMARY KEY,
  query_text TEXT NOT NULL,
  label TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  precision TEXT NOT NULL,
  provider TEXT NOT NULL,
  resolved_at TEXT NOT NULL,
  FOREIGN KEY (outage_event_id) REFERENCES outage_events(id)
);

CREATE INDEX IF NOT EXISTS idx_event_public_locations_provider
ON event_public_locations(provider, resolved_at DESC);
