// DRP domain types — mirror the API contract in team/TEAM_PLAN.md and the DB
// schema in CLAUDE_CODE_BUILD.md. Backend response shapes must match these.

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
export type AssessmentType = 'PRE' | 'POST' | 'PDHRA';
export type AssessmentStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CERTIFIED'
  | 'REFERRED';
export type ReferralType = 'BEHAVIORAL_HEALTH' | 'DENTAL' | 'MEDICAL' | 'OTHER';

// Deployability category surfaced to the commander (never clinical detail).
export type DeployableReason =
  | 'Dental'
  | 'Behavioral Health'
  | 'Pregnancy'
  | 'Immunizations'
  | 'PHA'
  | null;

// ---- Core entities ----------------------------------------------------------

export interface Unit {
  id: string;
  uic: string;
  name: string;
  short_name: string;
  parent_unit_id: string | null;
}

export interface ServiceMember {
  id: string;
  edipi: string;
  rank: string;
  last_name: string;
  first_name: string;
  middle_initial: string | null;
  mos: string;
  unit_id: string;
  deployable: boolean;
  deployable_reason: DeployableReason;
}

// Flexible questionnaire payload. Field names match the red-flag rule engine
// (see team/backend-assessments.md). Extra keys allowed per form version.
export interface AssessmentResponses {
  dental_class?: 1 | 2 | 3 | 4;
  immunizations_current?: boolean;
  immunization_record_path?: string; // storage object path (bucket-relative)
  immunization_record_filename?: string; // original name, for display
  pregnancy?: boolean;
  pregnancy_status?: 'yes' | 'no' | 'unknown';
  new_medication?: boolean;
  last_pha_date?: string; // YYYY-MM-DD
  phq9_q9?: number; // self-harm item, 0-3
  [key: string]: unknown;
}

export interface RedFlag {
  id: string;
  assessment_id: string;
  type: string; // e.g. 'PHQ9_ELEVATED', 'DENTAL_CLASS_3'
  severity: Severity;
  rule_fired: string;
  message: string;
  resolved_at: string | null;
}

export interface Assessment {
  id: string;
  service_member_id: string;
  type: AssessmentType;
  status: AssessmentStatus;
  responses: AssessmentResponses;
  phq9_score: number | null;
  pcl5_score: number | null;
  submitted_at: string | null;
  certified_at: string | null;
  certified_by: string | null;
  referral_type: ReferralType | null;
  referral_notes: string | null;
}

// ---- Composed response shapes (what the API returns, joined) ----------------

// GET /api/assessments — queue row
export interface AssessmentListItem extends Assessment {
  member: Pick<
    ServiceMember,
    'id' | 'rank' | 'last_name' | 'first_name' | 'edipi'
  >;
  unit: Pick<Unit, 'id' | 'short_name'>;
  flags: RedFlag[];
}

// Pre→Post score comparison, present on POST assessment detail (null if the
// member has no pre-deployment baseline).
export interface ScoreComparison {
  pre_assessment_id: string;
  pre_submitted_at: string | null;
  pre_phq9_score: number | null;
  pre_pcl5_score: number | null;
  phq9_delta: number | null;
  pcl5_delta: number | null;
}

// GET /api/assessments/:id — detail
export interface AssessmentDetail extends Assessment {
  member: ServiceMember;
  unit: Unit;
  flags: RedFlag[];
  comparison?: ScoreComparison | null;
}

// GET /api/readiness — rollup for a unit + its children
export interface CompanyReadiness {
  unit_id: string;
  short_name: string;
  assigned: number;
  deployable: number;
  pct: number;
}

export interface ReadinessRollup {
  unit_id: string;
  total_assigned: number;
  deployable_count: number;
  non_deployable_count: number;
  pct_deployable: number;
  delta_from_last_week: number;
  pdhra_compliance_pct: number;
  by_company: CompanyReadiness[];
}

// GET /api/readiness/trend
export interface TrendPoint {
  date: string; // YYYY-MM-DD
  pct_deployable: number;
}

// GET /api/red-flags/summary
export interface RedFlagSummaryItem {
  category: string; // e.g. 'Dental Class 3', 'Behavioral health referral'
  severity: Severity;
  soldier_count: number;
  units: string[]; // affected unit short_names
}

// POST /api/commander/chat
export interface CommanderChatResponse {
  answer: string;
}

// POST /api/policy-chat
export interface PolicyChatSource {
  document_name: string;
  similarity_score: number;
  chunk_text?: string;
}

export interface PolicyChatResponse {
  answer: string;
  sources: PolicyChatSource[];
}

// ---- Request payloads -------------------------------------------------------

export interface CreateAssessmentInput {
  service_member_id: string;
  type: AssessmentType;
  responses: AssessmentResponses;
}

export interface ReferInput {
  referral_type: ReferralType;
  referral_notes: string;
}
