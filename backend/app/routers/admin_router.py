"""MLA / Admin portal: constituency dashboard, verification queue, catalog admin."""
from collections import Counter
from datetime import datetime
from statistics import mean, median

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import require_role
from ..database import get_db
from ..models import (
    Application,
    CandidateDocument,
    CareerAssessment,
    Constituency,
    Job,
    MonthlyPlacement,
    Mentorship,
    OpportunityApplication,
    PlacementOutcome,
    PlacementCommission,
    RecruiterOrg,
    Reminder,
    Skill,
    SkillDemand,
    TrainingProgram,
    TrainingEnrollment,
    User,
    YouthProfile,
    YouthSkill,
)
from ..scoring import band_for_score
from ..schemas import (
    CompanyHireRow,
    CandidateDocumentOut,
    CommissionStatusIn,
    DocumentVerificationIn,
    ConstituencyComparison,
    KpiTiles,
    MlaDashboardOut,
    NameValue,
    OutcomeDashboardOut,
    PipelineFunnel,
    PlacementRow,
    PlacementCommissionIn,
    PlacementCommissionOut,
    RecruiterOrgOut,
    TrainingProgramOut,
    YouthVoterLinkOut,
    YouthProfileOut,
)
from ..voters import VoterConfigError, VoterLookupError, find_voter_by_id_code

router = APIRouter(prefix="/api/admin", tags=["admin"])

AGE_BUCKETS = [("18-21", 18, 21), ("22-25", 22, 25), ("26-30", 26, 30), ("31+", 31, 200)]


def _document_out(row: CandidateDocument) -> CandidateDocumentOut:
    out = CandidateDocumentOut.model_validate(row)
    out.youth_name = row.youth.user.name if row.youth and row.youth.user else ""
    return out


def _commission_out(row: PlacementCommission) -> PlacementCommissionOut:
    out = PlacementCommissionOut.model_validate(row)
    app = row.application
    out.youth_name = app.youth.user.name if app and app.youth and app.youth.user else ""
    out.job_title = app.job.title if app and app.job else ""
    out.company = app.job.org.name if app and app.job and app.job.org else ""
    return out


def _primary_constituency(db: Session) -> Constituency:
    c = db.query(Constituency).filter(Constituency.is_primary == True).first()  # noqa
    if c is None:
        c = db.query(Constituency).first()
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No constituency configured")
    return c


@router.get("/dashboard", response_model=MlaDashboardOut)
def mla_dashboard(user: User = Depends(require_role("admin")),
                  db: Session = Depends(get_db)):
    c = _primary_constituency(db)

    # Headline KPIs mirror the deck (official aggregates stored on the constituency).
    kpis = KpiTiles(
        total_youth=c.total_youth,
        registered_seekers=c.registered_seekers,
        active_recruiters=c.active_recruiters,
        training_enrolled=c.training_enrolled,
        placed_candidates=c.placed_candidates,
        placement_rate=c.placement_rate,
    )

    # Employment-status donut (deck: Employed 53 / Unemployed 26 / In-training 21).
    placed = c.placed_candidates
    training = c.training_enrolled
    seekers = c.registered_seekers or 1
    unemployed = max(seekers - placed - training, 0)
    employment_status = [
        NameValue(name="Employed", value=placed),
        NameValue(name="Unemployed", value=unemployed),
        NameValue(name="In Training", value=training),
    ]

    # Pipeline funnel (deck numbers).
    pipeline = PipelineFunnel(
        registered=c.registered_seekers,
        shortlisted=int(c.registered_seekers * 0.34),
        interviews=int(c.registered_seekers * 0.186),
        selected=int(c.registered_seekers * 0.122),
        joined=c.placed_candidates and int(c.placed_candidates * 0.202) or 0,
    )

    monthly = (
        db.query(MonthlyPlacement)
        .filter(MonthlyPlacement.constituency_id == c.id)
        .order_by(MonthlyPlacement.order_index)
        .all()
    )
    monthly_placements = [NameValue(name=m.month, value=m.placements) for m in monthly]

    # Top skill demand (from seeded SkillDemand weights).
    demands = (
        db.query(SkillDemand, Skill)
        .join(Skill, SkillDemand.skill_id == Skill.id)
        .filter(SkillDemand.constituency_id == c.id)
        .order_by(SkillDemand.demand_weight.desc())
        .limit(5)
        .all()
    )
    top_skill_demand = [NameValue(name=s.name, value=d.demand_weight)
                        for d, s in demands]

    # Demographics from live youth rows (fallback to deck ratios if sparse).
    youths = db.query(YouthProfile).filter(
        YouthProfile.constituency_id == c.id).all()

    def _demo_from_ratio(ratios: dict[str, float]) -> list[NameValue]:
        return [NameValue(name=k, value=round(v * 100)) for k, v in ratios.items()]

    if len(youths) >= 10:
        gender_counts = Counter(y.gender or "Other" for y in youths)
        gender = [NameValue(name=k, value=v) for k, v in gender_counts.items()]
        age_counts = Counter()
        for y in youths:
            for label, lo, hi in AGE_BUCKETS:
                if y.age and lo <= y.age <= hi:
                    age_counts[label] += 1
                    break
        age_group = [NameValue(name=label, value=age_counts.get(label, 0))
                     for label, _, _ in AGE_BUCKETS]
        edu_counts = Counter(y.education_level or "Other" for y in youths)
        education_level = [NameValue(name=k, value=v) for k, v in edu_counts.items()]
    else:
        gender = _demo_from_ratio({"Male": 0.59, "Female": 0.41})
        age_group = _demo_from_ratio({"18-21": 0.20, "22-25": 0.35,
                                      "26-30": 0.25, "31+": 0.20})
        education_level = _demo_from_ratio({"Below 12th": 0.18, "Diploma": 0.23,
                                            "Graduate": 0.44, "Post Graduate": 0.15})

    comparison = []
    for oc in db.query(Constituency).all():
        comparison.append(ConstituencyComparison(
            name=("Your Constituency" if oc.is_primary else oc.name),
            registered_youth=oc.registered_seekers,
            placed_candidates=oc.placed_candidates,
            placement_rate=oc.placement_rate,
            is_yours=oc.is_primary,
        ))
    comparison.sort(key=lambda x: (not x.is_yours, x.name))

    return MlaDashboardOut(
        constituency_name=c.name,
        kpis=kpis,
        employment_score=c.employment_score,
        employment_score_band=band_for_score(c.employment_score),
        pipeline=pipeline,
        employment_status=employment_status,
        monthly_placements=monthly_placements,
        top_skill_demand=top_skill_demand,
        gender=gender,
        age_group=age_group,
        education_level=education_level,
        comparison=comparison,
    )


def _average(values: list[float]) -> float:
    return round(mean(values), 1) if values else 0.0


def _percentage(values: list[bool]) -> float:
    return round(100 * sum(values) / len(values), 1) if values else 0.0


@router.get("/outcomes", response_model=OutcomeDashboardOut)
def outcome_dashboard(user: User = Depends(require_role("admin")),
                      db: Session = Depends(get_db)):
    """Measure quality and sustainability beyond registrations and offer letters."""
    constituency = _primary_constituency(db)
    applications = (
        db.query(Application)
        .join(YouthProfile, Application.youth_id == YouthProfile.id)
        .filter(YouthProfile.constituency_id == constituency.id)
        .all()
    )
    joined = [app for app in applications if app.stage == "joined"]
    decisions = [
        app for app in applications if app.stage in {"selected", "joined", "declined"}
    ]
    outcomes = [app.placement_outcome for app in joined if app.placement_outcome]

    starting_salaries = [o.starting_salary for o in outcomes if o.starting_salary]
    wage_growth = [
        100 * (o.current_salary - o.starting_salary) / o.starting_salary
        for o in outcomes if o.starting_salary and o.current_salary
    ]
    time_to_placement = [
        max(0.0, (o.joined_at - app.created_at).total_seconds() / 86400)
        for app in joined for o in [app.placement_outcome] if o and o.joined_at
    ]

    enrollments = (
        db.query(TrainingEnrollment)
        .join(YouthProfile, TrainingEnrollment.youth_id == YouthProfile.id)
        .filter(YouthProfile.constituency_id == constituency.id)
        .all()
    )
    completed = [row for row in enrollments if row.status == "completed"]
    women_placements = [
        app for app in joined if (app.youth.gender or "").lower() == "female"
    ]
    active_youth = db.query(YouthProfile).filter(
        YouthProfile.constituency_id == constituency.id,
        YouthProfile.onboarding_complete == True,  # noqa
    ).all()
    completed_opportunities = db.query(OpportunityApplication).filter(
        OpportunityApplication.status == "completed"
    ).all()
    entrepreneurship_created = sum(
        bool(row.opportunity and row.opportunity.category in {"startup", "self_employment"})
        for row in completed_opportunities
    )
    interviewed = sum(app.stage in {"interview", "selected", "joined"} for app in applications)
    application_age = [
        max(0.0, (app.updated_at - app.created_at).total_seconds() / 86400)
        for app in applications if app.stage != "applied"
    ]
    role_matches = [o.role_skill_match for o in outcomes if o.role_skill_match]
    reminder_rows = db.query(Reminder).all()

    return OutcomeDashboardOut(
        placements=len(joined),
        joining_rate=round(100 * len(joined) / len(decisions), 1) if decisions else 0.0,
        median_starting_salary=round(float(median(starting_salaries)), 1)
        if starting_salaries else 0.0,
        average_wage_growth=_average(wage_growth),
        average_time_to_placement_days=_average(time_to_placement),
        role_skill_match=_average([o.role_skill_match for o in outcomes if o.role_skill_match]),
        formal_benefits_coverage=_percentage([
            o.has_formal_benefits for o in outcomes if o.has_formal_benefits is not None
        ]),
        candidate_satisfaction=_average([
            o.candidate_satisfaction for o in outcomes if o.candidate_satisfaction
        ]),
        employer_satisfaction=_average([
            o.employer_satisfaction for o in outcomes if o.employer_satisfaction
        ]),
        retention_3m=_percentage([o.retained_3m for o in outcomes if o.retained_3m is not None]),
        retention_6m=_percentage([o.retained_6m for o in outcomes if o.retained_6m is not None]),
        retention_12m=_percentage([
            o.retained_12m for o in outcomes if o.retained_12m is not None
        ]),
        training_enrollments=len(enrollments),
        training_completion_rate=round(100 * len(completed) / len(enrollments), 1)
        if enrollments else 0.0,
        average_assessment_score=_average([
            row.assessment_score for row in completed if row.assessment_score is not None
        ]),
        work_based_learning_share=_percentage([
            row.practical_component for row in enrollments
        ]),
        women_placement_share=round(100 * len(women_placements) / len(joined), 1)
        if joined else 0.0,
        registration_conversion=round(
            100 * constituency.registered_seekers / constituency.total_youth, 1
        ) if constituency.total_youth else 0.0,
        average_salary=_average([
            float(o.current_salary or o.starting_salary)
            for o in outcomes if o.current_salary or o.starting_salary
        ]),
        interview_conversion=round(100 * interviewed / len(applications), 1)
        if applications else 0.0,
        employer_response_days=_average(application_age),
        entrepreneurship_created=entrepreneurship_created,
        rural_coverage=_percentage([bool(row.rural_resident) for row in active_youth]),
        assisted_access_share=_percentage([bool(row.assisted_access) for row in active_youth]),
        differently_abled_participation=_percentage([
            bool(row.differently_abled) for row in active_youth
        ]),
        skill_mismatch_rate=round(100 - (_average(role_matches) / 5 * 100), 1)
        if role_matches else 0.0,
        active_mentorships=db.query(Mentorship).filter(Mentorship.status == "active").count(),
        reminder_completion_rate=_percentage([row.is_read for row in reminder_rows]),
    )


# --- verification queue ------------------------------------------------------

@router.get("/verification-queue", response_model=list[YouthProfileOut])
def verification_queue(user: User = Depends(require_role("admin")),
                       db: Session = Depends(get_db)):
    profiles = (
        db.query(YouthProfile)
        .filter(YouthProfile.verification_status == "pending")
        .all()
    )
    out = []
    for p in profiles:
        item = YouthProfileOut.model_validate(p)
        item.name = p.user.name if p.user else ""
        item.constituency_name = p.constituency.name if p.constituency else None
        item.employability_band = band_for_score(p.employability_score)
        item.skills = [{"skill_id": ys.skill_id, "level": ys.level,
                        "name": ys.skill.name if ys.skill else ""} for ys in p.skills]
        out.append(item)
    return out


@router.get("/documents", response_model=list[CandidateDocumentOut])
def pending_documents(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    rows = db.query(CandidateDocument).filter(CandidateDocument.verification_status == "pending").order_by(CandidateDocument.created_at.desc()).all()
    return [_document_out(row) for row in rows]


@router.patch("/documents/{document_id}/verify", response_model=CandidateDocumentOut)
def verify_document(document_id: int, body: DocumentVerificationIn,
                    user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    row = db.get(CandidateDocument, document_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    row.verification_status = "verified" if body.approve else "rejected"
    row.reviewer_notes = body.reviewer_notes
    row.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _document_out(row)


@router.get("/commissions", response_model=list[PlacementCommissionOut])
def commissions(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    rows = db.query(PlacementCommission).order_by(PlacementCommission.issued_at.desc()).all()
    return [_commission_out(row) for row in rows]


@router.post("/commissions", response_model=PlacementCommissionOut, status_code=status.HTTP_201_CREATED)
def create_commission(body: PlacementCommissionIn, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    app = db.get(Application, body.application_id)
    if app is None or app.job is None or app.stage not in {"selected", "joined"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose a selected or joined placement")
    if app.commission:
        raise HTTPException(status.HTTP_409_CONFLICT, "Invoice already exists for this placement")
    if body.fee_amount < 0 or body.tax_amount < 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Amounts cannot be negative")
    row = PlacementCommission(application_id=app.id, org_id=app.job.org_id,
                              invoice_number=f"JNC-{datetime.utcnow():%Y%m%d}-{app.id:04d}",
                              fee_amount=body.fee_amount, tax_amount=body.tax_amount,
                              payment_status="invoiced", notes=body.notes)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _commission_out(row)


@router.patch("/commissions/{commission_id}", response_model=PlacementCommissionOut)
def update_commission(commission_id: int, body: CommissionStatusIn,
                      user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    if body.payment_status not in {"pending", "invoiced", "part_paid", "paid", "waived"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid payment status")
    row = db.get(PlacementCommission, commission_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    row.payment_status = body.payment_status
    row.notes = body.notes if body.notes is not None else row.notes
    row.paid_at = datetime.utcnow() if body.payment_status == "paid" else None
    db.commit()
    db.refresh(row)
    return _commission_out(row)


@router.patch("/youth/{youth_id}/verify", response_model=YouthProfileOut)
def verify_youth(youth_id: int, approve: bool = True,
                 user: User = Depends(require_role("admin")),
                 db: Session = Depends(get_db)):
    p = db.get(YouthProfile, youth_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Youth not found")
    p.verification_status = "verified" if approve else "unverified"
    p.epic_verified = approve
    db.commit()
    db.refresh(p)
    item = YouthProfileOut.model_validate(p)
    item.name = p.user.name if p.user else ""
    return item


# --- training verification (admin verifies; providers submit) ----------------

def _training_out(db: Session, t: TrainingProgram) -> TrainingProgramOut:
    out = TrainingProgramOut.model_validate(t)
    if t.target_skill_id:
        s = db.get(Skill, t.target_skill_id)
        out.target_skill_name = s.name if s else None
    return out


@router.get("/training", response_model=list[TrainingProgramOut])
def list_training(user: User = Depends(require_role("admin")),
                  db: Session = Depends(get_db),
                  status_filter: str | None = None):
    q = db.query(TrainingProgram)
    if status_filter:
        q = q.filter(TrainingProgram.verification_status == status_filter)
    return [_training_out(db, t) for t in q.order_by(TrainingProgram.id.desc()).all()]


@router.patch("/training/{program_id}/verify", response_model=TrainingProgramOut)
def verify_training(program_id: int, approve: bool = True,
                    user: User = Depends(require_role("admin")),
                    db: Session = Depends(get_db)):
    t = db.get(TrainingProgram, program_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
    t.verification_status = "verified" if approve else "rejected"
    db.commit()
    db.refresh(t)
    return _training_out(db, t)


# --- company (employer) verification -----------------------------------------

def _org_out(db: Session, org: RecruiterOrg) -> RecruiterOrgOut:
    job_ids = [j.id for j in org.jobs]
    hired = (
        db.query(Application)
        .filter(Application.job_id.in_(job_ids), Application.stage == "joined")
        .count()
        if job_ids else 0
    )
    out = RecruiterOrgOut.model_validate(org)
    out.job_count = sum(1 for j in org.jobs if j.status == "active")
    out.hired_count = hired
    out.constituency_name = org.constituency.name if getattr(org, "constituency", None) else None
    return out


@router.get("/companies", response_model=list[RecruiterOrgOut])
def list_companies(user: User = Depends(require_role("admin")),
                   db: Session = Depends(get_db),
                   status_filter: str | None = None):
    q = db.query(RecruiterOrg)
    if status_filter:
        q = q.filter(RecruiterOrg.verification_status == status_filter)
    return [_org_out(db, o) for o in q.order_by(RecruiterOrg.name).all()]


@router.patch("/companies/{org_id}/verify", response_model=RecruiterOrgOut)
def verify_company(org_id: int, approve: bool = True,
                   user: User = Depends(require_role("admin")),
                   db: Session = Depends(get_db)):
    org = db.get(RecruiterOrg, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Company not found")
    org.verification_status = "verified" if approve else "unverified"
    db.commit()
    db.refresh(org)
    return _org_out(db, org)


# --- reports -----------------------------------------------------------------

@router.get("/employers", response_model=list[CompanyHireRow])
def employers_report(user: User = Depends(require_role("admin")),
                     db: Session = Depends(get_db),
                     industry: str | None = None,
                     verification_status: str | None = None):
    """Which company hired how many (plus jobs/applications). Filterable."""
    rows = []
    q = db.query(RecruiterOrg)
    if industry:
        q = q.filter(RecruiterOrg.industry == industry)
    if verification_status:
        q = q.filter(RecruiterOrg.verification_status == verification_status)
    for org in q.all():
        job_ids = [j.id for j in org.jobs]
        apps = (db.query(Application).filter(Application.job_id.in_(job_ids)).all()
                if job_ids else [])
        rows.append(CompanyHireRow(
            org_id=org.id,
            company=org.name,
            industry=org.industry,
            verification_status=org.verification_status,
            active_jobs=sum(1 for j in org.jobs if j.status == "active"),
            applications=len(apps),
            hired=sum(1 for a in apps if a.stage == "joined"),
        ))
    rows.sort(key=lambda r: r.hired, reverse=True)
    return rows


@router.get("/placements", response_model=list[PlacementRow])
def placements_report(user: User = Depends(require_role("admin")),
                      db: Session = Depends(get_db),
                      org_id: int | None = None,
                      education_level: str | None = None,
                      skill_id: int | None = None,
                      stage: str | None = None):
    """Which youth got which job. Filterable by company, education, skill, stage."""
    placed_stages = ["selected", "joined"] if not stage else [stage]
    q = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Application.stage.in_(placed_stages))
    )
    if org_id:
        q = q.filter(Job.org_id == org_id)
    apps = q.all()

    rows = []
    for a in apps:
        youth = a.youth
        if education_level and (youth.education_level != education_level):
            continue
        if skill_id and skill_id not in {ys.skill_id for ys in youth.skills}:
            continue
        rows.append(PlacementRow(
            youth_id=youth.id,
            youth_name=youth.user.name if youth.user else "",
            education_level=youth.education_level,
            job_title=a.job.title if a.job else "",
            company=a.job.org.name if a.job and a.job.org else "",
            stage=a.stage,
            match_score=a.match_score,
            updated_at=a.updated_at,
        ))
    rows.sort(key=lambda r: r.updated_at, reverse=True)
    return rows


@router.get("/youth/{youth_id}/voter-details", response_model=YouthVoterLinkOut)
def youth_voter_details(
    youth_id: int,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    youth = db.get(YouthProfile, youth_id)
    if youth is None or youth.user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Youth not found")

    voter = None
    if youth.epic_number:
        try:
            voter = find_voter_by_id_code(youth.epic_number)
        except VoterConfigError as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
        except VoterLookupError as exc:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    return YouthVoterLinkOut(
        youth_id=youth.id,
        youth_name=youth.user.name,
        youth_phone=youth.user.phone,
        epic_number=youth.epic_number,
        verification_status=youth.verification_status,
        voter=voter,
    )
