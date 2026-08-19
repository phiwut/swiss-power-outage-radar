UPDATE source_registry
SET adapter_config_json = '{"language":"de","status_mode":"operator_api","api_url":"https://www.repower.com/umbraco/api/Stoerung/GetWarnings?culture=de","utility_filter":"electricity_only"}',
    source_category = 'outage_map',
    check_interval_minutes = 10,
    updated_at = CURRENT_TIMESTAMP
WHERE source_key = 'repower-stoerungen';

UPDATE source_registry
SET source_category = 'live_status',
    area_text = 'SES Sopracenerina Netzgebiet im Locarnese und nördlichen Tessin',
    check_interval_minutes = 15,
    priority = 89,
    adapter_config_json = '{"language":"it","status_mode":"current_page","utility_filter":"electricity_only"}',
    updated_at = CURRENT_TIMESTAMP
WHERE source_key = 'ses-homepage';

UPDATE source_registry
SET source_category = 'news_feed',
    url = 'https://www.ail.ch/news-media/News.html',
    adapter_config_json = '{"language":"it","status_mode":"news_feed","utility_filter":"electricity_only"}',
    updated_at = CURRENT_TIMESTAMP
WHERE source_key = 'ail-homepage';
