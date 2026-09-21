// Shared API types (mirror of the FastAPI schemas).

export type Role = "youth" | "recruiter" | "provider" | "admin";

export interface User {
  id: number;
  phone: string;
  name: string;
  role: Role;
  recruiter_org_id?: number | null;
}

export interface Skill {
  id: number;
  name: string;
  category: string;
}

export interface Constituency {
  id: number;
  name: string;
  district: string;
  state: string;
}

export interface YouthSkill {
  skill_id: number;
  level: number;
  name: string;
}

export interface YouthProfile {
  id: number;
  epic_number: string | null;
  epic_verified: boolean;
  verification_status: "unverified" | "pending" | "verified";
  constituency_id: number | null;
  constituency_name: string | null;
  gender: string | null;
  age: number | null;
  rural_resident: boolean;
  differently_abled: boolean;
  assisted_access: boolean;
  preferred_language: string;
  mobility_preference: string;
  expected_salary: number | null;
  candidate_category: string;
  target_role: string | null;
  notice_period_days: number;
  certificates: string | null;
  education_level: string | null;
  education_field: string | null;
  institution: string | null;
  graduation_year: number | null;
  experience_years: number;
  experience_title: string | null;
  experience_company: string | null;
  resume_filename: string | null;
  employability_score: number;
  employability_band: string;
  employment_status: string;
  onboarding_complete: boolean;
  name: string;
  skills: YouthSkill[];
}

export interface AssessmentQuestion {
  id: number;
  skill: string;
  question: string;
  question_type: string;
  difficulty: string;
  max_score: number;
  sequence: number;
  answer: string | null;
  score: number | null;
  ai_feedback: string | null;
}

export interface CandidateSkillScore {
  id: number;
  skill: string;
  score: number;
  knowledge_level: string;
}

export interface AssessmentSkillGap {
  id: number;
  skill: string;
  candidate_score: number;
  required_score: number;
  gap_percentage: number;
  recommendation: string | null;
}

export interface CandidateJobMatch {
  id: number;
  job_id: number;
  job_title: string;
  company: string;
  skill_match: number;
  experience_match: number;
  location_match: number;
  salary_match: number;
  availability_match: number;
  requirement_match: number;
  optional_skill_match: number;
  overall_match_score: number;
  match_level: string;
  mandatory_missing: string[];
  matched_skills: string[];
  missing_skills: string[];
  recommendation_reason: string | null;
  gaps: AssessmentSkillGap[];
}

export interface CandidateAssessment {
  id: number;
  candidate_id: number;
  candidate_name: string;
  category: string;
  target_role: string | null;
  assessment_type: string;
  started_at: string;
  completed_at: string | null;
  overall_score: number | null;
  knowledge_level: string | null;
  status: string;
  strengths: string[];
  weak_areas: string[];
  ai_disclaimer: string;
  questions: AssessmentQuestion[];
  skill_scores: CandidateSkillScore[];
  job_matches: CandidateJobMatch[];
  practical_verifications: Array<{
    id: number;
    reviewer_user_id: number;
    practical_test: number;
    communication: number;
    technical_skill: number;
    job_knowledge: number;
    safety_awareness: number;
    problem_solving: number;
    notes: string | null;
    created_at: string;
  }>;
}

export interface AssessmentQueueRow {
  assessment_id: number;
  candidate_name: string;
  category: string;
  target_role: string | null;
  status: string;
  overall_score: number | null;
  knowledge_level: string | null;
  top_job: string | null;
  job_match_score: number | null;
  assessment_date: string;
}

export interface AssessmentConfig {
  id: number;
  name: string;
  mcq_weight: number;
  scenario_weight: number;
  practical_weight: number;
  coding_weight: number;
  experience_weight: number;
  match_skill_weight: number;
  match_experience_weight: number;
  match_location_weight: number;
  match_salary_weight: number;
  match_availability_weight: number;
  match_requirement_weight: number;
  match_optional_weight: number;
  knowledge_thresholds: string;
  match_thresholds: string;
  updated_at: string;
}

export interface TrainingProgram {
  id: number;
  title: string;
  program_type: string;
  provider: string | null;
  description: string | null;
  target_skill_id: number | null;
  url: string | null;
  duration: string | null;
  verification_status?: string;
  target_skill_name?: string | null;
}

export interface TrainingEnrollment {
  id: number;
  program_id: number;
  status: "enrolled" | "in_progress" | "completed" | "dropped";
  enrolled_at: string;
  completed_at: string | null;
  assessment_score: number | null;
  practical_component: boolean;
  work_experience_kind: string | null;
  stipend_amount: number | null;
  provider_rating: number | null;
  program_title: string;
  program_type: string;
  provider: string | null;
  target_skill_name: string | null;
}

export interface PlacementOutcome {
  id: number;
  application_id: number;
  joined_at: string;
  starting_salary: number | null;
  current_salary: number | null;
  employment_type: string | null;
  has_formal_benefits: boolean | null;
  role_skill_match: number | null;
  candidate_satisfaction: number | null;
  employer_satisfaction: number | null;
  retained_3m: boolean | null;
  retained_6m: boolean | null;
  retained_12m: boolean | null;
  exit_reason: string | null;
  last_checkin_at: string | null;
}

export interface CompanyOrg {
  id: number;
  name: string;
  industry: string | null;
  about: string | null;
  verification_status: string;
  job_count: number;
  hired_count: number;
  constituency_name: string | null;
}

export interface CompanyHireRow {
  org_id: number;
  company: string;
  industry: string | null;
  verification_status: string;
  active_jobs: number;
  applications: number;
  hired: number;
}

export interface PlacementRow {
  youth_id: number;
  youth_name: string;
  education_level: string | null;
  job_title: string;
  company: string;
  stage: string;
  match_score: number;
  updated_at: string;
}

export interface Recommendation {
  skill_id: number | null;
  skill_name: string | null;
  programs: TrainingProgram[];
}

export interface SkillGap {
  current_skills: Skill[];
  demand_skills: Skill[];
  gap_skills: Skill[];
  recommendations: Recommendation[];
}

export interface AIStatus {
  provider: string;
  model: string;
  configured: boolean;
}

export interface AICareerPlan {
  summary: string;
  strengths: string[];
  gap_priorities: string[];
  next_steps: string[];
  suggested_roles: string[];
  caution?: string | null;
}

export interface AIJobInsight {
  summary: string;
  fit_reasons: string[];
  missing_skills: string[];
  next_steps: string[];
  caution?: string | null;
}

export interface VoterRecord {
  id: number;
  id_code: string;
  name: string;
  relation_type?: string | null;
  relative_name?: string | null;
  house_no?: string | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  constituency?: string | null;
  division?: string | null;
  village?: string | null;
  ward?: string | null;
  part?: number | null;
  booth_number?: string | null;
  confirmed: boolean;
  party?: string | null;
  agent?: string | null;
  notes?: string | null;
  is_registered?: boolean;
  registered_youth_name?: string | null;
}

export interface YouthVoterLink {
  youth_id: number;
  youth_name: string;
  youth_phone: string;
  epic_number?: string | null;
  verification_status: string;
  voter?: VoterRecord | null;
}

export interface Job {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  min_experience: number;
  salary_min: number | null;
  salary_max: number | null;
  education_required: string | null;
  jd_filename?: string | null;
  status: string;
  created_at: string;
  org_id: number;
  org_name: string;
  org_industry?: string | null;
  org_about?: string | null;
  org_verification_status?: string;
  skills: Skill[];
  applicant_count: number;
  match_score?: number | null;
  already_applied?: boolean;
}

export interface Candidate {
  youth_id: number;
  name: string;
  education_level: string | null;
  education_field?: string | null;
  institution?: string | null;
  experience_years: number;
  experience_title?: string | null;
  experience_company?: string | null;
  constituency_name: string | null;
  employability_score: number;
  employability_band?: string;
  match_score: number;
  skills: string[];
  resume_filename?: string | null;
  verification_status?: string;
}

export interface Interview {
  scheduled_at: string | null;
  mode: string;
  notes: string | null;
}

export interface Application {
  id: number;
  job_id: number;
  youth_id: number;
  stage: string;
  match_score: number;
  created_at: string;
  updated_at: string;
  job_title: string;
  org_name: string;
  youth_name: string;
  interview?: Interview | null;
  placement_outcome?: PlacementOutcome | null;
}

export interface PipelineFunnel {
  registered: number;
  shortlisted: number;
  interviews: number;
  selected: number;
  joined: number;
}

export interface NameValue {
  name: string;
  value: number;
}

export interface RecruiterDashboard {
  active_jobs: number;
  total_applications: number;
  shortlisted: number;
  hired: number;
  top_candidates: Candidate[];
  pipeline: PipelineFunnel;
}

export interface ConstituencyComparison {
  name: string;
  registered_youth: number;
  placed_candidates: number;
  placement_rate: number;
  is_yours: boolean;
}

export interface MlaDashboard {
  constituency_name: string;
  kpis: {
    total_youth: number;
    registered_seekers: number;
    active_recruiters: number;
    training_enrolled: number;
    placed_candidates: number;
    placement_rate: number;
  };
  employment_score: number;
  employment_score_band: string;
  pipeline: PipelineFunnel;
  employment_status: NameValue[];
  monthly_placements: NameValue[];
  top_skill_demand: NameValue[];
  gender: NameValue[];
  age_group: NameValue[];
  education_level: NameValue[];
  comparison: ConstituencyComparison[];
}

export interface OutcomeDashboard {
  placements: number;
  joining_rate: number;
  median_starting_salary: number;
  average_wage_growth: number;
  average_time_to_placement_days: number;
  role_skill_match: number;
  formal_benefits_coverage: number;
  candidate_satisfaction: number;
  employer_satisfaction: number;
  retention_3m: number;
  retention_6m: number;
  retention_12m: number;
  training_enrollments: number;
  training_completion_rate: number;
  average_assessment_score: number;
  work_based_learning_share: number;
  women_placement_share: number;
  registration_conversion: number;
  average_salary: number;
  interview_conversion: number;
  employer_response_days: number;
  entrepreneurship_created: number;
  rural_coverage: number;
  assisted_access_share: number;
  differently_abled_participation: number;
  skill_mismatch_rate: number;
  active_mentorships: number;
  reminder_completion_rate: number;
}

export interface CareerAssessment {
  id: number;
  youth_id: number;
  aptitude_area: string | null;
  interests: string | null;
  preferred_sectors: string | null;
  mobility: string | null;
  wage_expectation: number | null;
  entrepreneurship_interest: boolean;
  career_plan_completed: boolean;
  referral_accepted: boolean;
  suitability_score: number;
  updated_at: string;
}

export interface Mentor {
  id: number;
  name: string;
  expertise: string;
  organisation: string | null;
  district: string | null;
  languages: string;
  rural_support: boolean;
}

export interface Mentorship {
  id: number;
  mentor_id: number;
  status: string;
  goal: string | null;
  next_session_at: string | null;
  youth_rating: number | null;
  created_at: string;
  mentor_name: string;
  mentor_expertise: string;
}

export interface EmploymentOpportunity {
  id: number;
  title: string;
  category: string;
  provider: string;
  district: string | null;
  description: string | null;
  skill_names: string | null;
  income_min: number | null;
  income_max: number | null;
  remote_allowed: boolean;
  rural_friendly: boolean;
  women_focused: boolean;
  safeguards: string | null;
  finance_guidance: string | null;
  market_access: string | null;
  url: string | null;
  verification_status: string;
  already_interested: boolean;
}

export interface OpportunityApplication {
  id: number;
  opportunity_id: number;
  status: string;
  monthly_income: number | null;
  created_at: string;
  opportunity_title: string;
  category: string;
}

export interface Reminder {
  id: number;
  title: string;
  message: string | null;
  reminder_type: string;
  channel: string;
  due_at: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CandidateDocument {
  id: number; youth_id: number; document_type: string; filename: string;
  verification_status: string; reviewer_notes: string | null; created_at: string;
  verified_at: string | null; youth_name: string;
}

export interface PlacementCommission {
  id: number; application_id: number; org_id: number; invoice_number: string;
  fee_amount: number; tax_amount: number; payment_status: string; notes: string | null;
  issued_at: string; paid_at: string | null; youth_name: string; job_title: string; company: string;
}

export interface DemandForecast {
  skill_id: number;
  skill_name: string;
  current_demand: number;
  forecast_6m: number;
  trend: string;
  shortage_roles: number;
}

export interface IntegrationStatus {
  id: number;
  platform: string;
  capability: string;
  status: string;
  mode: string;
  last_synced_at: string | null;
  official_url: string | null;
}

export interface EcosystemOverview {
  assessment: CareerAssessment | null;
  forecasts: DemandForecast[];
  mentors: Mentor[];
  mentorships: Mentorship[];
  opportunities: EmploymentOpportunity[];
  applications: OpportunityApplication[];
  reminders: Reminder[];
  integrations: IntegrationStatus[];
}

export interface SkillSupplyGap {
  skill_id: number;
  skill_name: string;
  openings: number;
  available_youth: number;
  shortage: number;
}

export interface EmployerSupportRequest {
  id: number;
  request_type: string;
  description: string | null;
  status: string;
  created_at: string;
}

export interface PolicyRecommendation {
  priority: string;
  title: string;
  evidence: string;
  action: string;
}

export const PIPELINE_STAGES = [
  "applied",
  "shortlisted",
  "interview",
  "selected",
  "joined",
] as const;
