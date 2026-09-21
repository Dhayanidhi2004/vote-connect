"""Idempotent catalog backfill for enhancement features on existing demo databases."""
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import (
    AssessmentConfig,
    DemandForecast,
    EmploymentOpportunity,
    IntegrationStatus,
    Job,
    JobRequiredSkill,
    Mentor,
    SkillDemand,
)


INTEGRATIONS = [
    ("Tamil Nadu Employment & Training", "District centres, registration, job fairs", "https://tnvelaivaaippu.gov.in/activities.html"),
    ("Naan Mudhalvan", "Industry courses, mentors, internships, apprenticeships", "https://www.naanmudhalvan.tn.gov.in/internships/"),
    ("National Career Service", "National vacancies, counsellors, career centres", "https://www.ncs.gov.in/Pages/about-us.aspx"),
    ("Skill India Digital Hub", "Digital courses, credentials, jobs, entrepreneurship", "https://www.skillindiadigital.gov.in/about-us"),
]

MENTORS = [
    ("Meena Krishnan", "IT & Data Careers", "Zoho Alumni Network", False),
    ("Senthil Kumar", "Manufacturing & Apprenticeships", "TVS Skills", True),
    ("Farzana Begum", "Women Entrepreneurship", "Tamil Nadu Startup Hub", True),
    ("Arun Prasad", "Banking, Accounts & GST", "MSME Mentor Forum", False),
]

OPPORTUNITIES = [
    dict(title="Rural EV Service Apprenticeship", category="apprenticeship", provider="Ather Rural Service Network", district="Chengalpattu", skill_names="Electric Vehicle Technician, Customer Service", income_min=9000, income_max=14000, rural_friendly=True, safeguards="Verified employer, written stipend, PPE and insurance required", finance_guidance="Stipend budgeting and tool-purchase guidance", market_access="Service-centre placement network"),
    dict(title="Women-led Food Enterprise Accelerator", category="startup", provider="TN Women Development Corporation", district="Chennai", skill_names="Sales, Digital Marketing", income_min=15000, income_max=45000, rural_friendly=True, women_focused=True, safeguards="No upfront agent fee; verify loan and subsidy terms", finance_guidance="Udyam, GST, credit, insurance and cash-flow coaching", market_access="SHG fairs and digital commerce onboarding"),
    dict(title="Local Bookkeeping Micro-business", category="self_employment", provider="MSME Service Desk", district="Chennai", skill_names="Tally, GST Filing, Excel", income_min=12000, income_max=35000, remote_allowed=True, rural_friendly=True, safeguards="Client agreement, data privacy and professional indemnity guidance", finance_guidance="Pricing, invoicing, tax and emergency-fund guidance", market_access="Verified MSME client referrals"),
    dict(title="Verified Tamil Digital Support Gigs", category="gig", provider="NCS Local Partner", district="Tamil Nadu", skill_names="Communication, MS Office, Customer Service", income_min=8000, income_max=22000, remote_allowed=True, rural_friendly=True, safeguards="Platform verification, transparent commission, accident cover and grievance channel", finance_guidance="Income tracking, insurance and tax basics", market_access="Verified task marketplace"),
    dict(title="District Job Fair - Operations Roles", category="rural_job", provider="TN Employment Department", district="Kancheepuram", skill_names="Communication, CNC Operator, Customer Service", income_min=18000, income_max=30000, rural_friendly=True, safeguards="Government-facilitated employer verification and zero recruitment fee", market_access="District career centre and job fair"),
    dict(title="Data Analyst Employer Project", category="internship", provider="Zoho Corporation", district="Chennai", skill_names="Data Analysis, SQL, Power BI", income_min=10000, income_max=18000, remote_allowed=True, safeguards="Defined project scope, mentor, stipend and completion certificate", market_access="Interview pathway for successful projects"),
]


def _ensure_catalogs(db: Session) -> None:
    if db.query(AssessmentConfig).filter(AssessmentConfig.name == "default").first() is None:
        db.add(AssessmentConfig(name="default"))

    existing_platforms = {row[0] for row in db.query(IntegrationStatus.platform).all()}
    for platform, capability, url in INTEGRATIONS:
        if platform not in existing_platforms:
            db.add(IntegrationStatus(
                platform=platform,
                capability=capability,
                status="adapter_ready",
                mode="official_link",
                official_url=url,
            ))

    existing_mentors = {row[0] for row in db.query(Mentor.name).all()}
    for name, expertise, organisation, rural_support in MENTORS:
        if name not in existing_mentors:
            db.add(Mentor(
                name=name,
                expertise=expertise,
                organisation=organisation,
                district="Chennai",
                languages="Tamil, English",
                rural_support=rural_support,
            ))

    existing_opportunities = {
        row[0] for row in db.query(EmploymentOpportunity.title).all()
    }
    for item in OPPORTUNITIES:
        if item["title"] not in existing_opportunities:
            db.add(EmploymentOpportunity(
                description="Verified pathway with practical experience and outcome tracking.",
                verification_status="verified",
                **item,
            ))

    existing_forecasts = {
        (row[0], row[1])
        for row in db.query(DemandForecast.constituency_id, DemandForecast.skill_id).all()
    }
    for demand in db.query(SkillDemand).all():
        key = (demand.constituency_id, demand.skill_id)
        if key in existing_forecasts:
            continue
        growth = 1.18 if demand.demand_weight >= 8 else 1.10 if demand.demand_weight >= 6 else 1.04
        db.add(DemandForecast(
            constituency_id=demand.constituency_id,
            skill_id=demand.skill_id,
            current_demand=float(demand.demand_weight),
            forecast_6m=round(demand.demand_weight * growth, 1),
            trend="rising" if growth >= 1.10 else "stable",
            shortage_roles=max(2, round(demand.demand_weight * growth * 3)),
        ))

    configured_jobs = {row[0] for row in db.query(JobRequiredSkill.job_id).distinct().all()}
    for job in db.query(Job).all():
        if job.id in configured_jobs:
            continue
        for required in job.skills:
            db.add(JobRequiredSkill(
                job_id=job.id,
                skill_id=required.skill_id,
                minimum_score=60.0,
                mandatory=True,
                optional=False,
                weightage=required.weight,
            ))


def ensure_enhancement_seed_data() -> None:
    """Populate only missing reference rows; never replace user-entered data."""
    db = SessionLocal()
    try:
        _ensure_catalogs(db)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
