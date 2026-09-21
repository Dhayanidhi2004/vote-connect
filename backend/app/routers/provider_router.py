"""Training-provider portal: submit courses/certifications for admin verification."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_role
from ..database import get_db
from ..models import Skill, TrainingProgram, User
from ..schemas import TrainingProgramIn, TrainingProgramOut

router = APIRouter(prefix="/api/provider", tags=["provider"])


def _serialize(db: Session, t: TrainingProgram) -> TrainingProgramOut:
    out = TrainingProgramOut.model_validate(t)
    if t.target_skill_id:
        s = db.get(Skill, t.target_skill_id)
        out.target_skill_name = s.name if s else None
    return out


@router.get("/programs", response_model=list[TrainingProgramOut])
def my_programs(user: User = Depends(require_role("provider")),
                db: Session = Depends(get_db)):
    rows = (
        db.query(TrainingProgram)
        .filter(TrainingProgram.submitted_by_user_id == user.id)
        .order_by(TrainingProgram.id.desc())
        .all()
    )
    return [_serialize(db, t) for t in rows]


@router.post("/programs", response_model=TrainingProgramOut, status_code=201)
def submit_program(body: TrainingProgramIn,
                   user: User = Depends(require_role("provider")),
                   db: Session = Depends(get_db)):
    t = TrainingProgram(
        **body.model_dump(),
        verification_status="pending",
        submitted_by_user_id=user.id,
    )
    # Default the displayed provider name to the submitting provider.
    if not t.provider:
        t.provider = user.name
    db.add(t)
    db.commit()
    db.refresh(t)
    return _serialize(db, t)
