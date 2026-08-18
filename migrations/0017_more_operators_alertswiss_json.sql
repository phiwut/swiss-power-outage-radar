INSERT INTO source_registry (
  source_key, operator_name, source_type, source_category, url, area_text, trust_level,
  check_interval_minutes, priority, adapter_config_json, firecrawl_enabled, health_status
) VALUES
('ekz-stoerungen','EKZ','html','live_status','https://www.ekz.ch/de/kundenservice/self-service/Meldungen/stoerungsdienst-und-unterbrueche.html','Kanton Zürich ausser Stadt Zürich und einzelne unabhängige Gemeindewerke','official',15,97,'{"language":"de","status_mode":"current_page","allow_generic_positive":true,"utility_filter":"electricity_only"}',0,'unknown'),
('groupe-e-pannenhilfe','Groupe E','html','live_status','https://www.groupe-e.ch/de/pannenhilfe','Groupe E Netzgebiet in Freiburg, Neuenburg, Waadt und angrenzenden Gebieten','official',15,95,'{"language":"de","status_mode":"current_page","allow_generic_positive":true,"utility_filter":"electricity_only"}',1,'unknown'),
('sig-actualites','SIG','html','news_feed','https://ww2.sig-ge.ch/actualites','Kanton Genf und SIG Versorgungsgebiet','official',30,91,'{"language":"fr","status_mode":"news_feed","utility_filter":"electricity_only"}',0,'unknown'),
('ail-homepage','AIL','html','discovery_only','https://www.ail.ch/','Lugano und AIL Versorgungsgebiet','official',30,87,'{"language":"it","status_mode":"homepage_discovery","utility_filter":"electricity_only"}',0,'unknown'),
('sil-lausanne','SIL Lausanne','html','discovery_only','https://www.sil-lausanne.ch/','Lausanne und SIL Versorgungsgebiet','official',30,85,'{"language":"fr","status_mode":"homepage_discovery","utility_filter":"electricity_only"}',0,'unknown'),
('stadtwerk-winterthur','Stadtwerk Winterthur','html','discovery_only','https://stadtwerk.winterthur.ch/','Winterthur','official',30,83,'{"language":"de","status_mode":"homepage_discovery","utility_filter":"electricity_only"}',0,'unknown'),
('sgsw-stoerungen','St.Galler Stadtwerke','html','live_status','https://www.sgsw.ch/home/stoerungen.html','Stadt St. Gallen','official',15,81,'{"language":"de","status_mode":"current_page","allow_generic_positive":true,"utility_filter":"electricity_only"}',0,'unknown'),
('oiken-homepage','OIKEN','html','discovery_only','https://www.oiken.ch/','OIKEN Netzgebiet im Wallis','official',30,79,'{"language":"fr","status_mode":"homepage_discovery","utility_filter":"electricity_only"}',0,'unknown'),
('eks-homepage','EKS','html','discovery_only','https://www.eks.ch/','EKS Netzgebiet Schaffhausen','official',30,77,'{"language":"de","status_mode":"homepage_discovery","utility_filter":"electricity_only"}',0,'unknown'),
('ses-homepage','SES','html','discovery_only','https://www.ses.ch/','SES Netzgebiet in der Waadt','official',30,75,'{"language":"fr","status_mode":"homepage_discovery","utility_filter":"electricity_only"}',0,'unknown'),
('energie-thun','Energie Thun','html','discovery_only','https://energiethun.ch/','Thun','official',30,73,'{"language":"de","status_mode":"homepage_discovery","utility_filter":"electricity_only"}',0,'unknown'),
('regio-energie-solothurn','Regio Energie Solothurn','html','discovery_only','https://www.regioenergie.ch/de/','Solothurn und Regio Energie Versorgungsgebiet','official',30,71,'{"language":"de","status_mode":"homepage_discovery","utility_filter":"electricity_only"}',0,'unknown'),
('alertswiss','Alertswiss','html','discovery_only','https://www.alert.swiss/','Schweizweit','official',10,50,'{"language":"de","status_mode":"national_alerts_json","api_url":"https://www.alert.swiss/content/alertswiss-internet/de/home/_jcr_content/polyalert.alertswiss_alerts.actual.json","utility_filter":"electricity_only"}',0,'unknown')
ON CONFLICT(source_key) DO UPDATE SET
  operator_name = excluded.operator_name,
  source_type = excluded.source_type,
  source_category = excluded.source_category,
  url = excluded.url,
  area_text = excluded.area_text,
  trust_level = excluded.trust_level,
  check_interval_minutes = excluded.check_interval_minutes,
  priority = excluded.priority,
  adapter_config_json = excluded.adapter_config_json,
  firecrawl_enabled = excluded.firecrawl_enabled,
  updated_at = CURRENT_TIMESTAMP;

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
WHERE source_key IN (
  'ekz-stoerungen',
  'groupe-e-pannenhilfe',
  'sig-actualites',
  'ail-homepage',
  'sil-lausanne',
  'stadtwerk-winterthur',
  'sgsw-stoerungen',
  'oiken-homepage',
  'eks-homepage',
  'ses-homepage',
  'energie-thun',
  'regio-energie-solothurn'
);
