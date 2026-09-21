"""Youth portal endpoints: connected guidance, training, jobs, and retained employment."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import services
from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import (
    Application,
    CandidateDocument,
    Job,
    PlacementOutcome,
    Reminder,
    Skill,
    TrainingEnrollment,
    TrainingProgram,
    User,
    YouthProfile,
    YouthSkill,
)
from ..schemas import (
    ApplicationOut,
    CandidateDocumentIn,
    CandidateDocumentOut,
    InterviewOut,
    JobOut,
    OfferResponse,
    PlacementOutcomeOut,
    RecommendationOut,
    RetentionCheckIn,
    SkillGapOut,
    SkillOut,
    TrainingProgramOut,
    TrainingEnrollmentIn,
    TrainingEnrollmentOut,
    TrainingProgressUpdate,
    YouthProfileOut,
    YouthProfileUpdate,
)

router = APIRouter(prefix="/api/youth", tags=["youth"])


def _get_profile(db: Session, user: User) -> YouthProfile:
    profile = db.query(YouthProfile).filter(YouthProfile.user_id == user.id).first()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Youth profile not found")
    return profile


def _serialize_profile(db: Session, user: User, profile: YouthProfile) -> YouthProfileOut:
    out = YouthProfileOut.model_validate(profile)
    out.name = user.name
    out.constituency_name = profile.constituency.name if profile.constituency else None
    out.employability_band = services.employability_band(profile.employability_score)
    out.skills = [
        {"skill_id": ys.skill_id, "level": ys.level,
         "name": ys.skill.name if ys.skill else ""}
        for ys in profile.skills
    ]
    return out


def _training_out(enrollment: TrainingEnrollment) -> TrainingEnrollmentOut:
    out = TrainingEnrollmentOut.model_validate(enrollment)
    program = enrollment.program
    out.program_title = program.title if program else ""
    out.program_type = program.program_type if program else ""
    out.provider = program.provider if program else None
    out.target_skill_name = (
        program.target_skill.name if program and program.target_skill else None
    )
    return out


def _application_out(app: Application) -> ApplicationOut:
    out = ApplicationOut.model_validate(app)
    out.job_title = app.job.title if app.job else ""
    out.org_name = app.job.org.name if app.job and app.job.org else ""
    if app.interview is not None:
        out.interview = InterviewOut.model_validate(app.interview)
    if app.placement_outcome is not None:
        out.placement_outcome = PlacementOutcomeOut.model_validate(app.placement_outcome)
    return out


@router.get("/profile", response_model=YouthProfileOut)
def get_profile(user: User = Depends(require_role("youth")),
                db: Session = Depends(get_db)):
    profile = _get_profile(db, user)
    return _serialize_profile(db, user, profile)


@router.put("/profile", response_model=YouthProfileOut)
def update_profile(body: YouthProfileUpdate,
                   user: User = Depends(require_role("youth")),
                   db: Session = Depends(get_db)):
    profile = _get_profile(db, user)

    fields = body.model_dump(exclude_unset=True,
                             exclude={"skills", "consent", "complete_onboarding"})
    for key, value in fields.items():
        setattr(profile, key, value)

    if body.skills is not None:
        db.query(YouthSkill).filter(YouthSkill.youth_id == profile.id).delete()
        seen = set()
        for s in body.skills:
            if s.skill_id in seen:
                continue
            seen.add(s.skill_id)
            db.add(YouthSkill(youth_id=profile.id, skill_id=s.skill_id, level=s.level))
        db.flush()
        db.refresh(profile)

    if body.complete_onboarding:
        profile.onboarding_complete = True
        # Demo: completing onboarding grants "pending" verification.
        if profile.verification_status == "unverified":
            profile.verification_status = "pending"

    services.recompute_employability(db, profile)
    db.commit()
    db.refresh(profile)
    return _serialize_profile(db, user, profile)


@router.get("/skill-gap", response_model=SkillGapOut)
def skill_gap(user: User = Depends(require_role("youth")),
              db: Session = Depends(get_db)):
    profile = _get_profile(db, user)
    demand = services.demand_map(db, profile.constituency_id)
    have_ids = services.youth_skill_ids(profile)

    from .. import scoring
    gap_ids = scoring.skill_gap(have_ids, demand)

    skills_by_id = {s.id: s for s in db.query(Skill).all()}
    current = [skills_by_id[i] for i in have_ids if i in skills_by_id]
    demand_skills = [skills_by_id[i] for i in demand if i in skills_by_id]
    gap_skills = [skills_by_id[i] for i in gap_ids if i in skills_by_id]

    # Recommendations: training programs targeting each gap skill (top gaps first).
    recs: list[RecommendationOut] = []
    for sid in gap_ids[:6]:
        programs = (
            db.query(TrainingProgram)
            .filter(TrainingProgram.target_skill_id == sid,
                    TrainingProgram.verification_status == "verified")
            .all()
        )
        if programs:
            recs.append(RecommendationOut(
                skill_id=sid,
                skill_name=skills_by_id[sid].name if sid in skills_by_id else None,
                programs=[TrainingProgramOut.model_validate(p) for p in programs],
            ))

    return SkillGapOut(
        current_skills=[SkillOut.model_validate(s) for s in current],
        demand_skills=[SkillOut.model_validate(s) for s in demand_skills],
        gap_skills=[SkillOut.model_validate(s) for s in gap_skills],
        recommendations=recs,
    )


@router.get("/training-enrollments", response_model=list[TrainingEnrollmentOut])
def training_enrollments(user: User = Depends(require_role("youth")),
                         db: Session = Depends(get_db)):
    profile = _get_profile(db, user)
    rows = (
        db.query(TrainingEnrollment)
        .filter(TrainingEnrollment.youth_id == profile.id)
        .order_by(TrainingEnrollment.enrolled_at.desc())
        .all()
    )
    return [_training_out(row) for row in rows]


@router.post("/training-enrollments", response_model=TrainingEnrollmentOut,
             status_code=status.HTTP_201_CREATED)
def enroll_training(body: TrainingEnrollmentIn,
                    user: User = Depends(require_role("youth")),
                    db: Session = Depends(get_db)):
    profile = _get_profile(db, user)
    program = db.get(TrainingProgram, body.program_id)
    if program is None or program.verification_status != "verified":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Verified program not found")
    existing = (
        db.query(TrainingEnrollment)
        .filter(TrainingEnrollment.youth_id == profile.id,
                TrainingEnrollment.program_id == body.program_id)
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already enrolled in this program")
    row = TrainingEnrollment(
        youth_id=profile.id,
        program_id=program.id,
        status="enrolled",
        practical_component=program.program_type == "apprenticeship",
        work_experience_kind=(
            "apprenticeship" if program.program_type == "apprenticeship" else None
        ),
    )
    if profile.employment_status == "unemployed":
        profile.employment_status = "in_training"
    db.add(row)
    db.add(Reminder(
        user_id=user.id,
        title=f"Start {program.title}",
        message="Begin your verified learning plan and record the practical component.",
        reminder_type="training",
        due_at=datetime.utcnow(),
        action_url="/youth/skills",
    ))
    db.commit()
    db.refresh(row)
    return _training_out(row)


@router.patch("/training-enrollments/{enrollment_id}",
              response_model=TrainingEnrollmentOut)
def update_training_progress(enrollment_id: int, body: TrainingProgressUpdate,
                             user: User = Depends(require_role("youth")),
                             db: Session = Depends(get_db)):
    profile = _get_profile(db, user)
    row = db.get(TrainingEnrollment, enrollment_id)
    if row is None or row.youth_id != profile.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Training enrollment not found")
    if body.status is not None and body.status not in {
        "enrolled", "in_progress", "completed", "dropped"
    }:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid training status")
    if body.assessment_score is not None and not 0 <= body.assessment_score <= 100:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Assessment score must be between 0 and 100")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    if body.status == "completed":
        row.completed_at = datetime.utcnow()
        target_skill_id = row.program.target_skill_id if row.program else None
        passed = (row.assessment_score or 0) >= 60
        has_skill = target_skill_id in {skill.skill_id for skill in profile.skills}
        if target_skill_id and passed and not has_skill:
            level = min(5, max(2, round((row.assessment_score or 60) / 20)))
            db.add(YouthSkill(youth_id=profile.id, skill_id=target_skill_id, level=level))
            db.flush()
            db.refresh(profile)
            services.recompute_employability(db, profile)
        db.add(Reminder(
            user_id=user.id,
            title="Apply your new skill to a matched job",
            message="Your assessment is complete. Review updated role matches and opportunities.",
            reminder_type="job_match",
            due_at=datetime.utcnow() + timedelta(days=1),
            action_url="/youth/jobs",
        ))
    db.commit()
    db.refresh(row)
    return _training_out(row)


@router.get("/jobs", response_model=list[JobOut])
def matched_jobs(user: User = Depends(require_role("youth")),
                 db: Session = Depends(get_db)):
    profile = _get_profile(db, user)
    jobs = db.query(Job).filter(Job.status == "active").all()
    applied_ids = {a.job_id for a in profile.applications}

    results = []
    for job in jobs:
        out = services.job_to_out(
            job,
            match_score=services.match_youth_to_job(profile, job),
            already_applied=job.id in applied_ids,
        )
        results.append(out)

    results.sort(key=lambda j: j.match_score or 0, reverse=True)
    return results


@router.post("/jobs/{job_id}/apply", response_model=ApplicationOut)
def apply_to_job(job_id: int,
                 user: User = Depends(require_role("youth")),
                 db: Session = Depends(get_db)):
    profile = _get_profile(db, user)
    job = db.get(Job, job_id)
    if job is None or job.status != "active":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not available")

    existing = (
        db.query(Application)
        .filter(Application.job_id == job_id, Application.youth_id == profile.id)
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already applied to this job")

    app = Application(
        job_id=job_id,
        youth_id=profile.id,
        stage="applied",
        match_score=services.match_youth_to_job(profile, job),
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    out = ApplicationOut.model_validate(app)
    out.job_title = job.title
    out.org_name = job.org.name if job.org else ""
    return out


@router.get("/applications", response_model=list[ApplicationOut])
def my_applications(user: User = Depends(require_role("youth")),
                    db: Session = Depends(get_db)):
    profile = _get_profile(db, user)
    apps = (
        db.query(Application)
        .filter(Application.youth_id == profile.id)
        .order_by(Application.updated_at.desc())
        .all()
    )
    return [_application_out(app) for app in apps]


@router.get("/documents", response_model=list[CandidateDocumentOut])
def my_documents(user: User = Depends(require_role("youth")), db: Session = Depends(get_db)):
    profile = _get_profile(db, user)
    return [CandidateDocumentOut.model_validate(row) for row in sorted(profile.documents, key=lambda row: row.created_at, reverse=True)]


@router.post("/documents", response_model=CandidateDocumentOut, status_code=status.HTTP_201_CREATED)
def submit_document(body: CandidateDocumentIn, user: User = Depends(require_role("youth")), db: Session = Depends(get_db)):
    if body.document_type not in {"resume", "identity", "certificate", "licence", "other"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid document type")
    if not body.filename.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose a document file")
    profile = _get_profile(db, user)
    row = CandidateDocument(youth_id=profile.id, document_type=body.document_type, filename=body.filename.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    return CandidateDocumentOut.model_validate(row)


@router.post("/applications/{app_id}/respond", response_model=ApplicationOut)
def respond_to_offer(app_id: int, body: OfferResponse,
                     user: User = Depends(require_role("youth")),
                     db: Session = Depends(get_db)):
    """Youth accepts or declines an offer (an application at the 'selected' stage)."""
    profile = _get_profile(db, user)
    app = db.get(Application, app_id)
    if app is None or app.youth_id != profile.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if app.stage != "selected":
        raise HTTPException(status.HTTP_409_CONFLICT, "No pending offer for this application")

    if body.accept:
        app.stage = "joined"
        profile.employment_status = "employed"
        if app.placement_outcome is None:
            app.placement_outcome = PlacementOutcome(
                joined_at=datetime.utcnow(),
                starting_salary=app.job.salary_min if app.job else None,
                current_salary=app.job.salary_min if app.job else None,
            )
    else:
        app.stage = "declined"
    db.commit()
    db.refresh(app)
    return _application_out(app)


@router.post("/applications/{app_id}/retention-checkin",
             response_model=PlacementOutcomeOut)
def retention_checkin(app_id: int, body: RetentionCheckIn,
                      user: User = Depends(require_role("youth")),
                      db: Session = Depends(get_db)):
    profile = _get_profile(db, user)
    app = db.get(Application, app_id)
    if app is None or app.youth_id != profile.id or app.stage != "joined":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Joined placement not found")
    if body.retention_months not in {3, 6, 12}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Retention milestone must be 3, 6, or 12 months")
    for value, label in (
        (body.role_skill_match, "Role-skill match"),
        (body.candidate_satisfaction, "Candidate satisfaction"),
    ):
        if value is not None and not 1 <= value <= 5:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                f"{label} must be between 1 and 5")
    outcome = app.placement_outcome
    if outcome is None:
        outcome = PlacementOutcome(application_id=app.id, joined_at=app.updated_at)
        db.add(outcome)
    setattr(outcome, f"retained_{body.retention_months}m", body.still_employed)
    outcome.current_salary = body.current_salary or outcome.current_salary
    outcome.role_skill_match = body.role_skill_match or outcome.role_skill_match
    outcome.candidate_satisfaction = (
        body.candidate_satisfaction or outcome.candidate_satisfaction
    )
    outcome.exit_reason = None if body.still_employed else body.exit_reason
    outcome.last_checkin_at = datetime.utcnow()
    if not body.still_employed:
        profile.employment_status = "unemployed"
    db.commit()
    db.refresh(outcome)
    return PlacementOutcomeOut.model_validate(outcome)
