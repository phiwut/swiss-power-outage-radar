ALTER TABLE outage_events ADD COLUMN received_at TEXT;

UPDATE outage_events
SET received_at = CASE
  WHEN COALESCE(created_at, first_seen_at) LIKE '%T%'
  THEN COALESCE(created_at, first_seen_at)
  ELSE STRFTIME('%Y-%m-%dT%H:%M:%fZ', COALESCE(created_at, first_seen_at))
END
WHERE received_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outage_events_received_at
ON outage_events(received_at DESC);

ALTER TABLE source_registry ADD COLUMN transport_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE source_registry ADD COLUMN parser_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE source_registry ADD COLUMN last_observation_at TEXT;

UPDATE source_registry
SET source_category = 'outage_map',
    adapter_config_json = '{"language":"de","status_mode":"operator_api","api_url":"https://api-outage.bkw.ch/api/services/supplyZone/state","utility_filter":"electricity_only"}'
WHERE source_key = 'bkw-outage';

UPDATE source_registry
SET adapter_config_json = '{"language":"fr","status_mode":"operator_api","api_url":"https://www.romande-energie.ch/re_infopannes/data","utility_filter":"electricity_only"}'
WHERE source_key = 'romande-energie-pannes';

UPDATE source_registry
SET adapter_config_json = '{"language":"de","status_mode":"operator_api","api_url":"https://netzstatus.sak.ch/api/v1/failures","utility_filter":"electricity_only"}'
WHERE source_key = 'sak-netzstatus';

UPDATE source_registry
SET adapter_config_json = '{"language":"de","status_mode":"operator_api","api_url":"https://www.primeo-energie.ch/magnolia/.rest/primeo/v1/gridStatus.json?limit=20","utility_filter":"electricity_only"}'
WHERE source_key = 'primeo-netzstatus';

CREATE TABLE IF NOT EXISTS source_authorities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hostname TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  authority_kind TEXT NOT NULL,
  trust_level TEXT NOT NULL,
  source_registry_id INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_registry_id) REFERENCES source_registry(id)
);

INSERT OR IGNORE INTO source_authorities (
  hostname, display_name, authority_kind, trust_level, source_registry_id
)
SELECT
  LOWER(REPLACE(
    CASE
      WHEN INSTR(SUBSTR(url, INSTR(url, '//') + 2), '/') > 0
      THEN SUBSTR(
        SUBSTR(url, INSTR(url, '//') + 2),
        1,
        INSTR(SUBSTR(url, INSTR(url, '//') + 2), '/') - 1
      )
      ELSE SUBSTR(url, INSTR(url, '//') + 2)
    END,
    'www.',
    ''
  )),
  operator_name,
  'operator',
  'official',
  id
FROM source_registry
WHERE trust_level = 'official';

INSERT OR IGNORE INTO source_authorities (
  hostname, display_name, authority_kind, trust_level
) VALUES
  ('ai.ch', 'Kanton Appenzell Innerrhoden', 'public_authority', 'official'),
  ('admin.ch', 'Schweizerische Eidgenossenschaft', 'public_authority', 'official'),
  ('alert.swiss', 'Alertswiss', 'public_authority', 'official');

CREATE TABLE IF NOT EXISTS publication_decisions (
  outage_event_id INTEGER PRIMARY KEY,
  publishable INTEGER NOT NULL,
  trust TEXT,
  reasons_json TEXT NOT NULL,
  public_summary TEXT,
  primary_source_publisher TEXT,
  primary_source_url TEXT,
  primary_source_domain TEXT,
  evaluator_version TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  FOREIGN KEY (outage_event_id) REFERENCES outage_events(id)
);

CREATE INDEX IF NOT EXISTS idx_publication_decisions_feed
ON publication_decisions(publishable, decided_at DESC);

CREATE TABLE IF NOT EXISTS publication_revalidation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apply_mode INTEGER NOT NULL,
  assessed INTEGER NOT NULL,
  publishable_before INTEGER NOT NULL,
  publishable_after INTEGER NOT NULL,
  changed INTEGER NOT NULL,
  decisions_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_publication_revalidation_runs_created
ON publication_revalidation_runs(created_at DESC);

CREATE TRIGGER IF NOT EXISTS publication_decision_insert_event_state
AFTER INSERT ON publication_decisions
BEGIN
  UPDATE outage_events
  SET public_status = CASE
        WHEN NEW.publishable = 0 THEN 'hidden'
        WHEN NEW.trust = 'official' THEN 'public_verified'
        ELSE 'public_auto'
      END,
      verification_level = CASE WHEN NEW.trust = 'official' THEN 'official_source' ELSE 'auto_analyzed' END,
      event_quality_state = CASE WHEN NEW.publishable = 1 THEN 'publishable' ELSE 'candidate_only' END,
      mail_decision_reason = CASE
        WHEN NEW.publishable = 1 THEN 'publish: ' || COALESCE(NEW.trust, 'unknown')
        ELSE 'hold public: ' || NEW.reasons_json
      END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.outage_event_id;
END;

CREATE TRIGGER IF NOT EXISTS publication_decision_update_event_state
AFTER UPDATE ON publication_decisions
BEGIN
  UPDATE outage_events
  SET public_status = CASE
        WHEN NEW.publishable = 0 THEN 'hidden'
        WHEN NEW.trust = 'official' THEN 'public_verified'
        ELSE 'public_auto'
      END,
      verification_level = CASE WHEN NEW.trust = 'official' THEN 'official_source' ELSE 'auto_analyzed' END,
      event_quality_state = CASE WHEN NEW.publishable = 1 THEN 'publishable' ELSE 'candidate_only' END,
      mail_decision_reason = CASE
        WHEN NEW.publishable = 1 THEN 'publish: ' || COALESCE(NEW.trust, 'unknown')
        ELSE 'hold public: ' || NEW.reasons_json
      END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.outage_event_id;
END;
