"""Public reference data used across portals and the registration wizard."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Constituency, Skill, TrainingProgram
from ..schemas import ConstituencyOut, SkillOut, TrainingProgramOut

router = APIRouter(prefix="/api/reference", tags=["reference"])


@router.get("/skills", response_model=list[SkillOut])
def skills(db: Session = Depends(get_db)):
    return [SkillOut.model_validate(s)
            for s in db.query(Skill).order_by(Skill.name).all()]


@router.get("/constituencies", response_model=list[ConstituencyOut])
def constituencies(db: Session = Depends(get_db)):
    return [ConstituencyOut.model_validate(c)
            for c in db.query(Constituency).order_by(Constituency.name).all()]


@router.get("/training", response_model=list[TrainingProgramOut])
def training(db: Session = Depends(get_db)):
    rows = (
        db.query(TrainingProgram)
        .filter(TrainingProgram.verification_status == "verified")
        .all()
    )
    return [TrainingProgramOut.model_validate(t) for t in rows]
