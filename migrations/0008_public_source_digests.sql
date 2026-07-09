ALTER TABLE source_snapshots ADD COLUMN public_summary_de TEXT;
ALTER TABLE source_snapshots ADD COLUMN public_key_points_json TEXT;
ALTER TABLE source_snapshots ADD COLUMN public_relevance_label TEXT;
ALTER TABLE source_snapshots ADD COLUMN public_facts_json TEXT;
ALTER TABLE source_snapshots ADD COLUMN digest_generated_at TEXT;
ALTER TABLE source_snapshots ADD COLUMN digest_error TEXT;

CREATE INDEX IF NOT EXISTS idx_source_snapshots_digest ON source_snapshots(digest_generated_at);
