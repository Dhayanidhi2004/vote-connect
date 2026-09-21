"""Integrated employment ecosystem: guidance, mentors, opportunities, and feedback loops."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import require_role
from ..database import get_db
from ..models import (
    CareerAssessment,
    DemandForecast,
    EmployerSupportRequest,
    EmploymentOpportunity,
    IntegrationStatus,
    Job,
    Mentor,
    Mentorship,
    OpportunityApplication,
    Reminder,
    Skill,
    SkillDemand,
    User,
    YouthProfile,
    YouthSkill,
)
from ..schemas import (
    CareerAssessmentIn,
    CareerAssessmentOut,
    DemandForecastOut,
    EcosystemOverviewOut,
    EmployerSupportIn,
    EmployerSupportOut,
    IntegrationStatusOut,
    MentorOut,
    MentorshipIn,
    MentorshipOut,
    OpportunityApplicationOut,
    OpportunityOut,
    PolicyRecommendationOut,
    ReminderOut,
    SkillSupplyGapOut,
)

router = APIRouter(prefix="/api/ecosystem", tags=["integrated ecosystem"])


def _profile(db: Session, user: User) -> YouthProfile:
    row = db.query(YouthProfile).filter(YouthProfile.user_id == user.id).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Youth profile not found")
    return row


def _mentor_out(row: Mentorship) -> MentorshipOut:
    out = MentorshipOut.model_validate(row)
    out.mentor_name = row.mentor.name if row.mentor else ""
    out.mentor_expertise = row.mentor.expertise if row.mentor else ""
    return out


def _opportunity_out(row: EmploymentOpportunity, interested: set[int]) -> OpportunityOut:
    out = OpportunityOut.model_validate(row)
    out.already_interested = row.id in interested
    return out


def _application_out(row: OpportunityApplication) -> OpportunityApplicationOut:
    out = OpportunityApplicationOut.model_validate(row)
    out.opportunity_title = row.opportunity.title if row.opportunity else ""
    out.category = row.opportunity.category if row.opportunity else ""
    return out


def _forecasts(db: Session, constituency_id: int | None) -> list[DemandForecastOut]:
    if not constituency_id:
        return []
    rows = (
        db.query(DemandForecast)
        .filter(DemandForecast.constituency_id == constituency_id)
        .order_by(DemandForecast.forecast_6m.desc())
        .all()
    )
    if rows:
        return [DemandForecastOut(
            skill_id=row.skill_id,
            skill_name=row.skill.name if row.skill else "",
            current_demand=row.current_demand,
            forecast_6m=row.forecast_6m,
            trend=row.trend,
            shortage_roles=row.shortage_roles,
        ) for row in rows]

    demand = (
        db.query(SkillDemand, Skill)
        .join(Skill, SkillDemand.skill_id == Skill.id)
        .filter(SkillDemand.constituency_id == constituency_id)
        .order_by(SkillDemand.demand_weight.desc())
        .all()
    )
    return [DemandForecastOut(
        skill_id=skill.id,
        skill_name=skill.name,
        current_demand=round(row.demand_weight, 1),
        forecast_6m=round(row.demand_weight * 1.12, 1),
        trend="rising" if index < 5 else "stable",
        shortage_roles=max(1, round(row.demand_weight * 3)),
    ) for index, (row, skill) in enumerate(demand)]


@router.get("/youth/overview", response_model=EcosystemOverviewOut)
def youth_overview(user: User = Depends(require_role("youth")),
                   db: Session = Depends(get_db)):
    youth = _profile(db, user)
    applications = (
        db.query(OpportunityApplication)
        .filter(OpportunityApplication.youth_id == youth.id)
        .order_by(OpportunityApplication.created_at.desc())
        .all()
    )
    interested = {row.opportunity_id for row in applications}
    opportunities = (
        db.query(EmploymentOpportunity)
        .filter(EmploymentOpportunity.verification_status == "verified")
        .all()
    )
    opportunities.sort(key=lambda row: (
        not (youth.rural_resident and row.rural_friendly),
        not (youth.gender == "Female" and row.women_focused),
        row.category,
    ))
    mentorships = (
        db.query(Mentorship)
        .filter(Mentorship.youth_id == youth.id)
        .order_by(Mentorship.created_at.desc())
        .all()
    )
    reminders = (
        db.query(Reminder)
        .filter(Reminder.user_id == user.id)
        .order_by(Reminder.is_read, Reminder.due_at, Reminder.created_at.desc())
        .limit(20)
        .all()
    )
    return EcosystemOverviewOut(
        assessment=(CareerAssessmentOut.model_validate(youth.career_assessment)
                    if youth.career_assessment else None),
        forecasts=_forecasts(db, youth.constituency_id),
        mentors=[MentorOut.model_validate(row) for row in
                 db.query(Mentor).filter(Mentor.active == True).all()],  # noqa
        mentorships=[_mentor_out(row) for row in mentorships],
        opportunities=[_opportunity_out(row, interested) for row in opportunities],
        applications=[_application_out(row) for row in applications],
        reminders=[ReminderOut.model_validate(row) for row in reminders],
        integrations=[IntegrationStatusOut.model_validate(row) for row in
                      db.query(IntegrationStatus).order_by(IntegrationStatus.id).all()],
    )


@router.put("/youth/assessment", response_model=CareerAssessmentOut)
def save_assessment(body: CareerAssessmentIn,
                    user: User = Depends(require_role("youth")),
                    db: Session = Depends(get_db)):
    youth = _profile(db, user)
    row = youth.career_assessment or CareerAssessment(youth_id=youth.id)
    for field, value in body.model_dump().items():
        setattr(row, field, value)
    completion = sum(bool(value) for value in [
        body.aptitude_area, body.interests, body.preferred_sectors,
        body.mobility, body.wage_expectation,
    ])
    row.suitability_score = min(100, round(
        35 + completion * 9 + min(len(youth.skills), 5) * 4
    ))
    youth.mobility_preference = body.mobility or youth.mobility_preference
    youth.expected_salary = body.wage_expectation or youth.expected_salary
    db.add(row)
    db.add(Reminder(
        user_id=user.id,
        title="Review your personalised career roadmap",
        message="Use the forecast, mentor, and opportunity matches generated from your assessment.",
        reminder_type="career_plan",
        due_at=datetime.utcnow() + timedelta(days=2),
        action_url="/youth/pathway",
    ))
    db.commit()
    db.refresh(row)
    return CareerAssessmentOut.model_validate(row)


@router.post("/youth/mentorships", response_model=MentorshipOut,
             status_code=status.HTTP_201_CREATED)
def request_mentor(body: MentorshipIn,
                   user: User = Depends(require_role("youth")),
                   db: Session = Depends(get_db)):
    youth = _profile(db, user)
    mentor = db.get(Mentor, body.mentor_id)
    if mentor is None or not mentor.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mentor not available")
    existing = db.query(Mentorship).filter(
        Mentorship.youth_id == youth.id, Mentorship.mentor_id == mentor.id
    ).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Mentor already requested")
    row = Mentorship(
        youth_id=youth.id, mentor_id=mentor.id, goal=body.goal,
        status="active", next_session_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(row)
    db.add(Reminder(
        user_id=user.id,
        title=f"Mentor session with {mentor.name}",
        message=body.goal or f"Career mentoring for {mentor.expertise}",
        reminder_type="mentor",
        due_at=row.next_session_at,
        action_url="/youth/pathway",
    ))
    db.commit()
    db.refresh(row)
    return _mentor_out(row)


@router.post("/youth/opportunities/{opportunity_id}/interest",
             response_model=OpportunityApplicationOut,
             status_code=status.HTTP_201_CREATED)
def express_interest(opportunity_id: int,
                     user: User = Depends(require_role("youth")),
                     db: Session = Depends(get_db)):
    youth = _profile(db, user)
    opportunity = db.get(EmploymentOpportunity, opportunity_id)
    if opportunity is None or opportunity.verification_status != "verified":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity not found")
    existing = db.query(OpportunityApplication).filter(
        OpportunityApplication.youth_id == youth.id,
        OpportunityApplication.opportunity_id == opportunity_id,
    ).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Interest already recorded")
    row = OpportunityApplication(
        youth_id=youth.id, opportunity_id=opportunity_id, status="referred"
    )
    db.add(row)
    db.add(Reminder(
        user_id=user.id,
        title=f"Follow up: {opportunity.title}",
        message="Complete the official provider application and verify all wage and safety terms.",
        reminder_type="opportunity",
        due_at=datetime.utcnow() + timedelta(days=3),
        action_url="/youth/pathway",
    ))
    db.commit()
    db.refresh(row)
    return _application_out(row)


@router.patch("/youth/opportunity-applications/{application_id}",
              response_model=OpportunityApplicationOut)
def update_opportunity(application_id: int, status_value: str,
                       monthly_income: int | None = None,
                       user: User = Depends(require_role("youth")),
                       db: Session = Depends(get_db)):
    youth = _profile(db, user)
    row = db.get(OpportunityApplication, application_id)
    if row is None or row.youth_id != youth.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity application not found")
    if status_value not in {"interested", "referred", "started", "completed"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid status")
    row.status = status_value
    row.monthly_income = monthly_income
    db.commit()
    db.refresh(row)
    return _application_out(row)


@router.patch("/youth/reminders/{reminder_id}/read", response_model=ReminderOut)
def read_reminder(reminder_id: int,
                  user: User = Depends(require_role("youth")),
                  db: Session = Depends(get_db)):
    row = db.get(Reminder, reminder_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reminder not found")
    row.is_read = True
    db.commit()
    db.refresh(row)
    return ReminderOut.model_validate(row)


@router.get("/recruiter/skill-supply-gap", response_model=list[SkillSupplyGapOut])
def recruiter_skill_gap(user: User = Depends(require_role("recruiter")),
                        db: Session = Depends(get_db)):
    jobs = db.query(Job).filter(
        Job.org_id == user.recruiter_org_id, Job.status == "active"
    ).all()
    openings: dict[int, int] = {}
    for job in jobs:
        for required in job.skills:
            openings[required.skill_id] = openings.get(required.skill_id, 0) + 1
    supply_counts: dict[int, int] = {}
    for skill_id, _ in db.query(YouthSkill.skill_id, YouthSkill.youth_id).all():
        supply_counts[skill_id] = supply_counts.get(skill_id, 0) + 1
    rows = []
    for skill_id, count in openings.items():
        skill = db.get(Skill, skill_id)
        available = supply_counts.get(skill_id, 0)
        rows.append(SkillSupplyGapOut(
            skill_id=skill_id,
            skill_name=skill.name if skill else "",
            openings=count,
            available_youth=available,
            shortage=max(0, count * 3 - available),
        ))
    rows.sort(key=lambda row: row.shortage, reverse=True)
    return rows


@router.get("/recruiter/forecasts", response_model=list[DemandForecastOut])
def recruiter_forecasts(user: User = Depends(require_role("recruiter")),
                        db: Session = Depends(get_db)):
    org = user.recruiter_org
    return _forecasts(db, org.constituency_id if org else None)


@router.get("/recruiter/support", response_model=list[EmployerSupportOut])
def support_requests(user: User = Depends(require_role("recruiter")),
                     db: Session = Depends(get_db)):
    return db.query(EmployerSupportRequest).filter(
        EmployerSupportRequest.org_id == user.recruiter_org_id
    ).order_by(EmployerSupportRequest.created_at.desc()).all()


@router.post("/recruiter/support", response_model=EmployerSupportOut,
             status_code=status.HTTP_201_CREATED)
def request_support(body: EmployerSupportIn,
                    user: User = Depends(require_role("recruiter")),
                    db: Session = Depends(get_db)):
    if body.request_type not in {"job_description", "screening", "apprenticeship", "job_fair"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid support request")
    row = EmployerSupportRequest(
        org_id=user.recruiter_org_id,
        request_type=body.request_type,
        description=body.description,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/integrations", response_model=list[IntegrationStatusOut])
def integrations(user: User = Depends(require_role("admin", "recruiter", "provider", "youth")),
                 db: Session = Depends(get_db)):
    return db.query(IntegrationStatus).order_by(IntegrationStatus.id).all()


@router.get("/admin/policy-recommendations", response_model=list[PolicyRecommendationOut])
def policy_recommendations(user: User = Depends(require_role("admin")),
                           db: Session = Depends(get_db)):
    primary = db.query(YouthProfile).filter(YouthProfile.onboarding_complete == True).all()  # noqa
    rural = sum(bool(row.rural_resident) for row in primary)
    assessments = db.query(CareerAssessment).count()
    completed_experience = db.query(OpportunityApplication).filter(
        OpportunityApplication.status == "completed"
    ).count()
    active_mentors = db.query(Mentorship).filter(Mentorship.status == "active").count()
    forecasts = _forecasts(db, primary[0].constituency_id if primary else None)
    top = forecasts[0] if forecasts else None
    return [
        PolicyRecommendationOut(
            priority="high",
            title="Close the highest forecast skill shortage",
            evidence=(f"{top.skill_name}: {top.shortage_roles} forecast shortage roles"
                      if top else "Forecast data is still sparse"),
            action="Align provider capacity and require an employer project or apprenticeship.",
        ),
        PolicyRecommendationOut(
            priority="high" if assessments < len(primary) else "medium",
            title="Complete guidance before training",
            evidence=f"{assessments} assessments for {len(primary)} active youth",
            action="Use assisted centres and reminders to complete aptitude, mobility, and wage guidance.",
        ),
        PolicyRecommendationOut(
            priority="medium",
            title="Increase rural and first-work participation",
            evidence=f"{rural} rural profiles; {completed_experience} completed experience pathways",
            action="Expand rural-friendly gigs, local apprenticeships, transport support, and employer desks.",
        ),
        PolicyRecommendationOut(
            priority="medium" if active_mentors else "high",
            title="Scale the mentor network",
            evidence=f"{active_mentors} active mentorships",
            action="Recruit industry mentors for high-demand sectors and Tamil-language guidance.",
        ),
    ]
