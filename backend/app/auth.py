"""Authentication: mock phone-OTP + JWT sessions.

Identity anchor is the phone number (see blueprint §4). OTP is generated and,
in demo mode, returned to the client to be shown on-screen instead of by SMS.
"""
import hashlib
import hmac
import random
import secrets
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import OtpCode, User, YouthProfile

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    ).hex()
    return f"{salt}${digest}"


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash or "$" not in password_hash:
        return False
    salt, expected = password_hash.split("$", 1)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    ).hex()
    return hmac.compare_digest(digest, expected)


def generate_otp(db: Session, phone: str) -> str:
    """Create a fresh 6-digit OTP for a phone, invalidating older ones."""
    db.query(OtpCode).filter(OtpCode.phone == phone,
                             OtpCode.consumed == False).update(  # noqa: E712
        {"consumed": True})
    code = f"{random.randint(0, 999999):06d}"
    otp = OtpCode(
        phone=phone,
        code=code,
        expires_at=datetime.utcnow() + timedelta(seconds=settings.otp_ttl_seconds),
    )
    db.add(otp)
    db.commit()
    return code


def verify_otp(db: Session, phone: str, code: str) -> bool:
    otp = (
        db.query(OtpCode)
        .filter(OtpCode.phone == phone, OtpCode.consumed == False)  # noqa: E712
        .order_by(OtpCode.id.desc())
        .first()
    )
    if not otp or otp.expires_at < datetime.utcnow():
        return False
    if otp.code != code:
        return False
    otp.consumed = True
    db.commit()
    return True


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def authenticate_youth_by_voter_id(db: Session, voter_id: str, password: str) -> User | None:
    normalized = voter_id.strip().upper()
    if not normalized:
        return None
    user = (
        db.query(User)
        .join(YouthProfile, YouthProfile.user_id == User.id)
        .filter(User.role == "youth")
        .filter(YouthProfile.epic_number == normalized)
        .first()
    )
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def authenticate_staff_by_email(db: Session, email: str, password: str) -> User | None:
    normalized = email.strip().lower()
    if not normalized:
        return None
    user = db.query(User).filter(User.email == normalized, User.role.in_(["recruiter", "provider", "admin"])).first()
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = jwt.decode(
            creds.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def require_role(*roles: str):
    """Dependency factory enforcing role-based access server-side."""
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return checker
