"""Deterministic scoring & matching engine — the platform's "AI" for the MVP.

Everything here is pure, explainable, and testable. The blueprint's upgrade path
(swap skill overlap for embedding similarity) plugs in behind `skill_overlap_score`
without changing the public functions. See docs/00-TECHNICAL-BLUEPRINT.md §8.
"""
from __future__ import annotations

from typing import Iterable

# --- weightings (tuned, sum to 1.0 within each score) ------------------------

EDUCATION_POINTS = {
    "Below 12th": 20,
    "12th Pass": 35,
    "Diploma": 55,
    "Graduate": 75,
    "Post Graduate": 95,
}

EMPLOYABILITY_WEIGHTS = {
    "education": 0.30,
    "experience": 0.20,
    "skill_coverage": 0.30,
    "resume": 0.10,
    "verification": 0.10,
}

MATCH_WEIGHTS = {
    "skills": 0.55,
    "experience": 0.20,
    "location": 0.15,
    "salary": 0.10,
}


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def band_for_score(score: float) -> str:
    """Human label for a 0-100 score (matches the deck's gauge labels)."""
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Average"
    return "Needs Improvement"


def education_score(education_level: str | None) -> float:
    return EDUCATION_POINTS.get(education_level or "", 20)


def experience_score(years: float) -> float:
    """Diminishing returns: 0y=0, ~3y≈75, 5y+ ≈ 100."""
    if years <= 0:
        return 0.0
    return _clamp(100 * (1 - pow(2.718281828, -0.45 * years)))


def skill_coverage_score(youth_skill_ids: Iterable[int],
                         demand: dict[int, float]) -> float:
    """Share of constituency demand (weighted) that the youth already covers."""
    if not demand:
        return 50.0  # no demand signal -> neutral
    total = sum(demand.values())
    have = sum(w for sid, w in demand.items() if sid in set(youth_skill_ids))
    return _clamp(100 * have / total) if total else 0.0


# A candidate holding ~this much demand-weighted skill is considered strong.
# Used for the *employability* signal (individual strength), whereas
# skill_coverage_score measures coverage of the whole market (used elsewhere).
TARGET_SKILL_STRENGTH = 28.0


def skill_strength_score(youth_skill_ids: Iterable[int],
                         demand: dict[int, float]) -> float:
    """How much in-demand skill the youth holds, vs a 'strong candidate' target."""
    if not demand:
        return 50.0
    have = sum(w for sid, w in demand.items() if sid in set(youth_skill_ids))
    return _clamp(100 * have / TARGET_SKILL_STRENGTH)


def resume_score(has_resume: bool, experience_years: float,
                 skill_count: int) -> float:
    pts = 0.0
    if has_resume:
        pts += 60
    if experience_years > 0:
        pts += 20
    if skill_count >= 3:
        pts += 20
    return _clamp(pts)


def verification_score(status: str | None) -> float:
    return {"verified": 100, "pending": 50}.get(status or "unverified", 20)


def employability_score(*, education_level: str | None, experience_years: float,
                        youth_skill_ids: Iterable[int], demand: dict[int, float],
                        has_resume: bool, skill_count: int,
                        verification_status: str | None) -> tuple[float, str]:
    """Composite 0-100 employability score + its band label."""
    w = EMPLOYABILITY_WEIGHTS
    score = (
        education_score(education_level) * w["education"]
        + experience_score(experience_years) * w["experience"]
        + skill_strength_score(youth_skill_ids, demand) * w["skill_coverage"]
        + resume_score(has_resume, experience_years, skill_count) * w["resume"]
        + verification_score(verification_status) * w["verification"]
    )
    score = round(_clamp(score))
    return score, band_for_score(score)


def skill_gap(youth_skill_ids: Iterable[int],
              demand: dict[int, float]) -> list[int]:
    """Demanded skill ids the youth lacks, ranked by demand weight (desc)."""
    have = set(youth_skill_ids)
    missing = [(sid, w) for sid, w in demand.items() if sid not in have]
    missing.sort(key=lambda t: t[1], reverse=True)
    return [sid for sid, _ in missing]


# --- job matching ------------------------------------------------------------

def skill_overlap_score(youth_skill_ids: Iterable[int],
                        job_skill_weights: dict[int, float]) -> float:
    """Weighted fraction of a job's required skills that the youth has."""
    if not job_skill_weights:
        return 50.0
    total = sum(job_skill_weights.values())
    have = sum(w for sid, w in job_skill_weights.items()
               if sid in set(youth_skill_ids))
    return _clamp(100 * have / total) if total else 0.0


def experience_fit_score(youth_years: float, job_min_years: float) -> float:
    if youth_years >= job_min_years:
        return 100.0
    if job_min_years <= 0:
        return 100.0
    return _clamp(100 * youth_years / job_min_years)


def location_fit_score(youth_constituency_id: int | None,
                       job_constituency_id: int | None) -> float:
    """Local talent is preferred (the deck's whole premise)."""
    if youth_constituency_id and youth_constituency_id == job_constituency_id:
        return 100.0
    return 40.0


def salary_fit_score(job_salary_max: int | None) -> float:
    """Without a stated youth expectation we treat any posted band as a fit."""
    return 100.0 if job_salary_max else 70.0


def job_match_score(*, youth_skill_ids: Iterable[int],
                    job_skill_weights: dict[int, float],
                    youth_years: float, job_min_years: float,
                    youth_constituency_id: int | None,
                    job_constituency_id: int | None,
                    job_salary_max: int | None) -> float:
    """Composite 0-100 candidate<->job match score."""
    w = MATCH_WEIGHTS
    youth_skill_ids = list(youth_skill_ids)
    score = (
        skill_overlap_score(youth_skill_ids, job_skill_weights) * w["skills"]
        + experience_fit_score(youth_years, job_min_years) * w["experience"]
        + location_fit_score(youth_constituency_id, job_constituency_id) * w["location"]
        + salary_fit_score(job_salary_max) * w["salary"]
    )
    return round(_clamp(score))
