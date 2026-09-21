"""SQLAlchemy ORM models — the full domain for the constituency youth platform.

Design notes:
- Identity is anchored on phone (User.phone). Voter ID / EPIC is a *claimed*,
  consented attribute on YouthProfile (epic_number + epic_verified), never the
  login key. See docs/00-TECHNICAL-BLUEPRINT.md §4.
- The schema is constituency-aware from day one, but the demo seeds one
  primary constituency (Velachery) plus comparison rows for the MLA dashboard.
"""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


class Constituency(Base):
    __tablename__ = "constituencies"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    district = Column(String, nullable=False)
    state = Column(String, nullable=False)
    is_primary = Column(Boolean, default=False)  # the MLA's own constituency

    # Headline figures shown on the MLA dashboard. For the demo these mirror the
    # pitch deck (official-style aggregates) rather than counting sample rows.
    total_youth = Column(Integer, default=0)
    registered_seekers = Column(Integer, default=0)
    active_recruiters = Column(Integer, default=0)
    training_enrolled = Column(Integer, default=0)
    placed_candidates = Column(Integer, default=0)
    placement_rate = Column(Float, default=0.0)      # percentage
    employment_score = Column(Float, default=0.0)    # 0-100

    skill_demands = relationship("SkillDemand", back_populates="constituency")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    phone = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # youth | recruiter | admin
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    recruiter_org_id = Column(Integer, ForeignKey("recruiter_orgs.id"), nullable=True)

    youth_profile = relationship("YouthProfile", back_populates="user", uselist=False)
    recruiter_org = relationship("RecruiterOrg", back_populates="members")
    consents = relationship("ConsentRecord", back_populates="user")
    reminders = relationship("Reminder", back_populates="user", cascade="all, delete-orphan")


class OtpCode(Base):
    """Mock OTP store. In the demo the code is shown on-screen, not sent by SMS."""
    __tablename__ = "otp_codes"
    id = Column(Integer, primary_key=True)
    phone = Column(String, nullable=False, index=True)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    consumed = Column(Boolean, default=False)


class Skill(Base):
    __tablename__ = "skills"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    category = Column(String, default="General")


class SkillDemand(Base):
    """Industry demand weight for a skill within a constituency (drives skill gap)."""
    __tablename__ = "skill_demands"
    id = Column(Integer, primary_key=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    demand_weight = Column(Float, default=1.0)  # higher = more in demand

    constituency = relationship("Constituency", back_populates="skill_demands")
    skill = relationship("Skill")


class YouthProfile(Base):
    __tablename__ = "youth_profiles"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # Claimed Voter ID (consented attribute, NOT authoritatively verified).
    epic_number = Column(String, nullable=True)
    epic_verified = Column(Boolean, default=False)
    verification_status = Column(String, default="unverified")  # unverified|pending|verified

    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=True)

    # Demographics (power the MLA dashboard charts)
    gender = Column(String, nullable=True)       # Male | Female | Other
    age = Column(Integer, nullable=True)
    rural_resident = Column(Boolean, default=False)
    differently_abled = Column(Boolean, default=False)
    assisted_access = Column(Boolean, default=False)
    preferred_language = Column(String, default="English")
    mobility_preference = Column(String, default="Within district")
    expected_salary = Column(Integer, nullable=True)
    candidate_category = Column(String, default="IT")  # IT|Non-IT|General Workforce
    target_role = Column(String, nullable=True)
    notice_period_days = Column(Integer, default=0)
    certificates = Column(Text, nullable=True)

    # Education
    education_level = Column(String, nullable=True)  # Below 12th|Diploma|Graduate|Post Graduate
    education_field = Column(String, nullable=True)
    institution = Column(String, nullable=True)
    graduation_year = Column(Integer, nullable=True)

    # Experience
    experience_years = Column(Float, default=0.0)
    experience_title = Column(String, nullable=True)
    experience_company = Column(String, nullable=True)

    resume_filename = Column(String, nullable=True)

    employability_score = Column(Float, default=0.0)  # 0-100, recomputed on change
    employment_status = Column(String, default="unemployed")  # employed|unemployed|in_training

    onboarding_complete = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="youth_profile")
    constituency = relationship("Constituency")
    skills = relationship("YouthSkill", back_populates="youth", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="youth")
    training_enrollments = relationship(
        "TrainingEnrollment", back_populates="youth", cascade="all, delete-orphan"
    )
    career_assessment = relationship(
        "CareerAssessment", back_populates="youth", uselist=False,
        cascade="all, delete-orphan"
    )
    mentorships = relationship(
        "Mentorship", back_populates="youth", cascade="all, delete-orphan"
    )
    opportunity_applications = relationship(
        "OpportunityApplication", back_populates="youth", cascade="all, delete-orphan"
    )
    assessments = relationship(
        "CandidateAssessment", back_populates="candidate", cascade="all, delete-orphan"
    )
    documents = relationship("CandidateDocument", back_populates="youth", cascade="all, delete-orphan")


class YouthSkill(Base):
    __tablename__ = "youth_skills"
    __table_args__ = (UniqueConstraint("youth_id", "skill_id"),)
    id = Column(Integer, primary_key=True)
    youth_id = Column(Integer, ForeignKey("youth_profiles.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    level = Column(Integer, default=3)  # 1-5 self-assessed

    youth = relationship("YouthProfile", back_populates="skills")
    skill = relationship("Skill")


class RecruiterOrg(Base):
    __tablename__ = "recruiter_orgs"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    industry = Column(String, nullable=True)
    about = Column(Text, nullable=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=True)
    # Admin-managed verification of the employer (unverified|pending|verified).
    verification_status = Column(String, default="pending")

    members = relationship("User", back_populates="recruiter_org")
    jobs = relationship("Job", back_populates="org")
    support_requests = relationship(
        "EmployerSupportRequest", back_populates="org", cascade="all, delete-orphan"
    )


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("recruiter_orgs.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=True)
    location = Column(String, nullable=True)
    min_experience = Column(Float, default=0.0)
    salary_min = Column(Integer, nullable=True)  # monthly INR
    salary_max = Column(Integer, nullable=True)
    education_required = Column(String, nullable=True)
    # Job-description PDF uploaded by the recruiter; shown/downloadable to youth.
    jd_filename = Column(String, nullable=True)
    status = Column(String, default="active")  # active | closed
    created_at = Column(DateTime, default=datetime.utcnow)

    org = relationship("RecruiterOrg", back_populates="jobs")
    constituency = relationship("Constituency")
    skills = relationship("JobSkill", back_populates="job", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="job")
    assessment_requirement = relationship(
        "JobRequirement", back_populates="job", uselist=False, cascade="all, delete-orphan"
    )
    assessment_skills = relationship(
        "JobRequiredSkill", back_populates="job", cascade="all, delete-orphan"
    )


class JobSkill(Base):
    __tablename__ = "job_skills"
    __table_args__ = (UniqueConstraint("job_id", "skill_id"),)
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    weight = Column(Float, default=1.0)

    job = relationship("Job", back_populates="skills")
    skill = relationship("Skill")


# Hiring pipeline stages (mirrors the deck: Applied -> ... -> Joined)
PIPELINE_STAGES = ["applied", "shortlisted", "interview", "selected", "joined"]


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("job_id", "youth_id"),)
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    youth_id = Column(Integer, ForeignKey("youth_profiles.id"), nullable=False)
    stage = Column(String, default="applied")  # see PIPELINE_STAGES + "rejected"
    match_score = Column(Float, default=0.0)  # 0-100, cached at apply time
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("Job", back_populates="applications")
    youth = relationship("YouthProfile", back_populates="applications")
    interview = relationship("Interview", back_populates="application", uselist=False)
    placement_outcome = relationship(
        "PlacementOutcome", back_populates="application", uselist=False,
        cascade="all, delete-orphan"
    )
    commission = relationship("PlacementCommission", uselist=False, cascade="all, delete-orphan")


class Interview(Base):
    __tablename__ = "interviews"
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True, nullable=False)
    scheduled_at = Column(DateTime, nullable=True)
    mode = Column(String, default="In-person")  # In-person | Phone | Video
    notes = Column(Text, nullable=True)

    application = relationship("Application", back_populates="interview")


class CandidateDocument(Base):
    """Document metadata only; storage can be connected to S3/Supabase later."""
    __tablename__ = "candidate_documents"
    id = Column(Integer, primary_key=True)
    youth_id = Column(Integer, ForeignKey("youth_profiles.id"), nullable=False)
    document_type = Column(String, nullable=False)  # resume|identity|certificate|licence|other
    filename = Column(String, nullable=False)
    verification_status = Column(String, default="pending")  # pending|verified|rejected
    reviewer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)

    youth = relationship("YouthProfile", back_populates="documents")


class PlacementCommission(Base):
    """Recoverable placement fee and invoice status for consultancy operations."""
    __tablename__ = "placement_commissions"
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True, nullable=False)
    org_id = Column(Integer, ForeignKey("recruiter_orgs.id"), nullable=False)
    invoice_number = Column(String, unique=True, nullable=False)
    fee_amount = Column(Integer, nullable=False)
    tax_amount = Column(Integer, default=0)
    payment_status = Column(String, default="pending")  # pending|invoiced|part_paid|paid|waived
    notes = Column(Text, nullable=True)
    issued_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)

    application = relationship("Application", back_populates="commission")


class TrainingProgram(Base):
    """Admin-managed catalog of courses / certs / apprenticeships / govt schemes.

    Recommendations are surfaced to youth by matching target_skill to their gap.
    """
    __tablename__ = "training_programs"
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    program_type = Column(String, default="course")  # course|certification|apprenticeship|scheme
    provider = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    target_skill_id = Column(Integer, ForeignKey("skills.id"), nullable=True)
    url = Column(String, nullable=True)
    duration = Column(String, nullable=True)
    # Submitted by a training-provider portal; admin verifies (pending|verified|rejected).
    verification_status = Column(String, default="pending")
    submitted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    target_skill = relationship("Skill")
    enrollments = relationship("TrainingEnrollment", back_populates="program")


class TrainingEnrollment(Base):
    """Tracks progress from a recommendation to demonstrated skill acquisition."""
    __tablename__ = "training_enrollments"
    __table_args__ = (UniqueConstraint("youth_id", "program_id"),)

    id = Column(Integer, primary_key=True)
    youth_id = Column(Integer, ForeignKey("youth_profiles.id"), nullable=False)
    program_id = Column(Integer, ForeignKey("training_programs.id"), nullable=False)
    status = Column(String, default="enrolled")  # enrolled|in_progress|completed|dropped
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    assessment_score = Column(Float, nullable=True)
    practical_component = Column(Boolean, default=False)
    work_experience_kind = Column(String, nullable=True)  # project|internship|apprenticeship|simulation
    stipend_amount = Column(Integer, nullable=True)
    provider_rating = Column(Float, nullable=True)

    youth = relationship("YouthProfile", back_populates="training_enrollments")
    program = relationship("TrainingProgram", back_populates="enrollments")


class PlacementOutcome(Base):
    """Quality and sustainability measures for a joined application."""
    __tablename__ = "placement_outcomes"

    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True, nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    starting_salary = Column(Integer, nullable=True)  # monthly INR
    current_salary = Column(Integer, nullable=True)
    employment_type = Column(String, nullable=True)  # permanent|contract|apprenticeship|self_employed
    has_formal_benefits = Column(Boolean, nullable=True)
    role_skill_match = Column(Float, nullable=True)  # youth score, 1-5
    candidate_satisfaction = Column(Float, nullable=True)  # 1-5
    employer_satisfaction = Column(Float, nullable=True)  # 1-5
    retained_3m = Column(Boolean, nullable=True)
    retained_6m = Column(Boolean, nullable=True)
    retained_12m = Column(Boolean, nullable=True)
    exit_reason = Column(Text, nullable=True)
    last_checkin_at = Column(DateTime, nullable=True)

    application = relationship("Application", back_populates="placement_outcome")


class CareerAssessment(Base):
    """Guidance-before-training assessment used to build a suitable career plan."""
    __tablename__ = "career_assessments"

    id = Column(Integer, primary_key=True)
    youth_id = Column(Integer, ForeignKey("youth_profiles.id"), unique=True, nullable=False)
    aptitude_area = Column(String, nullable=True)
    interests = Column(Text, nullable=True)
    preferred_sectors = Column(Text, nullable=True)
    mobility = Column(String, nullable=True)
    wage_expectation = Column(Integer, nullable=True)
    entrepreneurship_interest = Column(Boolean, default=False)
    career_plan_completed = Column(Boolean, default=False)
    referral_accepted = Column(Boolean, default=False)
    suitability_score = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    youth = relationship("YouthProfile", back_populates="career_assessment")


class Mentor(Base):
    __tablename__ = "mentors"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    expertise = Column(String, nullable=False)
    organisation = Column(String, nullable=True)
    district = Column(String, nullable=True)
    languages = Column(String, default="Tamil, English")
    rural_support = Column(Boolean, default=False)
    active = Column(Boolean, default=True)

    mentorships = relationship("Mentorship", back_populates="mentor")


class Mentorship(Base):
    __tablename__ = "mentorships"
    __table_args__ = (UniqueConstraint("youth_id", "mentor_id"),)

    id = Column(Integer, primary_key=True)
    youth_id = Column(Integer, ForeignKey("youth_profiles.id"), nullable=False)
    mentor_id = Column(Integer, ForeignKey("mentors.id"), nullable=False)
    status = Column(String, default="requested")  # requested|active|completed
    goal = Column(Text, nullable=True)
    next_session_at = Column(DateTime, nullable=True)
    youth_rating = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    youth = relationship("YouthProfile", back_populates="mentorships")
    mentor = relationship("Mentor", back_populates="mentorships")


class EmploymentOpportunity(Base):
    """Verified rural, work-experience, gig, and entrepreneurship marketplace item."""
    __tablename__ = "employment_opportunities"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)  # internship|apprenticeship|rural_job|gig|startup|self_employment
    provider = Column(String, nullable=False)
    district = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    skill_names = Column(Text, nullable=True)
    income_min = Column(Integer, nullable=True)
    income_max = Column(Integer, nullable=True)
    remote_allowed = Column(Boolean, default=False)
    rural_friendly = Column(Boolean, default=False)
    women_focused = Column(Boolean, default=False)
    safeguards = Column(Text, nullable=True)
    finance_guidance = Column(Text, nullable=True)
    market_access = Column(Text, nullable=True)
    url = Column(String, nullable=True)
    verification_status = Column(String, default="verified")

    applications = relationship("OpportunityApplication", back_populates="opportunity")


class OpportunityApplication(Base):
    __tablename__ = "opportunity_applications"
    __table_args__ = (UniqueConstraint("youth_id", "opportunity_id"),)

    id = Column(Integer, primary_key=True)
    youth_id = Column(Integer, ForeignKey("youth_profiles.id"), nullable=False)
    opportunity_id = Column(Integer, ForeignKey("employment_opportunities.id"), nullable=False)
    status = Column(String, default="interested")  # interested|referred|started|completed
    monthly_income = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    youth = relationship("YouthProfile", back_populates="opportunity_applications")
    opportunity = relationship("EmploymentOpportunity", back_populates="applications")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    reminder_type = Column(String, default="action")
    channel = Column(String, default="in_app")  # in_app|sms|email
    due_at = Column(DateTime, nullable=True)
    action_url = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reminders")


class EmployerSupportRequest(Base):
    __tablename__ = "employer_support_requests"

    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("recruiter_orgs.id"), nullable=False)
    request_type = Column(String, nullable=False)  # jd|screening|apprenticeship|job_fair
    description = Column(Text, nullable=True)
    status = Column(String, default="open")
    created_at = Column(DateTime, default=datetime.utcnow)

    org = relationship("RecruiterOrg", back_populates="support_requests")


class DemandForecast(Base):
    __tablename__ = "demand_forecasts"
    __table_args__ = (UniqueConstraint("constituency_id", "skill_id"),)

    id = Column(Integer, primary_key=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    current_demand = Column(Float, default=0.0)
    forecast_6m = Column(Float, default=0.0)
    trend = Column(String, default="stable")  # rising|stable|declining
    shortage_roles = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow)

    constituency = relationship("Constituency")
    skill = relationship("Skill")


class IntegrationStatus(Base):
    """Tracks adapter readiness and sync status for complementary public platforms."""
    __tablename__ = "integration_statuses"

    id = Column(Integer, primary_key=True)
    platform = Column(String, unique=True, nullable=False)
    capability = Column(String, nullable=False)
    status = Column(String, default="adapter_ready")
    mode = Column(String, default="official_link")  # official_link|file_sync|api
    last_synced_at = Column(DateTime, nullable=True)
    official_url = Column(String, nullable=True)


class ConsentRecord(Base):
    """DPDP-style consent capture (purpose-bound, timestamped)."""
    __tablename__ = "consent_records"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    purpose = Column(String, nullable=False)
    granted = Column(Boolean, default=True)
    granted_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="consents")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    target = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class MonthlyPlacement(Base):
    """Seeded monthly placement trend for the MLA dashboard bar chart."""
    __tablename__ = "monthly_placements"
    id = Column(Integer, primary_key=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"), nullable=False)
    month = Column(String, nullable=False)   # e.g. "Jan"
    order_index = Column(Integer, default=0)
    placements = Column(Integer, default=0)


# --- AI skill assessment and explainable job matching -----------------------

class AssessmentConfig(Base):
    __tablename__ = "assessment_configs"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, default="default")
    mcq_weight = Column(Float, default=20.0)
    scenario_weight = Column(Float, default=25.0)
    practical_weight = Column(Float, default=20.0)
    coding_weight = Column(Float, default=25.0)
    experience_weight = Column(Float, default=10.0)
    match_skill_weight = Column(Float, default=45.0)
    match_experience_weight = Column(Float, default=20.0)
    match_location_weight = Column(Float, default=10.0)
    match_salary_weight = Column(Float, default=10.0)
    match_availability_weight = Column(Float, default=5.0)
    match_requirement_weight = Column(Float, default=5.0)
    match_optional_weight = Column(Float, default=5.0)
    knowledge_thresholds = Column(Text, default="0,40,60,80,90")
    match_thresholds = Column(Text, default="0,50,65,80,90")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AssessmentTemplate(Base):
    __tablename__ = "assessment_templates"
    id = Column(Integer, primary_key=True)
    category = Column(String, nullable=False)
    role = Column(String, nullable=True)
    skill = Column(String, nullable=False)
    question_type = Column(String, nullable=False)
    difficulty = Column(String, default="Beginner")
    question = Column(Text, nullable=False)
    evaluation_criteria = Column(Text, nullable=True)
    active = Column(Boolean, default=True)


class CandidateAssessment(Base):
    __tablename__ = "candidate_assessments"
    id = Column(Integer, primary_key=True)
    candidate_id = Column(Integer, ForeignKey("youth_profiles.id"), nullable=False)
    category = Column(String, nullable=False)
    target_role = Column(String, nullable=True)
    assessment_type = Column(String, default="adaptive")
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    overall_score = Column(Float, nullable=True)
    knowledge_level = Column(String, nullable=True)
    status = Column(String, default="in_progress")
    strengths = Column(Text, nullable=True)
    weak_areas = Column(Text, nullable=True)
    ai_disclaimer = Column(Text, default="AI recommendation only. Final decision belongs to Admin / Recruiter / Employer.")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    candidate = relationship("YouthProfile", back_populates="assessments")
    questions = relationship("AssessmentQuestion", back_populates="assessment", cascade="all, delete-orphan")
    skill_scores = relationship("CandidateSkillScore", back_populates="assessment", cascade="all, delete-orphan")
    job_matches = relationship("CandidateJobMatch", back_populates="assessment", cascade="all, delete-orphan")
    practical_verifications = relationship("PracticalVerification", back_populates="assessment", cascade="all, delete-orphan")


class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"
    id = Column(Integer, primary_key=True)
    assessment_id = Column(Integer, ForeignKey("candidate_assessments.id"), nullable=False)
    skill = Column(String, nullable=False)
    question = Column(Text, nullable=False)
    question_type = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)
    max_score = Column(Float, default=100.0)
    correct_answer = Column(Text, nullable=True)
    evaluation_criteria = Column(Text, nullable=True)
    sequence = Column(Integer, default=0)

    assessment = relationship("CandidateAssessment", back_populates="questions")
    answer = relationship("AssessmentAnswer", back_populates="question", uselist=False, cascade="all, delete-orphan")


class AssessmentAnswer(Base):
    __tablename__ = "assessment_answers"
    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, ForeignKey("assessment_questions.id"), unique=True, nullable=False)
    candidate_id = Column(Integer, ForeignKey("youth_profiles.id"), nullable=False)
    answer = Column(Text, nullable=True)
    score = Column(Float, default=0.0)
    technical_correctness = Column(Float, default=0.0)
    practical_understanding = Column(Float, default=0.0)
    explanation_clarity = Column(Float, default=0.0)
    problem_solving = Column(Float, default=0.0)
    completeness = Column(Float, default=0.0)
    ai_feedback = Column(Text, nullable=True)
    evaluated_at = Column(DateTime, default=datetime.utcnow)

    question = relationship("AssessmentQuestion", back_populates="answer")


class CandidateSkillScore(Base):
    __tablename__ = "candidate_skill_scores"
    __table_args__ = (UniqueConstraint("assessment_id", "skill"),)
    id = Column(Integer, primary_key=True)
    candidate_id = Column(Integer, ForeignKey("youth_profiles.id"), nullable=False)
    skill = Column(String, nullable=False)
    score = Column(Float, nullable=False)
    knowledge_level = Column(String, nullable=False)
    assessment_id = Column(Integer, ForeignKey("candidate_assessments.id"), nullable=False)

    assessment = relationship("CandidateAssessment", back_populates="skill_scores")


class PracticalVerification(Base):
    __tablename__ = "practical_verifications"
    id = Column(Integer, primary_key=True)
    assessment_id = Column(Integer, ForeignKey("candidate_assessments.id"), nullable=False)
    reviewer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    practical_test = Column(Float, default=0.0)
    communication = Column(Float, default=0.0)
    technical_skill = Column(Float, default=0.0)
    job_knowledge = Column(Float, default=0.0)
    safety_awareness = Column(Float, default=0.0)
    problem_solving = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("CandidateAssessment", back_populates="practical_verifications")


class JobRequirement(Base):
    __tablename__ = "job_requirements"
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), unique=True, nullable=False)
    maximum_notice_days = Column(Integer, nullable=True)
    mandatory_education = Column(Boolean, default=False)
    required_certificate = Column(String, nullable=True)
    required_licence = Column(String, nullable=True)
    candidate_category = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("Job", back_populates="assessment_requirement")


class JobRequiredSkill(Base):
    __tablename__ = "job_required_skills"
    __table_args__ = (UniqueConstraint("job_id", "skill_id"),)
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    minimum_score = Column(Float, default=60.0)
    mandatory = Column(Boolean, default=True)
    optional = Column(Boolean, default=False)
    weightage = Column(Float, default=1.0)

    job = relationship("Job", back_populates="assessment_skills")
    skill = relationship("Skill")


class CandidateJobMatch(Base):
    __tablename__ = "candidate_job_matches"
    __table_args__ = (UniqueConstraint("assessment_id", "job_id"),)
    id = Column(Integer, primary_key=True)
    candidate_id = Column(Integer, ForeignKey("youth_profiles.id"), nullable=False)
    assessment_id = Column(Integer, ForeignKey("candidate_assessments.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    skill_match = Column(Float, default=0.0)
    experience_match = Column(Float, default=0.0)
    location_match = Column(Float, default=0.0)
    salary_match = Column(Float, default=0.0)
    availability_match = Column(Float, default=0.0)
    requirement_match = Column(Float, default=0.0)
    optional_skill_match = Column(Float, default=0.0)
    overall_match_score = Column(Float, default=0.0)
    match_level = Column(String, nullable=False)
    mandatory_missing = Column(Text, nullable=True)
    matched_skills = Column(Text, nullable=True)
    missing_skills = Column(Text, nullable=True)
    recommendation_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("CandidateAssessment", back_populates="job_matches")
    job = relationship("Job")
    gaps = relationship("SkillGapAnalysis", back_populates="job_match", cascade="all, delete-orphan")


class SkillGapAnalysis(Base):
    __tablename__ = "skill_gap_analyses"
    id = Column(Integer, primary_key=True)
    candidate_id = Column(Integer, ForeignKey("youth_profiles.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    job_match_id = Column(Integer, ForeignKey("candidate_job_matches.id"), nullable=False)
    skill = Column(String, nullable=False)
    candidate_score = Column(Float, default=0.0)
    required_score = Column(Float, default=0.0)
    gap_percentage = Column(Float, default=0.0)
    recommendation = Column(Text, nullable=True)

    job_match = relationship("CandidateJobMatch", back_populates="gaps")
