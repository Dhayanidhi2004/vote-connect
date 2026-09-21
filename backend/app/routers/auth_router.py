"""Auth endpoints: request OTP, verify OTP (login or signup), current user."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import auth as auth_lib
from ..database import get_db
from ..models import AuditLog, ConsentRecord, RecruiterOrg, User, YouthProfile
from ..schemas import (
    AuthResponse,
    OtpRequest,
    OtpRequestResponse,
    OtpVerify,
    StaffPasswordLogin,
    YouthPasswordLogin,
    VoterRecordOut,
    UserOut,
)
from ..voters import VoterConfigError, VoterLookupError, find_voter_by_id_code

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/voter-lookup/{voter_id}", response_model=VoterRecordOut)
def voter_lookup(voter_id: str, db: Session = Depends(get_db)):
    try:
        voter = find_voter_by_id_code(voter_id)
    except VoterConfigError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except VoterLookupError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    if voter is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Voter ID not found")
    normalized = str(voter["id_code"]).strip().upper()
    existing_profile = (
        db.query(YouthProfile, User)
        .join(User, User.id == YouthProfile.user_id)
        .filter(YouthProfile.epic_number == normalized)
        .first()
    )
    return VoterRecordOut(
        **voter,
        is_registered=existing_profile is not None,
        registered_youth_name=existing_profile[1].name if existing_profile else None,
    )


@router.post("/request-otp", response_model=OtpRequestResponse)
def request_otp(body: OtpRequest, db: Session = Depends(get_db)):
    phone = body.phone.strip()
    if not phone or len(phone) < 10:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter a valid phone number")
    code = auth_lib.generate_otp(db, phone)
    existing = db.query(User).filter(User.phone == phone).first()
    return OtpRequestResponse(
        phone=phone,
        demo_otp=code,  # demo only — shown on screen
        message="OTP generated. In this demo it is shown on screen.",
        is_new_user=existing is None,
    )


@router.post("/verify-otp", response_model=AuthResponse)
def verify_otp(body: OtpVerify, db: Session = Depends(get_db)):
    phone = body.phone.strip()
    if not auth_lib.verify_otp(db, phone, body.code.strip()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired OTP")

    user = db.query(User).filter(User.phone == phone).first()
    if user is None:
        # Sign-up path: need name + role.
        if not body.role:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "New account: role is required",
            )
        if body.role not in ("youth", "recruiter", "provider"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role")

        voter = None
        resolved_name = body.name.strip() if body.name else ""
        if body.role == "youth":
            if not body.voter_id:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Voter ID is required for youth signup")
            if not body.password or len(body.password) < 6:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 6 characters")
            try:
                voter = find_voter_by_id_code(body.voter_id)
            except VoterConfigError as exc:
                raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
            except VoterLookupError as exc:
                raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
            if voter is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Voter ID not found")
            normalized_voter_id = str(voter["id_code"]).strip().upper()
            existing_profile = (
                db.query(YouthProfile)
                .filter(YouthProfile.epic_number == normalized_voter_id)
                .first()
            )
            if existing_profile is not None:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    "This voter ID is already linked to an existing youth account",
                )
            resolved_name = str(voter["name"]).strip()
        elif not resolved_name:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "New account: name is required")

        user = User(phone=phone, name=resolved_name, role=body.role)
        if body.role == "youth":
            user.password_hash = auth_lib.hash_password(body.password.strip())
        else:
            if not body.email:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email is required for staff signup")
            if not body.password or len(body.password) < 6:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 6 characters")
            user.email = body.email.strip().lower()
            user.password_hash = auth_lib.hash_password(body.password.strip())
        db.add(user)
        db.flush()

        if body.role == "youth":
            profile = YouthProfile(
                user_id=user.id,
                epic_number=str(voter["id_code"]).strip().upper() if voter else None,
                epic_verified=bool(voter),
                verification_status="verified" if voter else "unverified",
                age=voter.get("age") if voter else None,
                gender=voter.get("gender") if voter else None,
            )
            db.add(profile)
        elif body.role == "recruiter":
            org = RecruiterOrg(
                name=(body.org_name or f"{body.name}'s Company").strip(),
                verification_status="pending",
            )
            db.add(org)
            db.flush()
            user.recruiter_org_id = org.id
        # provider: no extra entity — training programs link via submitted_by_user_id

        db.add(ConsentRecord(user_id=user.id, purpose="account_and_data_processing"))
        db.add(AuditLog(actor_user_id=user.id, action="signup", target=body.role))
        db.commit()
        db.refresh(user)

    token = auth_lib.create_token(user)
    return AuthResponse(token=token, user=UserOut.model_validate(user))


@router.post("/youth-login", response_model=AuthResponse)
def youth_login(body: YouthPasswordLogin, db: Session = Depends(get_db)):
    user = auth_lib.authenticate_youth_by_voter_id(
        db,
        body.voter_id,
        body.password,
    )
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid voter ID or password")
    token = auth_lib.create_token(user)
    return AuthResponse(token=token, user=UserOut.model_validate(user))


@router.post("/staff-login", response_model=AuthResponse)
def staff_login(body: StaffPasswordLogin, db: Session = Depends(get_db)):
    user = auth_lib.authenticate_staff_by_email(db, body.email, body.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    token = auth_lib.create_token(user)
    return AuthResponse(token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(auth_lib.get_current_user)):
    return UserOut.model_validate(user)
