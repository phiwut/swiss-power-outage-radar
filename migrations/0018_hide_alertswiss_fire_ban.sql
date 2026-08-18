UPDATE publication_decisions
SET publishable = 0,
    reasons_json = '["no_positive_outage_evidence","no_coherent_public_summary"]',
    public_summary = NULL
WHERE outage_event_id = 194
  AND primary_source_domain = 'alert.swiss';

UPDATE source_authorities
SET authority_kind = 'public_authority',
    display_name = 'Alertswiss',
    updated_at = CURRENT_TIMESTAMP
WHERE hostname IN ('alert.swiss', 'alertswiss.ch');
