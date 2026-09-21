"""Explainable assessment and matching engine with an optional AI evaluation adapter."""
from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from time import monotonic

from pydantic import BaseModel
from sqlalchemy.orm import Session

from . import ai, scoring
from .config import settings
from .models import (
    AssessmentConfig,
    CandidateAssessment,
    CandidateJobMatch,
    CandidateSkillScore,
    Job,
    JobRequiredSkill,
    SkillGapAnalysis,
    YouthProfile,
)


ROLE_SKILLS = {
    "Accountant": ["Tally", "GST", "Excel", "Basic Accounting", "Invoice Processing"],
    "HR": ["Recruitment", "Employee Handling", "Payroll", "Communication", "HR Policies"],
    "Sales": ["Customer Handling", "Negotiation", "Lead Follow-up", "Product Explanation"],
    "Electrician": ["Electrical Safety", "Wiring", "Fault Identification", "Tools"],
    "Machine Operator": ["Machine Safety", "Machine Operation", "Troubleshooting", "Production Process"],
    "Driver": ["Traffic Rules", "Vehicle Safety", "Breakdown Handling", "Route Knowledge"],
    "Housekeeping": ["Cleaning Process", "Safety", "Chemical Handling", "Work Discipline"],
    "Delivery Person": ["Route Handling", "Customer Interaction", "Smartphone Usage", "Delivery Safety"],
    "Security": ["Emergency Handling", "Visitor Management", "Basic Safety", "Shift Readiness"],
    "Loader / Helper": ["Safety", "Physical Job Awareness", "Work Experience", "Team Coordination"],
}

_AI_RETRY_AFTER = 0.0


@dataclass
class QuestionSpec:
    skill: str
    question_type: str
    difficulty: str
    question: str
    criteria: str


class AIAnswerEvaluation(BaseModel):
    score: float
    technical_correctness: float
    practical_understanding: float
    explanation_clarity: float
    problem_solving: float
    completeness: float
    ai_feedback: str


def default_config(db: Session) -> AssessmentConfig:
    row = db.query(AssessmentConfig).filter(AssessmentConfig.name == "default").first()
    if row is None:
        row = AssessmentConfig(name="default")
        db.add(row)
        db.flush()
    return row


def _thresholds(value: str | None, fallback: list[float]) -> list[float]:
    try:
        parsed = [float(item.strip()) for item in (value or "").split(",")]
        return parsed if len(parsed) == 5 and parsed == sorted(parsed) else fallback
    except (TypeError, ValueError):
        return fallback


def knowledge_level(score: float, config: AssessmentConfig | None = None) -> str:
    levels = _thresholds(config.knowledge_thresholds if config else None, [0, 40, 60, 80, 90])
    if score >= levels[4]:
        return "Expert"
    if score >= levels[3]:
        return "Advanced"
    if score >= levels[2]:
        return "Intermediate"
    if score >= levels[1]:
        return "Basic"
    return "Beginner / Needs Training"


def match_level(score: float, config: AssessmentConfig | None = None) -> str:
    levels = _thresholds(config.match_thresholds if config else None, [0, 50, 65, 80, 90])
    if score >= levels[4]:
        return "Excellent Match"
    if score >= levels[3]:
        return "Strong Match"
    if score >= levels[2]:
        return "Good Match"
    if score >= levels[1]:
        return "Partial Match"
    return "Low Match"


def assessment_skills(category: str, role: str, claimed: list[tuple[str, int]]) -> list[tuple[str, int]]:
    if claimed:
        return claimed[:5]
    return [(name, 2) for name in ROLE_SKILLS.get(role, [role or "Job Knowledge", "Safety", "Communication"])]


def generate_questions(category: str, role: str, claimed: list[tuple[str, int]]) -> list[QuestionSpec]:
    specs: list[QuestionSpec] = []
    for skill, level in assessment_skills(category, role, claimed):
        difficulty = "Advanced" if level >= 5 else "Intermediate" if level >= 3 else "Beginner"
        if category == "IT":
            items = [
                ("mcq", f"Explain one core {skill} concept and when it should be used.", f"{skill}, concept, correct use"),
                ("scenario", f"A production task using {skill} is slow or failing. How would you identify the cause and fix it?", "diagnosis, root cause, test, solution"),
                ("practical", f"Describe the steps, tools, and checks you would use to complete a practical {skill} task.", "steps, tools, validation, safe outcome"),
                ("coding", f"Write code, a query, or clear pseudocode that demonstrates practical use of {skill} and explain its complexity or trade-offs.", "working approach, edge cases, trade-off"),
            ]
        elif category == "Non-IT":
            items = [
                ("mcq", f"Describe the most important rule or process in {skill} for a {role}.", "correct process, job relevance"),
                ("scenario", f"Describe how you would handle a difficult real workplace situation involving {skill}.", "situation, action, safe outcome"),
                ("practical", f"List the steps you would follow to demonstrate {skill} correctly in a practical test.", "sequence, tools, verification"),
                ("experience", f"Give one real example where you used {skill}, what you did, and the result.", "real example, action, result"),
            ]
        else:
            items = [
                ("scenario", f"In simple words, what would you do in a real job situation involving {skill}?", "safe action, practical response"),
                ("practical", f"Show or explain the safe steps for {skill}. You may answer in Tamil or English.", "safety, correct order, experience"),
                ("experience", f"Tell us about a time you did work related to {skill}. You may answer in Tamil or English.", "experience, action, result"),
            ]
        for question_type, question, criteria in items:
            specs.append(QuestionSpec(skill, question_type, difficulty, question, criteria))
    return specs[:20]


def evaluate_answer(answer: str, skill: str, criteria: str, difficulty: str) -> dict[str, float | str]:
    """Provider-neutral evaluation. Grammar and English fluency are intentionally excluded."""
    global _AI_RETRY_AFTER
    clean = answer.strip()
    if (clean and settings.assessment_ai_mode == "auto" and ai.is_configured()
            and monotonic() >= _AI_RETRY_AFTER):
        executor = ThreadPoolExecutor(max_workers=1)
        try:
            future = executor.submit(
                ai.generate_structured,
                system_instruction=(
                    "Evaluate demonstrated job skill only. Do not score grammar, English fluency, "
                    "education, age, gender, caste, religion, disability, or any protected trait. "
                    "Return explainable 0-100 component scores. AI is advisory only."
                ),
                prompt=f"Skill: {skill}\nDifficulty: {difficulty}\nCriteria: {criteria}\nAnswer: {clean}",
                schema_model=AIAnswerEvaluation,
            )
            result = future.result(timeout=8).model_dump()
            for key in ("score", "technical_correctness", "practical_understanding",
                        "explanation_clarity", "problem_solving", "completeness"):
                result[key] = max(0.0, min(100.0, float(result[key])))
            return result
        except (Exception, FutureTimeoutError):
            _AI_RETRY_AFTER = monotonic() + 300
        finally:
            executor.shutdown(wait=False, cancel_futures=True)
        # Deterministic, explainable fallback keeps the assessment available.
    words = re.findall(r"[\w+#.-]+", clean.lower())
    criterion_tokens = set(re.findall(r"[a-z0-9+#]+", criteria.lower()))
    coverage = len(criterion_tokens & set(words)) / max(1, len(criterion_tokens))
    detail = min(1.0, len(words) / (45 if difficulty == "Advanced" else 28))
    structure = min(1.0, (clean.count("\n") + clean.count(".") + 1) / 4)
    skill_signal = 1.0 if any(token in clean.lower() for token in skill.lower().split()) else 0.45
    correctness = round(100 * (0.25 + 0.45 * coverage + 0.30 * skill_signal), 1) if clean else 0
    practical = round(100 * (0.20 + 0.45 * detail + 0.35 * coverage), 1) if clean else 0
    clarity = round(100 * (0.35 + 0.45 * structure + 0.20 * detail), 1) if clean else 0
    problem = round(100 * (0.20 + 0.50 * coverage + 0.30 * detail), 1) if clean else 0
    completeness = round(100 * (0.15 + 0.60 * detail + 0.25 * coverage), 1) if clean else 0
    score = round(min(100, correctness * .30 + practical * .25 + clarity * .15 + problem * .15 + completeness * .15), 1)
    feedback = "Good practical evidence." if score >= 70 else "Add clearer steps, examples, safety checks, and verification of the outcome."
    return {"score": score, "technical_correctness": correctness, "practical_understanding": practical,
            "explanation_clarity": clarity, "problem_solving": problem, "completeness": completeness,
            "ai_feedback": feedback}


def _csv(values: list[str]) -> str:
    return json.dumps(values, ensure_ascii=False)


def _ratio(value: float, required: float) -> float:
    return round(min(100.0, 100 * value / required), 1) if required > 0 else 100.0


def build_job_matches(db: Session, assessment: CandidateAssessment, youth: YouthProfile,
                      config: AssessmentConfig) -> None:
    scores = {row.skill.lower(): row.score for row in assessment.skill_scores}
    for old in list(assessment.job_matches):
        db.delete(old)
    db.flush()
    for job in db.query(Job).filter(Job.status == "active").all():
        requirements = list(job.assessment_skills)
        if not requirements:
            requirements = [JobRequiredSkill(job_id=job.id, skill_id=row.skill_id,
                                              minimum_score=60, mandatory=True,
                                              weightage=row.weight) for row in job.skills]
        matched, missing, mandatory_missing, ratios, optional_ratios = [], [], [], [], []
        gap_rows = []
        for req in requirements:
            name = req.skill.name if req.skill else next((row.skill.name for row in job.skills if row.skill_id == req.skill_id), "Skill")
            candidate_score = scores.get(name.lower(), 0.0)
            ratio = _ratio(candidate_score, req.minimum_score)
            (optional_ratios if req.optional else ratios).append(ratio)
            if candidate_score >= req.minimum_score:
                matched.append(name)
            else:
                missing.append(name)
                if req.mandatory and not req.optional:
                    mandatory_missing.append(name)
                gap_rows.append((name, candidate_score, req.minimum_score))
        skill_match = round(sum(ratios) / len(ratios), 1) if ratios else 50.0
        exp_match = scoring.experience_fit_score(youth.experience_years or 0, job.min_experience or 0)
        location_match = 100.0 if youth.constituency_id == job.constituency_id else (80.0 if youth.mobility_preference in {"Within Tamil Nadu", "Open to relocate"} else 45.0)
        salary_match = 100.0 if not youth.expected_salary or not job.salary_max or youth.expected_salary <= job.salary_max else _ratio(job.salary_max, youth.expected_salary)
        requirement = job.assessment_requirement
        availability_match = 100.0 if not requirement or requirement.maximum_notice_days is None or (youth.notice_period_days or 0) <= requirement.maximum_notice_days else 40.0
        requirement_missing = []
        if requirement:
            certs = (youth.certificates or "").lower()
            if requirement.required_certificate and requirement.required_certificate.lower() not in certs:
                requirement_missing.append(requirement.required_certificate)
            if requirement.required_licence and requirement.required_licence.lower() not in certs:
                requirement_missing.append(requirement.required_licence)
            if requirement.mandatory_education and not youth.education_level:
                requirement_missing.append("Required education")
            if requirement.candidate_category and requirement.candidate_category != assessment.category:
                requirement_missing.append(f"Category: {requirement.candidate_category}")
        mandatory_missing.extend(requirement_missing)
        requirement_match = 0.0 if requirement_missing else 100.0
        optional_match = round(sum(optional_ratios) / len(optional_ratios), 1) if optional_ratios else 100.0
        weights = [config.match_skill_weight, config.match_experience_weight, config.match_location_weight,
                   config.match_salary_weight, config.match_availability_weight,
                   config.match_requirement_weight, config.match_optional_weight]
        factors = [skill_match, exp_match, location_match, salary_match, availability_match,
                   requirement_match, optional_match]
        total = sum(weights) or 100
        overall = round(sum(value * weight for value, weight in zip(factors, weights)) / total, 1)
        if mandatory_missing:
            overall = min(overall, 79.0)
        level = match_level(overall, config)
        reason = f"{len(matched)} assessed skills meet the role threshold; experience {round(exp_match)}%, location {round(location_match)}%, salary {round(salary_match)}%."
        if mandatory_missing:
            reason += " Mandatory requirement missing: " + ", ".join(mandatory_missing) + ". Final review required."
        row = CandidateJobMatch(candidate_id=youth.id, assessment_id=assessment.id, job_id=job.id,
            skill_match=skill_match, experience_match=exp_match, location_match=location_match,
            salary_match=salary_match, availability_match=availability_match,
            requirement_match=requirement_match, optional_skill_match=optional_match,
            overall_match_score=overall, match_level=level,
            mandatory_missing=_csv(mandatory_missing), matched_skills=_csv(matched),
            missing_skills=_csv(missing), recommendation_reason=reason)
        db.add(row)
        db.flush()
        for name, candidate_score, required_score in gap_rows:
            db.add(SkillGapAnalysis(candidate_id=youth.id, job_id=job.id, job_match_id=row.id,
                skill=name, candidate_score=candidate_score, required_score=required_score,
                gap_percentage=max(0, round(required_score - candidate_score, 1)),
                recommendation=f"Improve {name} with practical exercises focused on the role requirement."))
