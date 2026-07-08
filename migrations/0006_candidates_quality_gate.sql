CREATE TABLE IF NOT EXISTS outage_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_item_id INTEGER NOT NULL,
  snapshot_id INTEGER,
  status TEXT NOT NULL DEFAULT 'new',
  location_text TEXT,
  location_granularity TEXT DEFAULT 'unknown',
  is_ch_incident INTEGER DEFAULT 0,
  event_type TEXT DEFAULT 'unclear',
  relevance_role TEXT DEFAULT 'unknown',
  quality_score REAL DEFAULT 0,
  quality_reasons_json TEXT,
  rejection_reason TEXT,
  outage_event_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alert_item_id) REFERENCES alert_items(id),
  FOREIGN KEY (snapshot_id) REFERENCES source_snapshots(id),
  FOREIGN KEY (outage_event_id) REFERENCES outage_events(id)
);

CREATE INDEX IF NOT EXISTS idx_outage_candidates_alert ON outage_candidates(alert_item_id);
CREATE INDEX IF NOT EXISTS idx_outage_candidates_status ON outage_candidates(status);
CREATE INDEX IF NOT EXISTS idx_outage_candidates_event ON outage_candidates(outage_event_id);

CREATE TABLE IF NOT EXISTS outage_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER,
  outage_event_id INTEGER,
  outage_source_id INTEGER,
  snapshot_id INTEGER,
  fact_type TEXT NOT NULL,
  value_text TEXT NOT NULL,
  value_json TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  evidence_excerpt TEXT NOT NULL,
  source_role TEXT DEFAULT 'auto',
  verified_by TEXT DEFAULT 'auto',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES outage_candidates(id),
  FOREIGN KEY (outage_event_id) REFERENCES outage_events(id),
  FOREIGN KEY (outage_source_id) REFERENCES outage_sources(id),
  FOREIGN KEY (snapshot_id) REFERENCES source_snapshots(id)
);

CREATE INDEX IF NOT EXISTS idx_outage_facts_candidate ON outage_facts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_outage_facts_event ON outage_facts(outage_event_id);
CREATE INDEX IF NOT EXISTS idx_outage_facts_type ON outage_facts(fact_type);

CREATE TABLE IF NOT EXISTS exa_search_cache (
  query_hash TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  event_location_key TEXT,
  result_json TEXT NOT NULL,
  searched_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exa_search_cache_location ON exa_search_cache(event_location_key, searched_at);

ALTER TABLE outage_events ADD COLUMN public_status TEXT DEFAULT 'hidden';
ALTER TABLE outage_events ADD COLUMN verification_level TEXT DEFAULT 'auto_analyzed';
ALTER TABLE outage_events ADD COLUMN location_granularity TEXT DEFAULT 'unknown';
ALTER TABLE outage_events ADD COLUMN event_quality_state TEXT DEFAULT 'candidate_only';
