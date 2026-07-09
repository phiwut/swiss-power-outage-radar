CREATE TABLE IF NOT EXISTS geo_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  scope TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  items_seen INTEGER DEFAULT 0,
  items_upserted INTEGER DEFAULT 0,
  error TEXT
);

CREATE TABLE IF NOT EXISTS geo_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL DEFAULT 'CH',
  canton_key TEXT,
  canton_code TEXT,
  canton_name TEXT,
  district_key TEXT,
  district_name TEXT,
  municipality_key TEXT,
  municipality_name TEXT,
  locality_key TEXT,
  locality_name TEXT,
  postcode TEXT,
  street_name TEXT,
  place_type TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  parent_external_id TEXT,
  source TEXT NOT NULL,
  source_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_geo_places_normalized ON geo_places(normalized_name, place_type);
CREATE INDEX IF NOT EXISTS idx_geo_places_canton ON geo_places(canton_code, place_type);
CREATE INDEX IF NOT EXISTS idx_geo_places_municipality ON geo_places(municipality_key, place_type);
CREATE INDEX IF NOT EXISTS idx_geo_places_postcode ON geo_places(postcode);

CREATE TABLE IF NOT EXISTS geo_place_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  language TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(place_id, normalized_alias),
  FOREIGN KEY (place_id) REFERENCES geo_places(id)
);

CREATE INDEX IF NOT EXISTS idx_geo_place_aliases_normalized ON geo_place_aliases(normalized_alias);

CREATE TABLE IF NOT EXISTS source_place_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outage_source_id INTEGER,
  alert_item_id INTEGER,
  outage_event_id INTEGER,
  raw_text TEXT NOT NULL,
  matched_text TEXT,
  place_id INTEGER,
  place_type TEXT,
  role TEXT NOT NULL DEFAULT 'possibly_affected',
  confidence REAL NOT NULL DEFAULT 0,
  match_method TEXT NOT NULL,
  evidence_quote TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (outage_source_id) REFERENCES outage_sources(id),
  FOREIGN KEY (alert_item_id) REFERENCES alert_items(id),
  FOREIGN KEY (outage_event_id) REFERENCES outage_events(id),
  FOREIGN KEY (place_id) REFERENCES geo_places(id)
);

CREATE INDEX IF NOT EXISTS idx_source_place_mentions_event ON source_place_mentions(outage_event_id, role);
CREATE INDEX IF NOT EXISTS idx_source_place_mentions_source ON source_place_mentions(outage_source_id);
CREATE INDEX IF NOT EXISTS idx_source_place_mentions_place ON source_place_mentions(place_id);

CREATE TABLE IF NOT EXISTS event_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outage_event_id INTEGER NOT NULL,
  place_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'possibly_affected',
  confidence REAL NOT NULL DEFAULT 0,
  source_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT,
  last_seen_at TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(outage_event_id, place_id),
  FOREIGN KEY (outage_event_id) REFERENCES outage_events(id),
  FOREIGN KEY (place_id) REFERENCES geo_places(id)
);

CREATE INDEX IF NOT EXISTS idx_event_places_event ON event_places(outage_event_id, role, confidence);
CREATE INDEX IF NOT EXISTS idx_event_places_place ON event_places(place_id);
