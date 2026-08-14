UPDATE source_registry
SET adapter_config_json = '{"language":"de","status_mode":"operator_api","api_url":"https://api-outage.bkw.ch/api/services/trafo/state?supplier=bkw","utility_filter":"electricity_only"}'
WHERE source_key = 'bkw-outage';
