// ==============================================================================
// AGENT AUDIT TYPE DEFINITIONS
// ==============================================================================

export interface FubAgent {
  id: string;
  fub_id: number;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string | null;
  is_active: boolean;
  raw_data?: any;
  created_at: string;
  updated_at: string;
}

export interface FubLead {
  id: string;
  fub_id: number;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  stage?: string | null;
  source?: string | null;
  assigned_user_fub_id?: number | null;
  assigned_user_name?: string | null;
  price?: number | null;
  contacted: boolean;
  tags?: string[] | null;
  fub_created_at?: string | null;
  fub_updated_at?: string | null;
  last_activity?: string | null;
  last_communication?: string | null;
  last_sent_email?: string | null;
  last_sent_text?: string | null;
  last_outgoing_call?: string | null;
}

export interface FubSyncLog {
  id: string;
  sync_type: string;
  started_at: string;
  completed_at?: string | null;
  status: "running" | "completed" | "failed";
  records_synced: Record<string, number>;
  error_message?: string | null;
  triggered_by?: string | null;
}

export interface AuditIntegrityThreshold {
  key: string;
  numeric_value?: number | null;
  text_value?: string | null;
  description?: string | null;
  updated_at: string;
}

export interface AuditIntegrityFlag {
  id: string;
  agent_fub_id: number;
  agent_name?: string | null;
  rule_key:
    | "short_calls"
    | "clustered_calls"
    | "ghost_task"
    | "unjustified_lost_trash"
    | "skipped_stage"
    | "duplicate_notes";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  evidence_record_ids: (number | string)[];
  evidence_summary?: string | null;
  lead_fub_id?: number | null;
  status: "open" | "confirmed" | "dismissed" | "needs_human_review";
  claude_review_status?: "confirmed" | "dismissed" | "needs_human_review" | null;
  claude_reasoning?: string | null;
  claude_reviewed_at?: string | null;
  human_override_status: "pending" | "agreed" | "disagreed";
  human_override_notes?: string | null;
  human_override_by?: string | null;
  human_override_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditRubricCriterion {
  id: string;
  key: string;
  name: string;
  category: string;
  weight: number;
  anchor_1: string;
  anchor_3: string;
  anchor_5: string;
  description?: string | null;
  examples?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TimelineActivity {
  id: string | number;
  timestamp: string;
  type: "call" | "text" | "email" | "note" | "task" | "stage_change" | "appointment";
  direction?: "inbound" | "outbound" | "incoming" | "outgoing" | null;
  speaker: string; // e.g. "Agent A", "Client", "System"
  subject?: string | null;
  content: string; // Note body, text body, call outcome/duration, etc.
}

export interface AuditSampledLead {
  id: string;
  audit_month: string;
  batch_id?: string | null;
  agent_fub_id: number;
  agent_name: string;
  person_fub_id: number;
  anonymized_label: string;
  timeline_json: TimelineActivity[];
  grading_status: "pending" | "graded" | "error";
  overall_score?: number | null;
  sampled_at: string;
  created_at: string;
  grades?: AuditLeadGrade[];
  compliance_flags?: AuditComplianceFlag[];
  lead_url?: string | null;
}

export interface AuditLeadGrade {
  id: string;
  sampled_lead_id: string;
  criterion_id?: string | null;
  criterion_key: string;
  score?: number | null; // 1-5 or null
  insufficient_evidence: boolean;
  cited_activity_ids: (string | number)[];
  excerpt?: string | null;
  reasoning?: string | null;
  human_override_score?: number | null;
  human_override_notes?: string | null;
  human_override_status: "pending" | "agreed" | "disagreed";
  human_override_by?: string | null;
  human_override_at?: string | null;
  created_at: string;
}

export interface AuditComplianceFlag {
  id: string;
  sampled_lead_id?: string | null;
  person_fub_id: number;
  agent_fub_id: number;
  agent_name?: string | null;
  flag_type: "fair_housing" | "pricing_promise" | "steering" | "licensing" | "other";
  exact_language: string;
  cited_activity_ids: (string | number)[];
  severity: "high" | "critical";
  human_review_status: "pending" | "confirmed" | "dismissed";
  human_notes?: string | null;
  human_reviewed_by?: string | null;
  human_reviewed_at?: string | null;
  created_at: string;
}

export interface AuditReport {
  id: string;
  audit_month: string;
  agent_fub_id?: number | null;
  agent_name?: string | null;
  report_type: "agent" | "team_rollup";
  precomputed_sql_metrics: Record<string, any>;
  claude_narrative?: string | null;
  average_quality_score?: number | null;
  total_leads_audited: number;
  open_flags_count: number;
  compliance_flags_count: number;
  human_notes?: string | null;
  is_finalized: boolean;
  finalized_at?: string | null;
  emailed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditCalibrationSet {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  leads_count?: number;
}

export interface AuditCalibrationLead {
  id: string;
  calibration_set_id: string;
  person_fub_id: number;
  agent_fub_id?: number | null;
  agent_name?: string | null;
  lead_name?: string | null;
  timeline_json: TimelineActivity[];
  notes?: string | null;
  created_at: string;
  grades?: AuditCalibrationGrade[];
}

export interface AuditCalibrationGrade {
  id: string;
  calibration_lead_id: string;
  criterion_id: string;
  criterion_key: string;
  human_score: number;
  human_notes?: string | null;
  claude_score?: number | null;
  claude_reasoning?: string | null;
  agreement_delta: number;
  is_exact_match: boolean;
  is_within_one: boolean;
  claude_evaluated_at?: string | null;
  created_at: string;
}

export interface AgentMonthlyMetric {
  agent_fub_id: number;
  agent_name: string;
  total_assigned_leads: number;
  total_calls: number;
  total_short_calls: number;
  short_calls_pct: number;
  total_texts: number;
  total_emails: number;
  tasks_completed: number;
  open_integrity_flags_count: number;
  compliance_flags_count: number;
  avg_rubric_score: number;
  leads_graded_count: number;
}

// ------------------------------------------------------------------------------
// Claude Tool Use Schemas (Structured Output)
// ------------------------------------------------------------------------------

export interface LeadGraderCriterionResult {
  criterion_key: string;
  score: number | null; // 1-5 or null if insufficient_evidence
  insufficient_evidence: boolean;
  cited_activity_ids: (string | number)[];
  excerpt: string;
  reasoning: string;
}

export interface LeadGraderComplianceConcern {
  flag_type: "fair_housing" | "pricing_promise" | "steering" | "licensing" | "other";
  exact_language: string;
  activity_id: string | number;
  context_note: string;
}

export interface LeadGraderToolOutput {
  overall_summary: string;
  scores: LeadGraderCriterionResult[];
  compliance_concerns: LeadGraderComplianceConcern[];
}

export interface FlagReviewerToolOutput {
  flag_id: string;
  verdict: "confirmed" | "dismissed" | "needs_human_review";
  confidence: "high" | "medium" | "low";
  reasoning: string;
  recommended_action: string;
}

export interface ReportWriterToolOutput {
  report_month: string;
  executive_summary: string;
  key_strengths: string[];
  areas_for_coaching: string[];
  integrity_observations: string;
  recommended_next_steps: string[];
}
