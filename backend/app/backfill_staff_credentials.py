"""Backfill demo emails/passwords for seeded staff accounts."""
from __future__ import annotations

from .auth import hash_password
from .database import SessionLocal, ensure_runtime_schema
from .models import User


STAFF_CREDENTIALS = {
    "9000000001": ("mla@jobnadu.demo", "demo123"),
    "9000000002": ("zoho@jobnadu.demo", "demo123"),
    "9000000007": ("skills@jobnadu.demo", "demo123"),
}


def backfill_staff_credentials() -> int:
    ensure_runtime_schema()
    db = SessionLocal()
    try:
        updated = 0
        for phone, (email, password) in STAFF_CREDENTIALS.items():
            user = db.query(User).filter(User.phone == phone).first()
            if user is None:
                continue
            changed = False
            if user.email != email:
                user.email = email
                changed = True
            if not user.password_hash:
                user.password_hash = hash_password(password)
                changed = True
            if changed:
                updated += 1
        db.commit()
        return updated
    finally:
        db.close()


if __name__ == "__main__":
    print(f"Updated {backfill_staff_credentials()} staff accounts.")
