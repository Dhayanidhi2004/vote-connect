"""Pydantic v2 schemas for API request/response bodies."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- auth --------------------------------------------------------------------

class OtpRequest(BaseModel):
    phone: str


class OtpRequestResponse(BaseModel):
    phone: str
    # Demo only: the code is returned so the UI can display it. Never do this
    # in production — it would be sent by SMS.
    demo_otp: Optional[str] = None
    message: str
    is_new_user: bool


class OtpVerify(BaseModel):
    phone: str
    code: str
    # Only used when the phone has no account yet:
    name: Optional[str] = None
    role: Optional[str] = None  # youth | recruiter (admin is seeded)
    org_name: Optional[str] = None  # for recruiter signup
    voter_id: Optional[str] = None  # mandatory for new youth signup
    password: Optional[str] = None
    email: Optional[str] = None


class YouthPasswordLogin(BaseModel):
    voter_id: str
    password: str


class StaffPasswordLogin(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: "UserOut"


class UserOut(ORMModel):
    id: int
    phone: str
    email: Optional[str] = None
    name: str
    role: str
    recruiter_org_id: Optional[int] = None


# --- reference data ----------------------------------------------------------

class SkillOut(ORMModel):
    id: int
    name: str
    category: str


class ConstituencyOut(ORMModel):
    id: int
    name: str
    district: str
    state: str


# --- youth -------------------------------------------------------------------

class YouthSkillIn(BaseModel):
    skill_id: int
    level: int = 3


class YouthSkillOut(ORMModel):
    skill_id: int
    level: int
    name: str = ""


class YouthProfileUpdate(BaseModel):
    epic_number: Optional[str] = None
    constituency_id: Optional[int] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    rural_resident: Optional[bool] = None
    differently_abled: Optional[bool] = None
    assisted_access: Optional[bool] = None
    preferred_language: Optional[str] = None
    mobility_preference: Optional[str] = None
    expected_salary: Optional[int] = None
    candidate_category: Optional[str] = None
    target_role: Optional[str] = None
    notice_period_days: Optional[int] = None
    certificates: Optional[str] = None
    education_level: Optional[str] = None
    education_field: Optional[str] = None
    institution: Optional[str] = None
    graduation_year: Optional[int] = None
    experience_years: Optional[float] = None
    experience_title: Optional[str] = None
    experience_company: Optional[str] = None
    resume_filename: Optional[str] = None
    skills: Optional[list[YouthSkillIn]] = None
    consent: Optional[bool] = None
    complete_onboarding: Optional[bool] = None


class YouthProfileOut(ORMModel):
    id: int
    epic_number: Optional[str]
    epic_verified: bool
    verification_status: str
    constituency_id: Optional[int]
    constituency_name: Optional[str] = None
    gender: Optional[str]
    age: Optional[int]
    rural_resident: bool = False
    differently_abled: bool = False
    assisted_access: bool = False
    preferred_language: str = "English"
    mobility_preference: str = "Within district"
    expected_salary: Optional[int] = None
    candidate_category: str = "IT"
    target_role: Optional[str] = None
    notice_period_days: int = 0
    certificates: Optional[str] = None
    education_level: Optional[str]
    education_field: Optional[str]
    institution: Optional[str]
    graduation_year: Optional[int]
    experience_years: float
    experience_title: Optional[str]
    experience_company: Optional[str]
    resume_filename: Optional[str]
    employability_score: float
    employability_band: str = ""
    employment_status: str
    onboarding_complete: bool
    name: str = ""
    skills: list[YouthSkillOut] = []


class VoterRecordOut(BaseModel):
    id: int
    id_code: str
    name: str
    relation_type: Optional[str] = None
    relative_name: Optional[str] = None
    house_no: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    constituency: Optional[str] = None
    division: Optional[str] = None
    village: Optional[str] = None
    ward: Optional[str] = None
    part: Optional[int] = None
    booth_number: Optional[str] = None
    confirmed: bool = False
    party: Optional[str] = None
    agent: Optional[str] = None
    notes: Optional[str] = None
    is_registered: bool = False
    registered_youth_name: Optional[str] = None


class YouthVoterLinkOut(BaseModel):
    youth_id: int
    youth_name: str
    youth_phone: str
    epic_number: Optional[str]
    verification_status: str
    voter: Optional[VoterRecordOut] = None


class RecommendationOut(BaseModel):
    skill_id: Optional[int]
    skill_name: Optional[str]
    programs: list["TrainingProgramOut"] = []


class SkillGapOut(BaseModel):
    current_skills: list[SkillOut]
    demand_skills: list[SkillOut]
    gap_skills: list[SkillOut]
    recommendations: list[RecommendationOut]


class AIStatusOut(BaseModel):
    provider: str
    model: str
    configured: bool


class AICareerPlanOut(BaseModel):
    summary: str
    strengths: list[str]
    gap_priorities: list[str]
    next_steps: list[str]
    suggested_roles: list[str]
    caution: str = ""


class AIJobInsightOut(BaseModel):
    summary: str
    fit_reasons: list[str]
    missing_skills: list[str]
    next_steps: list[str]
    caution: str = ""


# --- training ----------------------------------------------------------------

class TrainingProgramOut(ORMModel):
    id: int
    title: str
    program_type: str
    provider: Optional[str]
    description: Optional[str]
    target_skill_id: Optional[int]
    url: Optional[str]
    duration: Optional[str]
    verification_status: str = "verified"
    target_skill_name: Optional[str] = None


class TrainingProgramIn(BaseModel):
    title: str
    program_type: str = "course"
    provider: Optional[str] = None
    description: Optional[str] = None
    target_skill_id: Optional[int] = None
    url: Optional[str] = None
    duration: Optional[str] = None


class TrainingEnrollmentIn(BaseModel):
    program_id: int


class TrainingProgressUpdate(BaseModel):
    status: Optional[str] = None
    assessment_score: Optional[float] = None
    practical_component: Optional[bool] = None
    work_experience_kind: Optional[str] = None
    stipend_amount: Optional[int] = None
    provider_rating: Optional[float] = None


class TrainingEnrollmentOut(ORMModel):
    id: int
    program_id: int
    status: str
    enrolled_at: datetime
    completed_at: Optional[datetime]
    assessment_score: Optional[float]
    practical_component: bool
    work_experience_kind: Optional[str]
    stipend_amount: Optional[int]
    provider_rating: Optional[float]
    program_title: str = ""
    program_type: str = ""
    provider: Optional[str] = None
    target_skill_name: Optional[str] = None


# --- jobs & applications -----------------------------------------------------

class JobSkillIn(BaseModel):
    skill_id: int
    weight: float = 1.0


class JobIn(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    constituency_id: Optional[int] = None
    min_experience: float = 0.0
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    education_required: Optional[str] = None
    jd_filename: Optional[str] = None
    skills: list[JobSkillIn] = []


class JobOut(ORMModel):
    id: int
    title: str
    description: Optional[str]
    location: Optional[str]
    min_experience: float
    salary_min: Optional[int]
    salary_max: Optional[int]
    education_required: Optional[str]
    jd_filename: Optional[str] = None
    status: str
    created_at: datetime
    org_id: int
    org_name: str = ""
    org_industry: Optional[str] = None
    org_about: Optional[str] = None
    org_verification_status: str = "unverified"
    skills: list[SkillOut] = []
    applicant_count: int = 0
    match_score: Optional[float] = None  # populated in youth job-board context
    already_applied: bool = False


class CandidateOut(BaseModel):
    youth_id: int
    name: str
    education_level: Optional[str]
    education_field: Optional[str] = None
    institution: Optional[str] = None
    experience_years: float
    experience_title: Optional[str] = None
    experience_company: Optional[str] = None
    constituency_name: Optional[str]
    employability_score: float
    employability_band: str = ""
    match_score: float
    skills: list[str]
    resume_filename: Optional[str] = None
    verification_status: str = "unverified"


class InterviewOut(ORMModel):
    scheduled_at: Optional[datetime] = None
    mode: str = "In-person"
    notes: Optional[str] = None


class PlacementOutcomeOut(ORMModel):
    id: int
    application_id: int
    joined_at: datetime
    starting_salary: Optional[int]
    current_salary: Optional[int]
    employment_type: Optional[str]
    has_formal_benefits: Optional[bool]
    role_skill_match: Optional[float]
    candidate_satisfaction: Optional[float]
    employer_satisfaction: Optional[float]
    retained_3m: Optional[bool]
    retained_6m: Optional[bool]
    retained_12m: Optional[bool]
    exit_reason: Optional[str]
    last_checkin_at: Optional[datetime]


class PlacementOutcomeUpdate(BaseModel):
    starting_salary: Optional[int] = None
    current_salary: Optional[int] = None
    employment_type: Optional[str] = None
    has_formal_benefits: Optional[bool] = None
    employer_satisfaction: Optional[float] = None


class RetentionCheckIn(BaseModel):
    retention_months: int
    still_employed: bool
    current_salary: Optional[int] = None
    role_skill_match: Optional[float] = None
    candidate_satisfaction: Optional[float] = None
    exit_reason: Optional[str] = None


class ApplicationOut(ORMModel):
    id: int
    job_id: int
    youth_id: int
    stage: str
    match_score: float
    created_at: datetime
    updated_at: datetime
    job_title: str = ""
    org_name: str = ""
    youth_name: str = ""
    interview: Optional[InterviewOut] = None
    placement_outcome: Optional[PlacementOutcomeOut] = None


class StageUpdate(BaseModel):
    stage: str


class OfferResponse(BaseModel):
    accept: bool


class RecruiterOrgOut(ORMModel):
    id: int
    name: str
    industry: Optional[str]
    about: Optional[str]
    verification_status: str
    job_count: int = 0
    hired_count: int = 0
    constituency_name: Optional[str] = None


class CompanyHireRow(BaseModel):
    org_id: int
    company: str
    industry: Optional[str]
    verification_status: str
    active_jobs: int
    applications: int
    hired: int


class PlacementRow(BaseModel):
    youth_id: int
    youth_name: str
    education_level: Optional[str]
    job_title: str
    company: str
    stage: str
    match_score: float
    updated_at: datetime


class InterviewIn(BaseModel):
    scheduled_at: Optional[datetime] = None
    mode: str = "In-person"
    notes: Optional[str] = None


class CandidateDocumentIn(BaseModel):
    document_type: str
    filename: str


class CandidateDocumentOut(ORMModel):
    id: int
    youth_id: int
    document_type: str
    filename: str
    verification_status: str
    reviewer_notes: Optional[str]
    created_at: datetime
    verified_at: Optional[datetime]
    youth_name: str = ""


class DocumentVerificationIn(BaseModel):
    approve: bool
    reviewer_notes: Optional[str] = None


class PlacementCommissionIn(BaseModel):
    application_id: int
    fee_amount: int
    tax_amount: int = 0
    notes: Optional[str] = None


class CommissionStatusIn(BaseModel):
    payment_status: str
    notes: Optional[str] = None


class PlacementCommissionOut(ORMModel):
    id: int
    application_id: int
    org_id: int
    invoice_number: str
    fee_amount: int
    tax_amount: int
    payment_status: str
    notes: Optional[str]
    issued_at: datetime
    paid_at: Optional[datetime]
    youth_name: str = ""
    job_title: str = ""
    company: str = ""


# --- dashboards --------------------------------------------------------------

class KpiTiles(BaseModel):
    total_youth: int
    registered_seekers: int
    active_recruiters: int
    training_enrolled: int
    placed_candidates: int
    placement_rate: float


class PipelineFunnel(BaseModel):
    registered: int
    shortlisted: int
    interviews: int
    selected: int
    joined: int


class NameValue(BaseModel):
    name: str
    value: float


class ConstituencyComparison(BaseModel):
    name: str
    registered_youth: int
    placed_candidates: int
    placement_rate: float
    is_yours: bool = False


class MlaDashboardOut(BaseModel):
    constituency_name: str
    kpis: KpiTiles
    employment_score: float
    employment_score_band: str
    pipeline: PipelineFunnel
    employment_status: list[NameValue]     # donut
    monthly_placements: list[NameValue]    # bar
    top_skill_demand: list[NameValue]
    gender: list[NameValue]
    age_group: list[NameValue]
    education_level: list[NameValue]
    comparison: list[ConstituencyComparison]


class RecruiterDashboardOut(BaseModel):
    active_jobs: int
    total_applications: int
    shortlisted: int
    hired: int
    top_candidates: list[CandidateOut]
    pipeline: PipelineFunnel


class OutcomeDashboardOut(BaseModel):
    placements: int
    joining_rate: float
    median_starting_salary: float
    average_wage_growth: float
    average_time_to_placement_days: float
    role_skill_match: float
    formal_benefits_coverage: float
    candidate_satisfaction: float
    employer_satisfaction: float
    retention_3m: float
    retention_6m: float
    retention_12m: float
    training_enrollments: int
    training_completion_rate: float
    average_assessment_score: float
    work_based_learning_share: float
    women_placement_share: float
    registration_conversion: float = 0.0
    average_salary: float = 0.0
    interview_conversion: float = 0.0
    employer_response_days: float = 0.0
    entrepreneurship_created: int = 0
    rural_coverage: float = 0.0
    assisted_access_share: float = 0.0
    differently_abled_participation: float = 0.0
    skill_mismatch_rate: float = 0.0
    active_mentorships: int = 0
    reminder_completion_rate: float = 0.0


# --- integrated ecosystem enhancements --------------------------------------

class CareerAssessmentIn(BaseModel):
    aptitude_area: Optional[str] = None
    interests: Optional[str] = None
    preferred_sectors: Optional[str] = None
    mobility: Optional[str] = None
    wage_expectation: Optional[int] = None
    entrepreneurship_interest: bool = False
    career_plan_completed: bool = True
    referral_accepted: bool = False


class CareerAssessmentOut(ORMModel):
    id: int
    youth_id: int
    aptitude_area: Optional[str]
    interests: Optional[str]
    preferred_sectors: Optional[str]
    mobility: Optional[str]
    wage_expectation: Optional[int]
    entrepreneurship_interest: bool
    career_plan_completed: bool
    referral_accepted: bool
    suitability_score: float
    updated_at: datetime


class MentorOut(ORMModel):
    id: int
    name: str
    expertise: str
    organisation: Optional[str]
    district: Optional[str]
    languages: str
    rural_support: bool


class MentorshipIn(BaseModel):
    mentor_id: int
    goal: Optional[str] = None


class MentorshipOut(ORMModel):
    id: int
    mentor_id: int
    status: str
    goal: Optional[str]
    next_session_at: Optional[datetime]
    youth_rating: Optional[float]
    created_at: datetime
    mentor_name: str = ""
    mentor_expertise: str = ""


class OpportunityOut(ORMModel):
    id: int
    title: str
    category: str
    provider: str
    district: Optional[str]
    description: Optional[str]
    skill_names: Optional[str]
    income_min: Optional[int]
    income_max: Optional[int]
    remote_allowed: bool
    rural_friendly: bool
    women_focused: bool
    safeguards: Optional[str]
    finance_guidance: Optional[str]
    market_access: Optional[str]
    url: Optional[str]
    verification_status: str
    already_interested: bool = False


class OpportunityApplicationOut(ORMModel):
    id: int
    opportunity_id: int
    status: str
    monthly_income: Optional[int]
    created_at: datetime
    opportunity_title: str = ""
    category: str = ""


class ReminderOut(ORMModel):
    id: int
    title: str
    message: Optional[str]
    reminder_type: str
    channel: str
    due_at: Optional[datetime]
    action_url: Optional[str]
    is_read: bool
    created_at: datetime


class DemandForecastOut(BaseModel):
    skill_id: int
    skill_name: str
    current_demand: float
    forecast_6m: float
    trend: str
    shortage_roles: int


class SkillSupplyGapOut(BaseModel):
    skill_id: int
    skill_name: str
    openings: int
    available_youth: int
    shortage: int


class EmployerSupportIn(BaseModel):
    request_type: str
    description: Optional[str] = None


class EmployerSupportOut(ORMModel):
    id: int
    request_type: str
    description: Optional[str]
    status: str
    created_at: datetime


class IntegrationStatusOut(ORMModel):
    id: int
    platform: str
    capability: str
    status: str
    mode: str
    last_synced_at: Optional[datetime]
    official_url: Optional[str]


class PolicyRecommendationOut(BaseModel):
    priority: str
    title: str
    evidence: str
    action: str


class EcosystemOverviewOut(BaseModel):
    assessment: Optional[CareerAssessmentOut]
    forecasts: list[DemandForecastOut]
    mentors: list[MentorOut]
    mentorships: list[MentorshipOut]
    opportunities: list[OpportunityOut]
    applications: list[OpportunityApplicationOut]
    reminders: list[ReminderOut]
    integrations: list[IntegrationStatusOut]


# --- adaptive skill assessment and explainable matching ---------------------

class AssessmentStartIn(BaseModel):
    category: str
    target_role: str
    skill_ids: list[int] = []


class AssessmentAnswerIn(BaseModel):
    question_id: int
    answer: str = ""


class AssessmentSubmitIn(BaseModel):
    answers: list[AssessmentAnswerIn]


class AssessmentQuestionOut(ORMModel):
    id: int
    skill: str
    question: str
    question_type: str
    difficulty: str
    max_score: float
    sequence: int
    answer: Optional[str] = None
    score: Optional[float] = None
    ai_feedback: Optional[str] = None


class CandidateSkillScoreOut(ORMModel):
    id: int
    skill: str
    score: float
    knowledge_level: str


class SkillGapAnalysisOut(ORMModel):
    id: int
    skill: str
    candidate_score: float
    required_score: float
    gap_percentage: float
    recommendation: Optional[str]


class CandidateJobMatchOut(ORMModel):
    id: int
    job_id: int
    job_title: str = ""
    company: str = ""
    skill_match: float
    experience_match: float
    location_match: float
    salary_match: float
    availability_match: float
    requirement_match: float
    optional_skill_match: float
    overall_match_score: float
    match_level: str
    mandatory_missing: list[str] = []
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    recommendation_reason: Optional[str]
    gaps: list[SkillGapAnalysisOut] = []


class CandidateAssessmentOut(ORMModel):
    id: int
    candidate_id: int
    candidate_name: str = ""
    category: str
    target_role: Optional[str]
    assessment_type: str
    started_at: datetime
    completed_at: Optional[datetime]
    overall_score: Optional[float]
    knowledge_level: Optional[str]
    status: str
    strengths: Optional[list[str]] = []
    weak_areas: Optional[list[str]] = []
    ai_disclaimer: str
    questions: list[AssessmentQuestionOut] = []
    skill_scores: list[CandidateSkillScoreOut] = []
    job_matches: list[CandidateJobMatchOut] = []
    practical_verifications: list[dict] = []


class PracticalVerificationIn(BaseModel):
    practical_test: float = 0
    communication: float = 0
    technical_skill: float = 0
    job_knowledge: float = 0
    safety_awareness: float = 0
    problem_solving: float = 0
    notes: Optional[str] = None


class PracticalVerificationOut(ORMModel):
    id: int
    assessment_id: int
    reviewer_user_id: int
    practical_test: float
    communication: float
    technical_skill: float
    job_knowledge: float
    safety_awareness: float
    problem_solving: float
    notes: Optional[str]
    created_at: datetime


class AssessmentConfigUpdate(BaseModel):
    mcq_weight: float = 20
    scenario_weight: float = 25
    practical_weight: float = 20
    coding_weight: float = 25
    experience_weight: float = 10
    match_skill_weight: float = 45
    match_experience_weight: float = 20
    match_location_weight: float = 10
    match_salary_weight: float = 10
    match_availability_weight: float = 5
    match_requirement_weight: float = 5
    match_optional_weight: float = 5
    knowledge_thresholds: str = "0,40,60,80,90"
    match_thresholds: str = "0,50,65,80,90"


class AssessmentConfigOut(ORMModel):
    id: int
    name: str
    mcq_weight: float
    scenario_weight: float
    practical_weight: float
    coding_weight: float
    experience_weight: float
    match_skill_weight: float
    match_experience_weight: float
    match_location_weight: float
    match_salary_weight: float
    match_availability_weight: float
    match_requirement_weight: float
    match_optional_weight: float
    knowledge_thresholds: str
    match_thresholds: str
    updated_at: datetime


class JobRequirementSkillIn(BaseModel):
    skill_id: int
    minimum_score: float = 60
    mandatory: bool = True
    optional: bool = False
    weightage: float = 1


class JobRequirementIn(BaseModel):
    maximum_notice_days: Optional[int] = None
    mandatory_education: bool = False
    required_certificate: Optional[str] = None
    required_licence: Optional[str] = None
    candidate_category: Optional[str] = None
    skills: list[JobRequirementSkillIn] = []


class AssessmentQueueRow(BaseModel):
    assessment_id: int
    candidate_name: str
    category: str
    target_role: Optional[str]
    status: str
    overall_score: Optional[float]
    knowledge_level: Optional[str]
    top_job: Optional[str]
    job_match_score: Optional[float]
    assessment_date: datetime


AuthResponse.model_rebuild()
RecommendationOut.model_rebuild()
