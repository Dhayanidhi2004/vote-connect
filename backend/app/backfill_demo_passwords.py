"""Set a demo password for existing youth accounts that do not have one yet."""
from __future__ import annotations

from .auth import hash_password
from .database import SessionLocal, ensure_runtime_schema
from .models import User


DEMO_YOUTH_PHONES = {
    "9000000003",
    "9000000010",
    "9000000011",
    "9000000012",
    "9000000013",
}


def backfill_demo_passwords(default_password: str = "demo123") -> int:
    ensure_runtime_schema()
    db = SessionLocal()
    try:
        rows = (
            db.query(User)
            .filter(User.role == "youth", User.phone.in_(DEMO_YOUTH_PHONES))
            .all()
        )
        updated = 0
        for row in rows:
            if row.password_hash:
                continue
            row.password_hash = hash_password(default_password)
            updated += 1
        db.commit()
        return updated
    finally:
        db.close()


if __name__ == "__main__":
    count = backfill_demo_passwords()
    print(f"Updated {count} demo youth passwords.")
