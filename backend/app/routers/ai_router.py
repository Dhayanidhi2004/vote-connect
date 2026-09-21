"""AI endpoints for youth guidance and job-fit explanations."""
from __future__ import annotations

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import ai, scoring, services
from ..auth import require_role
from ..database import get_db
from ..models import Job, Skill, TrainingProgram, User, YouthProfile
from ..schemas import AICareerPlanOut, AIJobInsightOut, AIStatusOut
from .youth_router import _get_profile

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _skills_by_id(db: Session) -> dict[int, Skill]:
    return {skill.id: skill for skill in db.query(Skill).all()}


def _career_prompt(db: Session, profile: YouthProfile) -> str:
    demand = services.demand_map(db, profile.constituency_id)
    have_ids = services.youth_skill_ids(profile)
    gap_ids = scoring.skill_gap(have_ids, demand)
    skills_by_id = _skills_by_id(db)

    top_jobs = []
    jobs = db.query(Job).filter(Job.status == "active").all()
    for job in jobs:
        score = services.match_youth_to_job(profile, job)
        if score >= 55:
            top_jobs.append(f"- {job.title} at {job.org.name if job.org else 'Unknown org'} ({round(score)}% match)")
    top_jobs = top_jobs[:5]

    programs = []
    for sid in gap_ids[:5]:
        matches = (
            db.query(TrainingProgram)
            .filter(
                TrainingProgram.target_skill_id == sid,
                TrainingProgram.verification_status == "verified",
            )
            .all()
        )
        if matches:
            title_list = ", ".join(p.title for p in matches[:3])
            programs.append(f"- {skills_by_id[sid].name}: {title_list}")

    current_skills = [skills_by_id[sid].name for sid in have_ids if sid in skills_by_id]
    gap_skills = [skills_by_id[sid].name for sid in gap_ids if sid in skills_by_id][:8]

    return f"""
Create a concise youth career plan for a constituency employment platform.
Be practical, encouraging, and specific. Do not invent facts not present below.

Profile:
- Education level: {profile.education_level or "Unknown"}
- Education field: {profile.education_field or "Unknown"}
- Experience years: {profile.experience_years or 0}
- Experience title: {profile.experience_title or "None"}
- Verification status: {profile.verification_status}
- Employability score: {profile.employability_score}

Current skills:
{chr(10).join(f"- {name}" for name in current_skills) if current_skills else "- None listed"}

Top skill gaps:
{chr(10).join(f"- {name}" for name in gap_skills) if gap_skills else "- None"}

Recommended training already available in the platform:
{chr(10).join(programs) if programs else "- None currently mapped"}

Best current job matches:
{chr(10).join(top_jobs) if top_jobs else "- No strong job matches yet"}

Return JSON only. Keep lists short and high signal.
""".strip()


def _job_prompt(db: Session, profile: YouthProfile, job: Job) -> str:
    skills_by_id = _skills_by_id(db)
    youth_skill_names = [skills_by_id[sid].name for sid in services.youth_skill_ids(profile) if sid in skills_by_id]
    job_skill_ids = [js.skill_id for js in job.skills]
    missing = [skills_by_id[sid].name for sid in job_skill_ids if sid in skills_by_id and sid not in services.youth_skill_ids(profile)]
    matched = [skills_by_id[sid].name for sid in job_skill_ids if sid in skills_by_id and sid in services.youth_skill_ids(profile)]
    score = services.match_youth_to_job(profile, job)

    return f"""
Explain this job fit for a youth candidate on a hiring platform.
Be honest and actionable. If fit is weak, say so clearly and suggest next steps.
Do not invent requirements beyond the data provided.

Candidate:
- Education level: {profile.education_level or "Unknown"}
- Education field: {profile.education_field or "Unknown"}
- Experience years: {profile.experience_years or 0}
- Employability score: {profile.employability_score}
- Current skills: {", ".join(youth_skill_names) if youth_skill_names else "None listed"}

Job:
- Title: {job.title}
- Organization: {job.org.name if job.org else "Unknown"}
- Description: {job.description or "No description"}
- Location: {job.location or "Not specified"}
- Minimum experience: {job.min_experience or 0}
- Education required: {job.education_required or "Not specified"}
- Required skills: {", ".join(skills_by_id[sid].name for sid in job_skill_ids if sid in skills_by_id) or "None listed"}
- Current match score: {round(score)}%

Already matched skills:
{chr(10).join(f"- {name}" for name in matched) if matched else "- None"}

Missing or weak skills:
{chr(10).join(f"- {name}" for name in missing) if missing else "- None obvious"}

Return JSON only. Keep the answer compact and recruiter-grade.
""".strip()


@router.get("/status", response_model=AIStatusOut)
def ai_status():
    return AIStatusOut(**ai.status_payload())


@router.post("/youth/coach", response_model=AICareerPlanOut)
def youth_career_plan(
    user: User = Depends(require_role("youth")),
    db: Session = Depends(get_db),
):
    profile = _get_profile(db, user)
    try:
        result = ai.generate_structured(
            system_instruction=(
                "You are an employment coach for Indian youth job seekers. "
                "Ground every answer in the supplied profile, skills, jobs, and programs. "
                "Be concise, practical, and avoid hype."
            ),
            prompt=_career_prompt(db, profile),
            schema_model=AICareerPlanOut,
        )
    except ai.AIConfigError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except requests.exceptions.SSLError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Gemini SSL connection failed on this machine. The Google certificate chain is not trusted locally.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Gemini request failed: {exc}",
        ) from exc
    return result


@router.post("/youth/jobs/{job_id}/insight", response_model=AIJobInsightOut)
def youth_job_insight(
    job_id: int,
    user: User = Depends(require_role("youth")),
    db: Session = Depends(get_db),
):
    profile = _get_profile(db, user)
    job = db.get(Job, job_id)
    if job is None or job.status != "active":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not available")

    try:
        result = ai.generate_structured(
            system_instruction=(
                "You explain job fit to Indian youth candidates. "
                "Be honest, specific, and action-oriented. "
                "Do not inflate weak matches."
            ),
            prompt=_job_prompt(db, profile, job),
            schema_model=AIJobInsightOut,
        )
    except ai.AIConfigError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except requests.exceptions.SSLError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Gemini SSL connection failed on this machine. The Google certificate chain is not trusted locally.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Gemini request failed: {exc}",
        ) from exc
    return result
