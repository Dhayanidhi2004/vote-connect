"""Adaptive candidate assessment, explainable matching, and human review APIs."""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import assessment_engine, services
from ..auth import require_role
from ..database import get_db
from ..models import (
    AssessmentAnswer, AssessmentConfig, AssessmentQuestion, CandidateAssessment,
    CandidateSkillScore, Job, JobRequiredSkill, JobRequirement, PracticalVerification,
    Skill, User, YouthProfile,
)
from ..schemas import (
    AssessmentConfigOut, AssessmentConfigUpdate, AssessmentQueueRow,
    AssessmentStartIn, AssessmentSubmitIn, CandidateAssessmentOut,
    CandidateJobMatchOut, CandidateSkillScoreOut, JobRequirementIn,
    JobOut, PracticalVerificationIn, PracticalVerificationOut, SkillGapAnalysisOut,
)

router = APIRouter(prefix="/api/assessments", tags=["AI skill assessments"])


def _profile(db: Session, user: User) -> YouthProfile:
    row = db.query(YouthProfile).filter(YouthProfile.user_id == user.id).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Youth profile not found")
    return row


def _json_list(value: str | None) -> list[str]:
    try:
        return list(json.loads(value or "[]"))
    except (TypeError, ValueError):
        return []


def _serialize(row: CandidateAssessment, include_questions: bool = True) -> CandidateAssessmentOut:
    out = CandidateAssessmentOut(
        id=row.id, candidate_id=row.candidate_id,
        candidate_name=row.candidate.user.name if row.candidate and row.candidate.user else "",
        category=row.category, target_role=row.target_role, assessment_type=row.assessment_type,
        started_at=row.started_at, completed_at=row.completed_at, overall_score=row.overall_score,
        knowledge_level=row.knowledge_level, status=row.status,
        strengths=_json_list(row.strengths), weak_areas=_json_list(row.weak_areas),
        ai_disclaimer=row.ai_disclaimer or "AI recommendation only. Final decision belongs to Admin / Recruiter / Employer.",
        questions=[], skill_scores=[], job_matches=[], practical_verifications=[],
    )
    if include_questions:
        out.questions = []
        for question in sorted(row.questions, key=lambda item: item.sequence):
            item = {
                "id": question.id, "skill": question.skill, "question": question.question,
                "question_type": question.question_type, "difficulty": question.difficulty,
                "max_score": question.max_score, "sequence": question.sequence,
                "answer": question.answer.answer if question.answer else None,
                "score": question.answer.score if question.answer else None,
                "ai_feedback": question.answer.ai_feedback if question.answer else None,
            }
            out.questions.append(item)
    out.skill_scores = [CandidateSkillScoreOut.model_validate(item) for item in row.skill_scores]
    out.job_matches = []
    for match in sorted(row.job_matches, key=lambda item: item.overall_match_score, reverse=True):
        item = CandidateJobMatchOut(
            id=match.id, job_id=match.job_id,
            job_title=match.job.title if match.job else "",
            company=match.job.org.name if match.job and match.job.org else "",
            skill_match=match.skill_match, experience_match=match.experience_match,
            location_match=match.location_match, salary_match=match.salary_match,
            availability_match=match.availability_match,
            requirement_match=match.requirement_match,
            optional_skill_match=match.optional_skill_match,
            overall_match_score=match.overall_match_score, match_level=match.match_level,
            mandatory_missing=_json_list(match.mandatory_missing),
            matched_skills=_json_list(match.matched_skills),
            missing_skills=_json_list(match.missing_skills),
            recommendation_reason=match.recommendation_reason,
            gaps=[SkillGapAnalysisOut.model_validate(gap) for gap in match.gaps],
        )
        out.job_matches.append(item)
    out.practical_verifications = [{
        "id": item.id, "reviewer_user_id": item.reviewer_user_id,
        "practical_test": item.practical_test, "communication": item.communication,
        "technical_skill": item.technical_skill, "job_knowledge": item.job_knowledge,
        "safety_awareness": item.safety_awareness, "problem_solving": item.problem_solving,
        "notes": item.notes, "created_at": item.created_at.isoformat(),
    } for item in sorted(row.practical_verifications, key=lambda value: value.created_at, reverse=True)]
    return out


@router.post("/youth/start", response_model=CandidateAssessmentOut,
             status_code=status.HTTP_201_CREATED)
def start_assessment(body: AssessmentStartIn,
                     user: User = Depends(require_role("youth")),
                     db: Session = Depends(get_db)):
    if body.category not in {"IT", "Non-IT", "General Workforce"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid candidate category")
    youth = _profile(db, user)
    selected = []
    wanted = set(body.skill_ids)
    if body.category == "IT":
        for youth_skill in youth.skills:
            if youth_skill.skill_id in wanted:
                selected.append((youth_skill.skill.name, youth_skill.level))
    row = CandidateAssessment(candidate_id=youth.id, category=body.category,
                              target_role=body.target_role, status="in_progress")
    youth.candidate_category = body.category
    youth.target_role = body.target_role
    db.add(row)
    db.flush()
    for index, spec in enumerate(assessment_engine.generate_questions(body.category, body.target_role, selected)):
        db.add(AssessmentQuestion(assessment_id=row.id, skill=spec.skill,
            question=spec.question, question_type=spec.question_type,
            difficulty=spec.difficulty, max_score=100,
            evaluation_criteria=spec.criteria, sequence=index))
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.get("/youth/current", response_model=CandidateAssessmentOut | None)
def current_assessment(user: User = Depends(require_role("youth")),
                       db: Session = Depends(get_db)):
    youth = _profile(db, user)
    row = db.query(CandidateAssessment).filter(
        CandidateAssessment.candidate_id == youth.id
    ).order_by(CandidateAssessment.created_at.desc()).first()
    return _serialize(row) if row else None


@router.get("/youth/history", response_model=list[CandidateAssessmentOut])
def assessment_history(user: User = Depends(require_role("youth")),
                       db: Session = Depends(get_db)):
    youth = _profile(db, user)
    rows = db.query(CandidateAssessment).filter(
        CandidateAssessment.candidate_id == youth.id
    ).order_by(CandidateAssessment.created_at.desc()).all()
    return [_serialize(row, include_questions=False) for row in rows]


@router.post("/youth/{assessment_id}/submit", response_model=CandidateAssessmentOut)
def submit_assessment(assessment_id: int, body: AssessmentSubmitIn,
                      user: User = Depends(require_role("youth")),
                      db: Session = Depends(get_db)):
    youth = _profile(db, user)
    row = db.get(CandidateAssessment, assessment_id)
    if row is None or row.candidate_id != youth.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    answer_map = {item.question_id: item.answer for item in body.answers}
    if not answer_map:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Answer at least one question")
    config = assessment_engine.default_config(db)
    by_skill: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for question in row.questions:
        answer_text = answer_map.get(question.id, "")
        evaluation = assessment_engine.evaluate_answer(answer_text, question.skill,
                                                        question.evaluation_criteria or "",
                                                        question.difficulty)
        answer = question.answer or AssessmentAnswer(question_id=question.id, candidate_id=youth.id)
        answer.answer = answer_text
        for key, value in evaluation.items():
            setattr(answer, key, value)
        answer.evaluated_at = datetime.utcnow()
        db.add(answer)
        by_skill[question.skill][question.question_type].append(float(evaluation["score"]))
    for old in list(row.skill_scores):
        db.delete(old)
    db.flush()
    created_scores = []
    component_weights = {
        "mcq": config.mcq_weight, "concept": config.mcq_weight,
        "scenario": config.scenario_weight, "practical": config.practical_weight,
        "coding": config.coding_weight, "experience": config.experience_weight,
    }
    experience_score = min(100.0, 35.0 + (youth.experience_years or 0) * 15.0)
    for skill, components in by_skill.items():
        weighted_values = []
        for component, scores in components.items():
            weighted_values.append((sum(scores) / len(scores), component_weights.get(component, 0)))
        if "experience" not in components:
            weighted_values.append((experience_score, config.experience_weight))
        total_weight = sum(weight for _, weight in weighted_values) or 1
        score = round(sum(value * weight for value, weight in weighted_values) / total_weight, 1)
        skill_row = CandidateSkillScore(candidate_id=youth.id, assessment_id=row.id,
                                        skill=skill, score=score,
                                        knowledge_level=assessment_engine.knowledge_level(score, config))
        db.add(skill_row)
        created_scores.append(skill_row)
    db.flush()
    row.overall_score = round(sum(item.score for item in created_scores) / len(created_scores), 1) if created_scores else 0
    row.knowledge_level = assessment_engine.knowledge_level(row.overall_score, config)
    row.strengths = json.dumps([item.skill for item in created_scores if item.score >= 70])
    row.weak_areas = json.dumps([item.skill for item in created_scores if item.score < 70])
    row.status = "completed"
    row.completed_at = datetime.utcnow()
    db.flush()
    db.expire(row, ["skill_scores"])
    assessment_engine.build_job_matches(db, row, youth, config)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.get("/admin/queue", response_model=list[AssessmentQueueRow])
def assessment_queue(category: str | None = None, status_filter: str | None = None,
                     role: str | None = None, knowledge_level: str | None = None,
                     min_skill_score: float | None = None, min_match_score: float | None = None,
                     user: User = Depends(require_role("admin", "recruiter")),
                     db: Session = Depends(get_db)):
    query = db.query(CandidateAssessment)
    if category:
        query = query.filter(CandidateAssessment.category == category)
    if status_filter:
        query = query.filter(CandidateAssessment.status == status_filter)
    if role:
        query = query.filter(CandidateAssessment.target_role.ilike(f"%{role}%"))
    if knowledge_level:
        query = query.filter(CandidateAssessment.knowledge_level == knowledge_level)
    if min_skill_score is not None:
        query = query.filter(CandidateAssessment.overall_score >= min_skill_score)
    rows = query.order_by(CandidateAssessment.created_at.desc()).all()
    if min_match_score is not None:
        rows = [row for row in rows if row.job_matches and
                max(item.overall_match_score for item in row.job_matches) >= min_match_score]
    return [AssessmentQueueRow(
        assessment_id=row.id,
        candidate_name=row.candidate.user.name if row.candidate and row.candidate.user else "",
        category=row.category, target_role=row.target_role, status=row.status,
        overall_score=row.overall_score, knowledge_level=row.knowledge_level,
        top_job=(max(row.job_matches, key=lambda item: item.overall_match_score).job.title
                 if row.job_matches else None),
        job_match_score=(max(item.overall_match_score for item in row.job_matches)
                         if row.job_matches else None),
        assessment_date=row.completed_at or row.created_at,
    ) for row in rows]


@router.get("/admin/{assessment_id}", response_model=CandidateAssessmentOut)
def assessment_detail(assessment_id: int,
                      user: User = Depends(require_role("admin", "recruiter")),
                      db: Session = Depends(get_db)):
    row = db.get(CandidateAssessment, assessment_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    return _serialize(row)


@router.post("/admin/{assessment_id}/practical", response_model=PracticalVerificationOut)
def practical_verification(assessment_id: int, body: PracticalVerificationIn,
                           user: User = Depends(require_role("admin", "recruiter")),
                           db: Session = Depends(get_db)):
    if db.get(CandidateAssessment, assessment_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    values = body.model_dump()
    if any(value < 0 or value > 100 for key, value in values.items() if key != "notes"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Scores must be 0-100")
    row = PracticalVerification(assessment_id=assessment_id, reviewer_user_id=user.id, **values)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/configuration/weights", response_model=AssessmentConfigOut)
def get_config(user: User = Depends(require_role("admin")),
               db: Session = Depends(get_db)):
    row = assessment_engine.default_config(db)
    db.commit()
    db.refresh(row)
    return row


@router.put("/configuration/weights", response_model=AssessmentConfigOut)
def update_config(body: AssessmentConfigUpdate,
                  user: User = Depends(require_role("admin")),
                  db: Session = Depends(get_db)):
    for label, raw in (("Knowledge", body.knowledge_thresholds), ("Match", body.match_thresholds)):
        try:
            values = [float(item.strip()) for item in raw.split(",")]
        except ValueError:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                f"{label} thresholds must be comma-separated numbers")
        if len(values) != 5 or values != sorted(values) or values[0] < 0 or values[-1] > 100:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                f"{label} thresholds need five ascending values between 0 and 100")
    if abs(sum([body.mcq_weight, body.scenario_weight, body.practical_weight,
                body.coding_weight, body.experience_weight]) - 100) > .01:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Assessment weights must total 100")
    if abs(sum([body.match_skill_weight, body.match_experience_weight,
                body.match_location_weight, body.match_salary_weight,
                body.match_availability_weight, body.match_requirement_weight,
                body.match_optional_weight]) - 100) > .01:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Match weights must total 100")
    row = assessment_engine.default_config(db)
    for key, value in body.model_dump().items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.get("/configuration/jobs", response_model=list[JobOut])
def configuration_jobs(user: User = Depends(require_role("admin", "recruiter")),
                       db: Session = Depends(get_db)):
    query = db.query(Job)
    if user.role == "recruiter":
        query = query.filter(Job.org_id == user.recruiter_org_id)
    return [services.job_to_out(job) for job in query.order_by(Job.title).all()]


@router.put("/configuration/jobs/{job_id}")
def configure_job(job_id: int, body: JobRequirementIn,
                  user: User = Depends(require_role("admin", "recruiter")),
                  db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if job is None or (user.role == "recruiter" and job.org_id != user.recruiter_org_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    requirement = job.assessment_requirement or JobRequirement(job_id=job.id)
    for key, value in body.model_dump(exclude={"skills"}).items():
        setattr(requirement, key, value)
    db.add(requirement)
    db.query(JobRequiredSkill).filter(JobRequiredSkill.job_id == job.id).delete()
    for skill in body.skills:
        if db.get(Skill, skill.skill_id) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown skill")
        db.add(JobRequiredSkill(job_id=job.id, **skill.model_dump()))
    db.commit()
    return {"status": "configured", "job_id": job.id, "skills": len(body.skills)}
