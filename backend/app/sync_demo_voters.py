"""Attach a few real Supabase voter rows to existing demo youth records."""
from __future__ import annotations

from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import Application, User, YouthProfile
from .voters import list_sample_voters


def _pick_demo_youth(db: Session, limit: int) -> list[YouthProfile]:
    rows = (
        db.query(YouthProfile)
        .join(User, YouthProfile.user_id == User.id)
        .join(Application, Application.youth_id == YouthProfile.id)
        .filter(Application.stage.in_(["selected", "joined", "interview", "shortlisted"]))
        .order_by(YouthProfile.id.asc())
        .all()
    )

    unique: list[YouthProfile] = []
    seen: set[int] = set()
    for row in rows:
        if row.id in seen:
            continue
        unique.append(row)
        seen.add(row.id)
        if len(unique) >= limit:
            break
    return unique


def sync_demo_voters(limit: int = 5) -> int:
    db = SessionLocal()
    try:
        voters = list_sample_voters(limit=limit)
        youths = _pick_demo_youth(db, limit=len(voters))

        synced = 0
        for youth, voter in zip(youths, voters):
            youth.epic_number = voter["id_code"]
            youth.epic_verified = True
            youth.verification_status = "verified"
            youth.age = voter.get("age") or youth.age
            youth.gender = voter.get("gender") or youth.gender
            if youth.user:
                youth.user.name = voter["name"]
            synced += 1

        db.commit()
        return synced
    finally:
        db.close()


if __name__ == "__main__":
    count = sync_demo_voters()
    print(f"Synced {count} demo youth profiles with Supabase voter records.")
