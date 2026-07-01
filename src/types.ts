export type FeedLanguage = "de" | "fr" | "it";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  AI: Ai;
  BROWSER: BrowserRun;
  SNAPSHOTS: R2Bucket;
  CHECK_ALERT_FEEDS: Workflow;
  EMAIL: SendEmail;
  ALERT_FEED_DE?: string;
  ALERT_FEED_FR?: string;
  ALERT_FEED_IT?: string;
  NOTIFY_EMAIL?: string;
  FROM_EMAIL?: string;
  ADMIN_TOKEN?: string;
  EXA_API_KEY?: string;
  AI_MOCK_MODE?: string;
  EMAIL_MOCK_MODE?: string;
  BROWSER_MOCK_MODE?: string;
  EXA_MOCK_MODE?: string;
}

export interface NormalizedRssItem {
  feed_language: FeedLanguage;
  title: string;
  url: string;
  source: string | null;
  snippet: string | null;
  published_at: string | null;
}

export interface StoredAlertItem extends NormalizedRssItem {
  id: number;
  fetched_at: string;
  item_hash: string;
  status: string;
  is_relevant: number;
  confidence: number | null;
  country: "CH" | "other" | "unknown" | null;
  location_text: string | null;
  event_type: string | null;
  summary: string | null;
  reason: string | null;
  ai_raw: string | null;
  email_sent: number;
  email_sent_at: string | null;
  outage_event_id: number | null;
  event_linked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiClassification {
  is_relevant: boolean;
  confidence: number;
  country: "CH" | "other" | "unknown";
  location_text: string;
  event_type:
    | "power_outage"
    | "grid_disturbance"
    | "planned_outage"
    | "unclear"
    | "not_relevant";
  summary: string;
  reason: string;
}

export interface AiClassificationResult {
  parsed: AiClassification | null;
  raw: string;
  error?: string;
}

export type IncidentFalsePositiveType =
  | "none"
  | "telecom"
  | "article_context"
  | "crossword"
  | "historic"
  | "other";

export interface IncidentValidity {
  is_actual_outage_incident: boolean;
  false_positive_type: IncidentFalsePositiveType;
  reason: string;
}

export interface WorkflowRunSummary {
  runId: number;
  itemsSeen: number;
  itemsNew: number;
  itemsFiltered: number;
  itemsClassified: number;
  emailsSent: number;
  errors: string[];
}

export type OutageEventStatus = "needs_review" | "corroborated" | "dismissed" | "resolved";
export type OutageNature = "planned" | "unplanned" | "unknown";
export type ResearchStatus = "not_started" | "running" | "completed" | "failed";
export type EvidenceLevel = "weak" | "plausible" | "corroborated" | "official";
export type SourceKind = "official" | "local_media" | "national_media" | "operator" | "aggregator" | "other";
export type CauseCategory =
  | "planned_maintenance"
  | "weather"
  | "tree_or_overhead_line"
  | "construction_damage"
  | "cable_damage"
  | "transformer_or_substation"
  | "technical_fault"
  | "fire"
  | "overload"
  | "third_party_damage"
  | "water_or_flooding"
  | "unknown";

export interface OutageEvent {
  id: number;
  title: string;
  status: OutageEventStatus;
  event_type: AiClassification["event_type"];
  location_text: string | null;
  normalized_location: string | null;
  canton: string | null;
  country: "CH" | "other" | "unknown" | null;
  first_seen_at: string;
  last_seen_at: string;
  started_at_estimate: string | null;
  resolved_at_estimate: string | null;
  summary: string | null;
  reason: string | null;
  confidence: number;
  source_count: number;
  primary_source_url: string | null;
  primary_source_title: string | null;
  email_sent: number;
  email_sent_at: string | null;
  update_email_sent_at: string | null;
  merged_into_event_id: number | null;
  admin_note: string | null;
  outage_nature: OutageNature | null;
  cause_category: CauseCategory | null;
  cause_text: string | null;
  research_status: ResearchStatus | null;
  research_started_at: string | null;
  research_finished_at: string | null;
  research_summary_de: string | null;
  fact_confidence: number | null;
  event_score: number | null;
  evidence_level: EvidenceLevel | null;
  fact_sheet_json: string | null;
  fact_sheet_updated_at: string | null;
  auto_research_started_at: string | null;
  mail_decision_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutageSource {
  id: number;
  outage_event_id: number;
  alert_item_id: number;
  source_url: string;
  source_title: string;
  source_name: string | null;
  published_at: string | null;
  relation_score: number;
  is_primary: number;
  source_kind: SourceKind | null;
  source_weight: number | null;
  is_official: number | null;
  independence_key: string | null;
  created_at: string;
}

export interface SourceSnapshot {
  id: number;
  alert_item_id: number | null;
  outage_event_id: number | null;
  outage_source_id: number | null;
  url: string;
  final_url: string | null;
  fetch_method: string;
  fetch_status: "success" | "failed";
  http_status: number | null;
  title: string | null;
  markdown_r2_key: string | null;
  markdown_excerpt: string | null;
  content_hash: string | null;
  fetched_at: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchAssessment {
  outage_nature: OutageNature;
  cause_category: CauseCategory;
  cause_text: string;
  status: "active" | "resolved" | "unknown";
  research_summary_de: string;
  fact_confidence: number;
}

export interface FactSheet {
  location: string;
  time_window: {
    first_seen_at: string;
    last_seen_at: string;
    duration_label: string;
  };
  outage_nature: OutageNature;
  cause_category: CauseCategory;
  cause_text: string;
  status: "active" | "resolved" | "unknown";
  confirmed_facts: string[];
  open_questions: string[];
  summary_de: string;
  source_assessment: string;
  source_count: number;
  independent_source_count: number;
  official_source_count: number;
  generated_at: string;
}

export interface MergeAssessment {
  same_event: boolean;
  confidence: number;
  reason: string;
  risk: string;
}

export interface EventMergeSuggestion {
  id: number;
  source_event_id: number;
  target_event_id: number;
  heuristic_score: number;
  ai_confidence: number | null;
  same_event: number;
  reason: string | null;
  status: "open" | "accepted" | "dismissed";
  created_at: string;
  updated_at: string;
}

export interface CheckAlertFeedsParams {
  manual?: boolean;
  cron?: string;
  scheduledTime?: number;
  requestedAt?: string;
}
