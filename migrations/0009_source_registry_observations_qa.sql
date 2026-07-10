CREATE TABLE IF NOT EXISTS source_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL UNIQUE,
  operator_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT NOT NULL,
  area_text TEXT NOT NULL,
  trust_level TEXT NOT NULL DEFAULT 'official',
  check_interval_minutes INTEGER NOT NULL DEFAULT 15,
  priority INTEGER NOT NULL DEFAULT 50,
  adapter_config_json TEXT,
  firecrawl_enabled INTEGER NOT NULL DEFAULT 0,
  firecrawl_monitor_id TEXT,
  last_checked_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  health_status TEXT NOT NULL DEFAULT 'unknown',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_source_registry_due
ON source_registry(enabled, health_status, last_checked_at, priority);

CREATE TABLE IF NOT EXISTS source_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_registry_id INTEGER,
  source_key TEXT NOT NULL,
  source_type TEXT NOT NULL,
  operator_name TEXT,
  observation_hash TEXT NOT NULL UNIQUE,
  canonical_status TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'unclear',
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  location_text TEXT,
  area_text TEXT,
  started_at TEXT,
  resolved_at TEXT,
  observed_at TEXT NOT NULL,
  published_at TEXT,
  evidence_excerpt TEXT NOT NULL,
  raw_payload_json TEXT,
  extractor_version TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  independence_key TEXT,
  alert_item_id INTEGER,
  outage_event_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_registry_id) REFERENCES source_registry(id),
  FOREIGN KEY (alert_item_id) REFERENCES alert_items(id),
  FOREIGN KEY (outage_event_id) REFERENCES outage_events(id)
);

CREATE INDEX IF NOT EXISTS idx_source_observations_status
ON source_observations(canonical_status, observed_at);

CREATE INDEX IF NOT EXISTS idx_source_observations_source
ON source_observations(source_registry_id, observed_at);

CREATE TABLE IF NOT EXISTS outage_event_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outage_event_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  change_type TEXT NOT NULL,
  source_observation_id INTEGER,
  source_snapshot_id INTEGER,
  event_state_json TEXT NOT NULL,
  evidence_excerpt TEXT,
  extractor_version TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(outage_event_id, version_number),
  FOREIGN KEY (outage_event_id) REFERENCES outage_events(id),
  FOREIGN KEY (source_observation_id) REFERENCES source_observations(id),
  FOREIGN KEY (source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE INDEX IF NOT EXISTS idx_outage_event_versions_event
ON outage_event_versions(outage_event_id, version_number);

CREATE TABLE IF NOT EXISTS qa_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_date TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  numerator REAL,
  denominator REAL,
  dimension_key TEXT,
  notes TEXT,
  calculated_at TEXT NOT NULL,
  UNIQUE(metric_date, metric_name, dimension_key)
);

CREATE INDEX IF NOT EXISTS idx_qa_metrics_name_date
ON qa_metrics(metric_name, metric_date);

ALTER TABLE outage_facts ADD COLUMN source_observation_id INTEGER;
ALTER TABLE outage_facts ADD COLUMN observed_at TEXT;
ALTER TABLE outage_facts ADD COLUMN extractor_version TEXT DEFAULT 'candidate-quality/v1';

ALTER TABLE alert_items ADD COLUMN source_observation_id INTEGER;
ALTER TABLE outage_sources ADD COLUMN source_registry_id INTEGER;
ALTER TABLE outage_sources ADD COLUMN source_observation_id INTEGER;

INSERT OR IGNORE INTO source_registry (
  source_key, operator_name, source_type, url, area_text, trust_level,
  check_interval_minutes, priority, adapter_config_json, firecrawl_enabled, health_status
) VALUES
  (
    'bkw-outage',
    'BKW',
    'html',
    'https://outage.bkw.ch/',
    'BKW Versorgungsgebiet in Bern, Jura, Solothurn, Neuenburg und angrenzenden Gebieten',
    'official',
    15,
    95,
    '{"language":"de","status_mode":"current_page","no_outage_terms":["keine störungen bekannt","keine stoerungen bekannt","no outages known"]}',
    1,
    'unknown'
  ),
  (
    'ewz-stoerungen',
    'ewz',
    'html',
    'https://www.ewz.ch/de/services/stoerungen.html',
    'Stadt Zürich und ewz Versorgungsgebiet',
    'official',
    15,
    90,
    '{"language":"de","status_mode":"current_page","no_outage_terms":["keine störungsmeldungen","keine stoerungsmeldungen"]}',
    1,
    'unknown'
  ),
  (
    'ckw-stoerungen',
    'CKW',
    'html',
    'https://www.ckw.ch/kontakt/stoerungen',
    'Zentralschweiz, insbesondere Kanton Luzern und angrenzende CKW-Netzgebiete',
    'official',
    30,
    80,
    '{"language":"de","status_mode":"current_page","no_outage_terms":["momentan sind keine netzstörungen bekannt","momentan sind keine netzstoerungen bekannt"]}',
    0,
    'unknown'
  ),
  (
    'ewb-stoerungsmeldungen',
    'Energie Wasser Bern',
    'html',
    'https://www.ewb.ch/stoerungsmeldungen/',
    'Stadt Bern und ewb Versorgungsgebiet',
    'official',
    15,
    85,
    '{"language":"de","status_mode":"current_page","no_outage_terms":["keine einträge vorhanden","keine eintraege vorhanden"]}',
    0,
    'unknown'
  ),
  (
    'repower-stoerungen',
    'Repower',
    'html',
    'https://www.repower.com/ch/kundencenter/stoerungen-stromausfaelle',
    'Repower Netzgebiet in Graubünden und angrenzenden Regionen',
    'official',
    30,
    75,
    '{"language":"de","status_mode":"list_page","historical_terms":["2025","2024","2023"]}',
    0,
    'unknown'
  );
