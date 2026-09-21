"""Shared service helpers that stitch the ORM to the scoring engine."""
from __future__ import annotations

from sqlalchemy.orm import Session

from . import scoring
from .models import (
    Application,
    Constituency,
    Job,
    JobSkill,
    SkillDemand,
    YouthProfile,
    YouthSkill,
)


def demand_map(db: Session, constituency_id: int | None) -> dict[int, float]:
    """skill_id -> demand_weight for a constituency (empty if unknown)."""
    if not constituency_id:
        return {}
    rows = db.query(SkillDemand).filter(
        SkillDemand.constituency_id == constituency_id).all()
    return {r.skill_id: r.demand_weight for r in rows}


def youth_skill_ids(youth: YouthProfile) -> list[int]:
    return [ys.skill_id for ys in youth.skills]


def recompute_employability(db: Session, youth: YouthProfile) -> None:
    """Recompute and persist a youth's employability score."""
    demand = demand_map(db, youth.constituency_id)
    skill_ids = youth_skill_ids(youth)
    score, band = scoring.employability_score(
        education_level=youth.education_level,
        experience_years=youth.experience_years or 0.0,
        youth_skill_ids=skill_ids,
        demand=demand,
        has_resume=bool(youth.resume_filename),
        skill_count=len(skill_ids),
        verification_status=youth.verification_status,
    )
    youth.employability_score = score


def job_skill_weights(job: Job) -> dict[int, float]:
    return {js.skill_id: js.weight for js in job.skills}


def match_youth_to_job(youth: YouthProfile, job: Job) -> float:
    return scoring.job_match_score(
        youth_skill_ids=youth_skill_ids(youth),
        job_skill_weights=job_skill_weights(job),
        youth_years=youth.experience_years or 0.0,
        job_min_years=job.min_experience or 0.0,
        youth_constituency_id=youth.constituency_id,
        job_constituency_id=job.constituency_id,
        job_salary_max=job.salary_max,
    )


def employability_band(score: float) -> str:
    return scoring.band_for_score(score)


def job_to_out(job: Job, *, match_score: float | None = None,
               already_applied: bool = False):
    """Build a JobOut without letting Pydantic mis-map the JobSkill relationship."""
    from .schemas import JobOut, SkillOut  # local import avoids a cycle
    return JobOut(
        id=job.id,
        title=job.title,
        description=job.description,
        location=job.location,
        min_experience=job.min_experience,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        education_required=job.education_required,
        jd_filename=job.jd_filename,
        status=job.status,
        created_at=job.created_at,
        org_id=job.org_id,
        org_name=job.org.name if job.org else "",
        org_industry=job.org.industry if job.org else None,
        org_about=job.org.about if job.org else None,
        org_verification_status=job.org.verification_status if job.org else "unverified",
        skills=[SkillOut.model_validate(js.skill) for js in job.skills if js.skill],
        applicant_count=len(job.applications),
        match_score=match_score,
        already_applied=already_applied,
    )
