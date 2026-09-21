"""Recruiter portal: dashboard, jobs, candidate search, hiring pipeline, interviews."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import services
from ..auth import require_role
from ..database import get_db
from ..models import (
    Application,
    Interview,
    Job,
    JobSkill,
    PIPELINE_STAGES,
    PlacementOutcome,
    Reminder,
    RecruiterOrg,
    Skill,
    User,
    YouthProfile,
    YouthSkill,
)
from ..schemas import (
    ApplicationOut,
    CandidateOut,
    InterviewIn,
    JobIn,
    JobOut,
    PipelineFunnel,
    PlacementOutcomeOut,
    PlacementOutcomeUpdate,
    RecruiterDashboardOut,
    SkillOut,
    StageUpdate,
)

router = APIRouter(prefix="/api/recruiter", tags=["recruiter"])


def _org_id(user: User) -> int:
    if not user.recruiter_org_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Recruiter has no organisation")
    return user.recruiter_org_id


def _serialize_job(db: Session, job: Job) -> JobOut:
    return services.job_to_out(job)


def _candidate(youth: YouthProfile, match: float) -> CandidateOut:
    return CandidateOut(
        youth_id=youth.id,
        name=youth.user.name if youth.user else "",
        education_level=youth.education_level,
        education_field=youth.education_field,
        institution=youth.institution,
        experience_years=youth.experience_years or 0.0,
        experience_title=youth.experience_title,
        experience_company=youth.experience_company,
        constituency_name=youth.constituency.name if youth.constituency else None,
        employability_score=youth.employability_score,
        employability_band=services.employability_band(youth.employability_score),
        match_score=match,
        skills=[ys.skill.name for ys in youth.skills if ys.skill],
        resume_filename=youth.resume_filename,
        verification_status=youth.verification_status,
    )


def _application_out(app: Application) -> ApplicationOut:
    out = ApplicationOut.model_validate(app)
    out.job_title = app.job.title if app.job else ""
    out.youth_name = app.youth.user.name if app.youth and app.youth.user else ""
    out.org_name = app.job.org.name if app.job and app.job.org else ""
    if app.placement_outcome is not None:
        out.placement_outcome = PlacementOutcomeOut.model_validate(app.placement_outcome)
    return out


# --- jobs --------------------------------------------------------------------

@router.get("/jobs", response_model=list[JobOut])
def list_jobs(user: User = Depends(require_role("recruiter")),
              db: Session = Depends(get_db)):
    jobs = db.query(Job).filter(Job.org_id == _org_id(user)).order_by(
        Job.created_at.desc()).all()
    return [_serialize_job(db, j) for j in jobs]


@router.post("/jobs", response_model=JobOut, status_code=201)
def create_job(body: JobIn,
               user: User = Depends(require_role("recruiter")),
               db: Session = Depends(get_db)):
    org_id = _org_id(user)
    org = db.get(RecruiterOrg, org_id)
    job = Job(
        org_id=org_id,
        title=body.title,
        description=body.description,
        location=body.location,
        constituency_id=body.constituency_id or (org.constituency_id if org else None),
        min_experience=body.min_experience,
        salary_min=body.salary_min,
        salary_max=body.salary_max,
        education_required=body.education_required,
        jd_filename=body.jd_filename,
        status="active",
    )
    db.add(job)
    db.flush()
    for s in body.skills:
        db.add(JobSkill(job_id=job.id, skill_id=s.skill_id, weight=s.weight))
    db.commit()
    db.refresh(job)
    return _serialize_job(db, job)


@router.patch("/jobs/{job_id}/close", response_model=JobOut)
def close_job(job_id: int,
              user: User = Depends(require_role("recruiter")),
              db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if job is None or job.org_id != _org_id(user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    job.status = "closed"
    db.commit()
    db.refresh(job)
    return _serialize_job(db, job)


# --- candidate search --------------------------------------------------------

@router.get("/candidates", response_model=list[CandidateOut])
def search_candidates(
    user: User = Depends(require_role("recruiter")),
    db: Session = Depends(get_db),
    skill_id: list[int] = Query(default=[]),
    education_level: str | None = None,
    min_experience: float = 0.0,
    constituency_id: int | None = None,
    job_id: int | None = None,
):
    """Advanced candidate search. If job_id is given, rank by match to that job."""
    q = db.query(YouthProfile).filter(YouthProfile.onboarding_complete == True)  # noqa
    if education_level:
        q = q.filter(YouthProfile.education_level == education_level)
    if min_experience:
        q = q.filter(YouthProfile.experience_years >= min_experience)
    if constituency_id:
        q = q.filter(YouthProfile.constituency_id == constituency_id)
    youths = q.all()

    if skill_id:
        wanted = set(skill_id)
        youths = [y for y in youths
                  if wanted & {ys.skill_id for ys in y.skills}]

    job = db.get(Job, job_id) if job_id else None

    results = []
    for y in youths:
        if job is not None:
            match = services.match_youth_to_job(y, job)
        else:
            # No target job: score against constituency demand coverage.
            demand = services.demand_map(db, y.constituency_id)
            from .. import scoring
            match = round(scoring.skill_coverage_score(
                services.youth_skill_ids(y), demand))
        results.append(_candidate(y, match))

    results.sort(key=lambda c: c.match_score, reverse=True)
    return results


# --- applications / pipeline -------------------------------------------------

@router.get("/applications", response_model=list[ApplicationOut])
def list_applications(
    user: User = Depends(require_role("recruiter")),
    db: Session = Depends(get_db),
    job_id: int | None = None,
):
    org_id = _org_id(user)
    q = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Job.org_id == org_id)
    )
    if job_id:
        q = q.filter(Application.job_id == job_id)
    apps = q.order_by(Application.match_score.desc()).all()

    return [_application_out(app) for app in apps]


@router.patch("/applications/{app_id}/stage", response_model=ApplicationOut)
def move_stage(app_id: int, body: StageUpdate,
               user: User = Depends(require_role("recruiter")),
               db: Session = Depends(get_db)):
    if body.stage not in PIPELINE_STAGES + ["rejected"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid stage")
    app = db.get(Application, app_id)
    if app is None or app.job.org_id != _org_id(user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    app.stage = body.stage

    # Reflect placement in the youth's employment status.
    if body.stage == "joined":
        app.youth.employment_status = "employed"
        if app.placement_outcome is None:
            app.placement_outcome = PlacementOutcome(
                joined_at=datetime.utcnow(),
                starting_salary=app.job.salary_min,
                current_salary=app.job.salary_min,
            )
    db.commit()
    db.refresh(app)
    return _application_out(app)


@router.put("/applications/{app_id}/placement-outcome",
            response_model=PlacementOutcomeOut)
def record_placement_outcome(app_id: int, body: PlacementOutcomeUpdate,
                             user: User = Depends(require_role("recruiter")),
                             db: Session = Depends(get_db)):
    app = db.get(Application, app_id)
    if app is None or app.job.org_id != _org_id(user) or app.stage != "joined":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Joined placement not found")
    if body.starting_salary is not None and body.starting_salary < 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Starting salary cannot be negative")
    if body.current_salary is not None and body.current_salary < 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Current salary cannot be negative")
    if (body.employer_satisfaction is not None
            and not 1 <= body.employer_satisfaction <= 5):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Employer satisfaction must be between 1 and 5")
    outcome = app.placement_outcome
    if outcome is None:
        outcome = PlacementOutcome(application_id=app.id, joined_at=app.updated_at)
        db.add(outcome)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(outcome, field, value)
    db.commit()
    db.refresh(outcome)
    return PlacementOutcomeOut.model_validate(outcome)


@router.post("/applications/{app_id}/interview", response_model=ApplicationOut)
def schedule_interview(app_id: int, body: InterviewIn,
                       user: User = Depends(require_role("recruiter")),
                       db: Session = Depends(get_db)):
    app = db.get(Application, app_id)
    if app is None or app.job.org_id != _org_id(user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if app.interview is None:
        db.add(Interview(application_id=app.id, scheduled_at=body.scheduled_at,
                         mode=body.mode, notes=body.notes))
    else:
        app.interview.scheduled_at = body.scheduled_at
        app.interview.mode = body.mode
        app.interview.notes = body.notes
    if app.stage in ("applied", "shortlisted"):
        app.stage = "interview"
    if body.scheduled_at and app.youth and app.youth.user_id:
        db.add(Reminder(
            user_id=app.youth.user_id,
            title=f"Interview: {app.job.title}",
            message=f"{body.mode} interview with {app.job.org.name if app.job.org else 'employer'}.",
            reminder_type="interview",
            due_at=body.scheduled_at,
            action_url="/youth/applications",
        ))
    db.commit()
    db.refresh(app)
    return _application_out(app)


# --- dashboard ---------------------------------------------------------------

@router.get("/dashboard", response_model=RecruiterDashboardOut)
def dashboard(user: User = Depends(require_role("recruiter")),
              db: Session = Depends(get_db)):
    org_id = _org_id(user)
    jobs = db.query(Job).filter(Job.org_id == org_id).all()
    job_ids = [j.id for j in jobs]
    active_jobs = sum(1 for j in jobs if j.status == "active")

    apps = (db.query(Application).filter(Application.job_id.in_(job_ids)).all()
            if job_ids else [])

    def count(stage_from_index: int) -> int:
        idx = {s: i for i, s in enumerate(PIPELINE_STAGES)}
        return sum(1 for a in apps
                   if a.stage in PIPELINE_STAGES
                   and idx[a.stage] >= stage_from_index)

    pipeline = PipelineFunnel(
        registered=len(apps),
        shortlisted=count(1),
        interviews=count(2),
        selected=count(3),
        joined=count(4),
    )

    # Top matched candidates across this recruiter's active jobs.
    top: list[CandidateOut] = []
    seen = set()
    for job in jobs:
        if job.status != "active":
            continue
        for y in db.query(YouthProfile).filter(
                YouthProfile.onboarding_complete == True).all():  # noqa
            if y.id in seen:
                continue
            match = services.match_youth_to_job(y, job)
            if match >= 60:
                seen.add(y.id)
                top.append(_candidate(y, match))
    top.sort(key=lambda c: c.match_score, reverse=True)

    return RecruiterDashboardOut(
        active_jobs=active_jobs,
        total_applications=len(apps),
        shortlisted=pipeline.shortlisted,
        hired=pipeline.joined,
        top_candidates=top[:8],
        pipeline=pipeline,
    )
