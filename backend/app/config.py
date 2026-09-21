"""Application configuration.

Demo prototype: secrets are static/local-only. In production these come from
the environment and are never committed.
"""
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "JobNadu"
    database_url: str = "sqlite:///./cyep.db"
    jwt_secret: str = "demo-only-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days
    otp_ttl_seconds: int = 300  # 5 minutes
    # Demo convenience: the OTP is returned in the API response and shown
    # on-screen instead of being sent over SMS.
    otp_demo_mode: bool = True
    cors_origins: str = "http://localhost:3000"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_verify_ssl: bool = True
    assessment_ai_mode: str = "auto"  # auto uses Gemini when configured; deterministic is offline-safe
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_verify_ssl: bool = False
    voter_excel_path: str | None = str(
        Path(__file__).resolve().parents[4] / "AC_23_SIR_FINAL_2026_SAMPLE.xlsx"
    )

    class Config:
        env_file = ".env"


settings = Settings()
