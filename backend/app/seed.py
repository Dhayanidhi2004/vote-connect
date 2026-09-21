"""Seed the demo database with Velachery / Tamil Nadu data that mirrors the deck.

Run:  python -m app.seed            (from the backend/ directory)

Demo accounts (log in with the phone, read the OTP shown on screen):
  MLA / Admin ........ 9000000001
  Recruiter (Zoho) ... 9000000002
  Youth (Karthik R) .. 9000000003
"""
import random
from datetime import datetime, timedelta

from .database import Base, SessionLocal, engine
from .models import (
    Application,
    CareerAssessment,
    Constituency,
    Interview,
    IntegrationStatus,
    Job,
    JobSkill,
    MonthlyPlacement,
    Mentor,
    Mentorship,
    EmploymentOpportunity,
    OpportunityApplication,
    PlacementOutcome,
    Reminder,
    RecruiterOrg,
    Skill,
    SkillDemand,
    DemandForecast,
    TrainingProgram,
    TrainingEnrollment,
    User,
    YouthProfile,
    YouthSkill,
)
from . import services
from .auth import hash_password

random.seed(42)  # reproducible demo data


def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


# --- catalogs ----------------------------------------------------------------

SKILLS = [
    ("MS Office", "Productivity"), ("Excel", "Productivity"),
    ("Excel Advanced", "Data"), ("Tally", "Accounting"),
    ("Tally Prime", "Accounting"), ("Basic Accounting", "Accounting"),
    ("GST Filing", "Accounting"), ("GST Basics", "Accounting"),
    ("Communication", "Soft Skills"), ("Power BI", "Data"),
    ("Data Analysis", "Data"), ("Data Analytics", "Data"),
    ("Digital Marketing", "Marketing"), ("Python", "Programming"),
    ("SQL", "Programming"), ("Cloud Support", "IT"),
    ("CNC Operator", "Manufacturing"),
    ("Electric Vehicle Technician", "Manufacturing"),
    ("Customer Service", "Soft Skills"), ("Sales", "Business"),
]

# Constituency-level demand (drives skill gap + MLA "top skill demand").
# High-weight future skills + broadly-demanded baseline skills so that common
# competencies (communication, MS Office, Tally) also count toward employability.
DEMAND = {
    "Data Analytics": 10, "Digital Marketing": 9,
    "Electric Vehicle Technician": 8, "CNC Operator": 7, "Cloud Support": 6,
    "Excel Advanced": 8, "Tally Prime": 7, "GST Filing": 7,
    "Power BI": 8, "Data Analysis": 7, "Python": 6, "SQL": 6,
    # baseline / broadly-demanded
    "Communication": 5, "Excel": 5, "Tally": 5, "MS Office": 4,
    "Basic Accounting": 4, "Customer Service": 4, "GST Basics": 3, "Sales": 3,
}

# Comparison constituencies from deck page 7.
COMPARISON = [
    ("Constituency A", 16200, 8450, 52),
    ("Constituency B", 14800, 7120, 48),
    ("Constituency C", 13500, 6800, 50),
    ("Constituency D", 12500, 6100, 49),
]

MONTHLY = [("Jan", 850), ("Feb", 1020), ("Mar", 1360),
           ("Apr", 1520), ("May", 1710), ("Jun", 2250)]

TRAINING = [
    ("Power BI Fundamentals", "course", "NSDC", "Power BI", "6 weeks",
     "Hands-on Power BI dashboards and reporting."),
    ("Tally Prime Certification", "certification", "Tally Education", "Tally Prime",
     "8 weeks", "Industry-recognised Tally Prime certification."),
    ("GST Practitioner Course", "certification", "ICAI Partner", "GST Filing",
     "10 weeks", "Become a certified GST return-filing practitioner."),
    ("Data Analytics Bootcamp", "course", "Skill India", "Data Analytics",
     "12 weeks", "Excel, SQL and analytics for entry-level data roles."),
    ("Digital Marketing Essentials", "course", "Google Partner", "Digital Marketing",
     "6 weeks", "SEO, social and performance marketing basics."),
    ("EV Technician Apprenticeship", "apprenticeship", "Ather Energy", "Electric Vehicle Technician",
     "6 months", "Paid apprenticeship servicing electric two-wheelers."),
    ("CNC Machining Program", "apprenticeship", "TVS Training", "CNC Operator",
     "4 months", "Shop-floor CNC operation and safety."),
    ("Cloud Support Foundations", "course", "AWS re/Start", "Cloud Support",
     "10 weeks", "Cloud fundamentals and support-desk skills."),
    ("PMKVY Skill Grant", "scheme", "Govt of India", "Data Analysis",
     "Varies", "Government skilling scheme with stipend support."),
    ("Advanced Excel for Analysts", "course", "NSDC", "Excel Advanced",
     "4 weeks", "Pivot tables, Power Query and dashboarding."),
]


def seed():
    reset_db()
    db = SessionLocal()

    # Skills
    skill_by_name = {}
    for name, cat in SKILLS:
        s = Skill(name=name, category=cat)
        db.add(s)
        skill_by_name[name] = s
    db.flush()

    # Primary constituency (deck page 7 headline figures)
    velachery = Constituency(
        name="Velachery", district="Chennai", state="Tamil Nadu", is_primary=True,
        total_youth=45000, registered_seekers=18500, active_recruiters=650,
        training_enrolled=7850, placed_candidates=9800,
        placement_rate=53.0, employment_score=87.0,
    )
    db.add(velachery)
    db.flush()

    for name, reg, placed, rate in COMPARISON:
        db.add(Constituency(
            name=name, district="Chennai", state="Tamil Nadu",
            registered_seekers=reg, placed_candidates=placed,
            placement_rate=float(rate),
            total_youth=int(reg * 2.4), training_enrolled=int(reg * 0.4),
            active_recruiters=int(reg * 0.03), employment_score=float(rate + 30),
        ))

    # Skill demand for Velachery
    for name, weight in DEMAND.items():
        if name in skill_by_name:
            db.add(SkillDemand(constituency_id=velachery.id,
                               skill_id=skill_by_name[name].id,
                               demand_weight=float(weight)))
            growth = 1.18 if weight >= 8 else 1.10 if weight >= 6 else 1.04
            db.add(DemandForecast(
                constituency_id=velachery.id,
                skill_id=skill_by_name[name].id,
                current_demand=float(weight),
                forecast_6m=round(weight * growth, 1),
                trend="rising" if growth >= 1.10 else "stable",
                shortage_roles=max(2, round(weight * growth * 3)),
            ))

    # Monthly placement trend
    for i, (month, val) in enumerate(MONTHLY):
        db.add(MonthlyPlacement(constituency_id=velachery.id, month=month,
                                order_index=i, placements=val))

    # Training catalog — seeded programs are already verified (live to youth).
    for title, ptype, provider, target, duration, desc in TRAINING:
        db.add(TrainingProgram(
            title=title, program_type=ptype, provider=provider,
            target_skill_id=skill_by_name[target].id if target in skill_by_name else None,
            duration=duration, description=desc, verification_status="verified",
        ))
    db.flush()

    # Complementary public platforms: adapter-ready until official API access is granted.
    for platform, capability, url in [
        ("Tamil Nadu Employment & Training", "District centres, registration, job fairs", "https://tnvelaivaaippu.gov.in/activities.html"),
        ("Naan Mudhalvan", "Industry courses, mentors, internships, apprenticeships", "https://www.naanmudhalvan.tn.gov.in/internships/"),
        ("National Career Service", "National vacancies, counsellors, career centres", "https://www.ncs.gov.in/Pages/about-us.aspx"),
        ("Skill India Digital Hub", "Digital courses, credentials, jobs, entrepreneurship", "https://www.skillindiadigital.gov.in/about-us"),
    ]:
        db.add(IntegrationStatus(
            platform=platform, capability=capability, status="adapter_ready",
            mode="official_link", official_url=url,
        ))

    for name, expertise, organisation, rural in [
        ("Meena Krishnan", "IT & Data Careers", "Zoho Alumni Network", False),
        ("Senthil Kumar", "Manufacturing & Apprenticeships", "TVS Skills", True),
        ("Farzana Begum", "Women Entrepreneurship", "Tamil Nadu Startup Hub", True),
        ("Arun Prasad", "Banking, Accounts & GST", "MSME Mentor Forum", False),
    ]:
        db.add(Mentor(
            name=name, expertise=expertise, organisation=organisation,
            district="Chennai", languages="Tamil, English", rural_support=rural,
        ))

    for item in [
        dict(title="Rural EV Service Apprenticeship", category="apprenticeship", provider="Ather Rural Service Network", district="Chengalpattu", skill_names="Electric Vehicle Technician, Customer Service", income_min=9000, income_max=14000, rural_friendly=True, safeguards="Verified employer, written stipend, PPE and insurance required", finance_guidance="Stipend budgeting and tool-purchase guidance", market_access="Service-centre placement network"),
        dict(title="Women-led Food Enterprise Accelerator", category="startup", provider="TN Women Development Corporation", district="Chennai", skill_names="Sales, Digital Marketing", income_min=15000, income_max=45000, rural_friendly=True, women_focused=True, safeguards="No upfront agent fee; verify loan and subsidy terms", finance_guidance="Udyam, GST, credit, insurance and cash-flow coaching", market_access="SHG fairs and digital commerce onboarding"),
        dict(title="Local Bookkeeping Micro-business", category="self_employment", provider="MSME Service Desk", district="Chennai", skill_names="Tally, GST Filing, Excel", income_min=12000, income_max=35000, remote_allowed=True, rural_friendly=True, safeguards="Client agreement, data privacy and professional indemnity guidance", finance_guidance="Pricing, invoicing, tax and emergency-fund guidance", market_access="Verified MSME client referrals"),
        dict(title="Verified Tamil Digital Support Gigs", category="gig", provider="NCS Local Partner", district="Tamil Nadu", skill_names="Communication, MS Office, Customer Service", income_min=8000, income_max=22000, remote_allowed=True, rural_friendly=True, safeguards="Platform verification, transparent commission, accident cover and grievance channel", finance_guidance="Income tracking, insurance and tax basics", market_access="Verified task marketplace"),
        dict(title="District Job Fair - Operations Roles", category="rural_job", provider="TN Employment Department", district="Kancheepuram", skill_names="Communication, CNC Operator, Customer Service", income_min=18000, income_max=30000, rural_friendly=True, safeguards="Government-facilitated employer verification and zero recruitment fee", market_access="District career centre and job fair"),
        dict(title="Data Analyst Employer Project", category="internship", provider="Zoho Corporation", district="Chennai", skill_names="Data Analysis, SQL, Power BI", income_min=10000, income_max=18000, remote_allowed=True, safeguards="Defined project scope, mentor, stipend and completion certificate", market_access="Interview pathway for successful projects"),
    ]:
        db.add(EmploymentOpportunity(
            description="Verified pathway with practical experience and outcome tracking.",
            verification_status="verified", **item,
        ))

    # --- Admin (MLA) ---
    db.add(User(phone="9000000001", email="mla@jobnadu.demo", name="Admin", role="admin", password_hash=hash_password("demo123")))

    # --- Training provider (separate portal) + pending submissions to verify ---
    provider = User(phone="9000000007", email="skills@jobnadu.demo", name="Velachery Skill Centre", role="provider", password_hash=hash_password("demo123"))
    db.add(provider)
    db.flush()
    for title, ptype, target, duration, desc in [
        ("Full-Stack Web Development", "course", "Python", "12 weeks",
         "MERN-stack development with live projects."),
        ("Advanced SQL for Analysts", "certification", "SQL", "6 weeks",
         "Query optimisation and reporting for data roles."),
    ]:
        db.add(TrainingProgram(
            title=title, program_type=ptype, provider="Velachery Skill Centre",
            target_skill_id=skill_by_name[target].id if target in skill_by_name else None,
            duration=duration, description=desc,
            verification_status="pending", submitted_by_user_id=provider.id,
        ))
    db.flush()

    # --- Recruiters & jobs ---
    orgs_spec = [
        ("Zoho Corporation", "IT Services", "9000000002",
         [("Data Analyst", 1, 35000, 55000, "Graduate",
           [("Data Analysis", 1.5), ("Excel Advanced", 1.2), ("SQL", 1.0), ("Power BI", 1.0)]),
          ("Cloud Support Engineer", 1, 30000, 50000, "Graduate",
           [("Cloud Support", 1.5), ("Communication", 0.8), ("Python", 0.8)])]),
        ("Chennai Fintech Pvt Ltd", "Finance", "9000000004",
         [("Accounts Executive", 1, 22000, 35000, "Graduate",
           [("Tally Prime", 1.5), ("GST Filing", 1.4), ("Excel", 1.0), ("Basic Accounting", 1.0)]),
          ("GST Compliance Associate", 2, 28000, 42000, "Graduate",
           [("GST Filing", 1.6), ("Tally", 1.2), ("Communication", 0.7)])]),
        ("Ather Energy", "EV Manufacturing", "9000000005",
         [("EV Service Technician", 0, 20000, 32000, "Diploma",
           [("Electric Vehicle Technician", 1.8), ("CNC Operator", 0.9)]),
          ("Production Associate", 0, 18000, 28000, "12th Pass",
           [("CNC Operator", 1.5), ("Communication", 0.6)])]),
        ("BrightReach Marketing", "Marketing", "9000000006",
         [("Digital Marketing Executive", 1, 25000, 40000, "Graduate",
           [("Digital Marketing", 1.6), ("Communication", 1.0), ("Data Analytics", 0.9)])]),
    ]

    # Most employers verified; one left pending for the admin verification demo.
    org_status = {
        "Zoho Corporation": "verified",
        "Chennai Fintech Pvt Ltd": "verified",
        "Ather Energy": "verified",
        "BrightReach Marketing": "pending",
    }

    orgs = {}
    jobs = []
    for org_name, industry, phone, job_specs in orgs_spec:
        org = RecruiterOrg(name=org_name, industry=industry,
                           constituency_id=velachery.id,
                           verification_status=org_status.get(org_name, "pending"),
                           about=f"{org_name} hiring local talent in Velachery.")
        db.add(org)
        db.flush()
        orgs[org_name] = org
        # first recruiter phone gets a login account
        email_local = {
            "Zoho Corporation": "zoho@jobnadu.demo",
            "Chennai Fintech Pvt Ltd": "fintech@jobnadu.demo",
            "Ather Energy": "ather@jobnadu.demo",
            "BrightReach Marketing": "brightreach@jobnadu.demo",
        }.get(org_name, f"{org_name.split()[0].lower()}@jobnadu.demo")
        db.add(User(phone=phone, email=email_local, name=f"{org_name} Recruiter",
                    role="recruiter", recruiter_org_id=org.id, password_hash=hash_password("demo123")))
        for title, min_exp, smin, smax, edu, skills in job_specs:
            job = Job(org_id=org.id, title=title, constituency_id=velachery.id,
                      location="Velachery, Chennai", min_experience=float(min_exp),
                      salary_min=smin, salary_max=smax, education_required=edu,
                      description=(f"{org_name} is hiring a {title}. Responsibilities include "
                                   f"day-to-day {title.lower()} duties. Local candidates from "
                                   f"Velachery preferred. Immediate joining."),
                      jd_filename=f"{title.replace(' ', '_')}_JD.pdf",
                      status="active")
            db.add(job)
            db.flush()
            for sname, w in skills:
                if sname in skill_by_name:
                    db.add(JobSkill(job_id=job.id, skill_id=skill_by_name[sname].id,
                                    weight=w))
            jobs.append(job)
    db.flush()

    # --- Youth ---
    def make_youth(phone, name, gender, age, edu, field, inst, gyear,
                   exp_years, exp_title, exp_company, skills, has_resume=True,
                   verified="pending", status="unemployed", epic=None, password="demo123"):
        u = User(phone=phone, name=name, role="youth", password_hash=hash_password(password))
        db.add(u)
        db.flush()
        p = YouthProfile(
            user_id=u.id, constituency_id=velachery.id, gender=gender, age=age,
            education_level=edu, education_field=field, institution=inst,
            graduation_year=gyear, experience_years=exp_years,
            experience_title=exp_title, experience_company=exp_company,
            resume_filename=f"{name.split()[0]}_Resume.pdf" if has_resume else None,
            verification_status=verified, epic_verified=(verified == "verified"),
            epic_number=epic, employment_status=status, onboarding_complete=True,
            rural_resident=random.random() < 0.28,
            differently_abled=random.random() < 0.06,
            assisted_access=random.random() < 0.22,
            preferred_language=random.choice(["Tamil", "English"]),
            mobility_preference=random.choice(["Within district", "Within Tamil Nadu", "Remote"]),
            expected_salary=random.choice([18000, 22000, 28000, 35000]),
        )
        db.add(p)
        db.flush()
        for sname in skills:
            if sname in skill_by_name:
                db.add(YouthSkill(youth_id=p.id, skill_id=skill_by_name[sname].id,
                                  level=random.randint(3, 5)))
        db.flush()
        db.refresh(p)
        services.recompute_employability(db, p)
        return p

    # Featured youth from the deck (page 4 + page 6 candidates)
    karthik = make_youth(
        "9000000003", "Karthik R", "Male", 24, "Graduate", "B.Com (General)",
        "University of Madras", 2021, 1.5, "Sales Executive", "ABC Pvt Ltd",
        ["MS Office", "Excel", "Tally", "Communication", "GST Basics"],
        verified="verified", epic="TNXX1234567")
    arun = make_youth(
        "9000000010", "Arun Kumar", "Male", 25, "Graduate", "B.Com",
        "Loyola College", 2020, 2.5, "Accounts Assistant", "SRV Traders",
        ["Tally Prime", "GST Filing", "Excel Advanced", "MS Office"],
        verified="verified")
    priya = make_youth(
        "9000000011", "Priya Sharma", "Female", 23, "Graduate", "BBA",
        "Ethiraj College", 2022, 3.0, "Marketing Associate", "AdWorks",
        ["Excel Advanced", "Power BI", "Communication", "Digital Marketing"],
        verified="verified")
    vignesh = make_youth(
        "9000000012", "Vignesh R", "Male", 26, "Graduate", "B.Sc (CS)",
        "MCC", 2019, 1.8, "Junior Developer", "InfoEdge",
        ["Python", "SQL", "Data Analysis", "Data Analytics"],
        verified="verified")
    kavya = make_youth(
        "9000000013", "Kavya S", "Female", 22, "Graduate", "M.Com",
        "Stella Maris", 2023, 2.0, "Accounts Trainee", "FinServe",
        ["Tally", "GST Filing", "Basic Accounting", "Excel"],
        verified="pending")
    featured = [karthik, arun, priya, vignesh, kavya]

    # Generated youth to fill demographics/charts
    first_m = ["Suresh", "Ramesh", "Ajay", "Manoj", "Naveen", "Dinesh", "Hari",
               "Bala", "Vijay", "Gokul", "Aravind", "Prakash"]
    first_f = ["Divya", "Sneha", "Lakshmi", "Nithya", "Anitha", "Deepa", "Revathi",
               "Swathi", "Meena", "Janani", "Keerthi", "Pooja"]
    last = ["Kumar", "R", "S", "Raj", "Murthy", "Devi", "Nair", "Iyer", "Menon"]
    edus = ["Below 12th", "12th Pass", "Diploma", "Graduate", "Post Graduate"]
    all_skill_names = [s[0] for s in SKILLS]

    phone_seq = 9000001000
    for i in range(45):
        gender = random.choice(["Male", "Female"])
        fname = random.choice(first_m if gender == "Male" else first_f)
        name = f"{fname} {random.choice(last)}"
        age = random.randint(18, 34)
        edu = random.choices(edus, weights=[10, 12, 23, 44, 15])[0]
        exp = round(random.choice([0, 0, 0.5, 1, 1.5, 2, 3]), 1)
        nskills = random.randint(2, 5)
        skills = random.sample(all_skill_names, nskills)
        status = random.choices(["unemployed", "in_training", "employed"],
                                weights=[50, 25, 25])[0]
        make_youth(str(phone_seq + i), name, gender, age, edu,
                   random.choice(["B.Com", "B.Sc", "BBA", "Diploma", "B.A"]),
                   random.choice(["University of Madras", "Anna University", "Local College"]),
                   random.randint(2018, 2024), exp,
                   random.choice(["Trainee", "Associate", "Assistant", None]),
                   random.choice(["Local Firm", "SME", None]),
                   skills,
                   has_resume=random.random() > 0.2,
                   verified=random.choices(["verified", "pending", "unverified"],
                                           weights=[40, 30, 30])[0],
                   status=status)

    # Guidance, mentor, rural/startup pathways, and automated reminders.
    db.add(CareerAssessment(
        youth_id=karthik.id,
        aptitude_area="Commercial analysis",
        interests="Accounting, customer operations, small business",
        preferred_sectors="Finance, MSME services",
        mobility="Within Tamil Nadu",
        wage_expectation=28000,
        entrepreneurship_interest=True,
        career_plan_completed=True,
        referral_accepted=True,
        suitability_score=86,
    ))
    mentors = db.query(Mentor).order_by(Mentor.id).all()
    db.add(Mentorship(
        youth_id=karthik.id, mentor_id=mentors[3].id, status="active",
        goal="Build a GST and bookkeeping career pathway",
        next_session_at=datetime.utcnow() + timedelta(days=6),
    ))
    opportunities = db.query(EmploymentOpportunity).order_by(EmploymentOpportunity.id).all()
    db.add(OpportunityApplication(
        youth_id=priya.id, opportunity_id=opportunities[1].id,
        status="completed", monthly_income=24000,
    ))
    db.add(OpportunityApplication(
        youth_id=karthik.id, opportunity_id=opportunities[2].id,
        status="referred",
    ))
    db.add(Reminder(
        user_id=karthik.user_id,
        title="Complete MSME bookkeeping referral",
        message="Review pricing, tax, insurance, and verified client terms.",
        reminder_type="entrepreneurship",
        due_at=datetime.utcnow() + timedelta(days=2),
        action_url="/youth/pathway",
    ))

    db.commit()

    # --- Applications / hiring pipeline (populate recruiter + youth views) ---
    all_youth = db.query(YouthProfile).all()
    stages = ["applied", "shortlisted", "interview", "selected", "joined"]

    # Featured candidates apply to relevant jobs, spread across stages.
    def apply(youth, job, stage):
        existing = (db.query(Application)
                    .filter(Application.job_id == job.id,
                            Application.youth_id == youth.id).first())
        if existing:
            return
        a = Application(job_id=job.id, youth_id=youth.id, stage=stage,
                        match_score=services.match_youth_to_job(youth, job),
                        created_at=datetime.utcnow() - timedelta(days=random.randint(1, 40)))
        db.add(a)
        if stage == "interview":
            db.flush()
            db.add(Interview(application_id=a.id,
                             scheduled_at=datetime.utcnow() + timedelta(days=3),
                             mode="In-person", notes="Bring original certificates."))
        if stage == "joined":
            youth.employment_status = "employed"
            db.flush()
            starting_salary = job.salary_min or random.randint(18000, 32000)
            months = random.choice([3, 6, 12])
            db.add(PlacementOutcome(
                application_id=a.id,
                joined_at=a.created_at + timedelta(days=random.randint(7, 28)),
                starting_salary=starting_salary,
                current_salary=round(starting_salary * random.uniform(1.0, 1.18)),
                employment_type=random.choice(["permanent", "contract", "apprenticeship"]),
                has_formal_benefits=random.random() < 0.72,
                role_skill_match=random.randint(3, 5),
                candidate_satisfaction=random.randint(3, 5),
                employer_satisfaction=random.randint(3, 5),
                retained_3m=True if months >= 3 else None,
                retained_6m=True if months >= 6 else None,
                retained_12m=True if months >= 12 else None,
                last_checkin_at=datetime.utcnow(),
            ))

    job_by_title = {j.title: j for j in jobs}
    apply(arun, job_by_title["Accounts Executive"], "selected")
    apply(kavya, job_by_title["GST Compliance Associate"], "interview")
    apply(priya, job_by_title["Digital Marketing Executive"], "shortlisted")
    apply(vignesh, job_by_title["Data Analyst"], "interview")
    # Karthik has a pending offer (selected) he can accept/decline, plus one applied.
    apply(karthik, job_by_title["Accounts Executive"], "selected")
    apply(karthik, job_by_title["Data Analyst"], "applied")

    # Scatter generated youth across jobs and stages for a lively pipeline.
    for youth in all_youth:
        if youth in featured:
            continue
        for job in random.sample(jobs, k=random.randint(0, 2)):
            match = services.match_youth_to_job(youth, job)
            if match >= 55:
                apply(youth, job, random.choices(stages, weights=[40, 25, 15, 10, 10])[0])

    # Training is measured through completion, assessment, and practical exposure.
    verified_programs = (
        db.query(TrainingProgram)
        .filter(TrainingProgram.verification_status == "verified")
        .all()
    )
    for youth in random.sample(all_youth, k=min(24, len(all_youth))):
        program = random.choice(verified_programs)
        completed = random.random() < 0.68
        practical = program.program_type == "apprenticeship" or random.random() < 0.6
        db.add(TrainingEnrollment(
            youth_id=youth.id,
            program_id=program.id,
            status="completed" if completed else "in_progress",
            enrolled_at=datetime.utcnow() - timedelta(days=random.randint(20, 120)),
            completed_at=(datetime.utcnow() - timedelta(days=random.randint(1, 18)))
            if completed else None,
            assessment_score=random.randint(62, 94) if completed else None,
            practical_component=practical,
            work_experience_kind=(
                "apprenticeship" if program.program_type == "apprenticeship"
                else random.choice(["project", "internship", "simulation"])
            ) if practical else None,
            stipend_amount=random.choice([5000, 8000, 10000])
            if program.program_type == "apprenticeship" else None,
            provider_rating=random.randint(3, 5) if completed else None,
        ))

    db.commit()
    db.close()
    print("Seed complete. Demo logins:")
    print("  MLA/Admin  -> 9000000001")
    print("  Recruiter  -> 9000000002 (Zoho)")
    print("  Youth      -> 9000000003 (Karthik R)")


if __name__ == "__main__":
    seed()
