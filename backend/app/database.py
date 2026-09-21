"""Database engine, session, and declarative base."""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

# SQLite needs check_same_thread=False for FastAPI's threadpool; Postgres
# (Supabase) must NOT receive that arg. Detect from the URL.
_is_sqlite = settings.database_url.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    pool_pre_ping=not _is_sqlite,  # recycle dropped Supabase pooler connections
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_runtime_schema():
    """Apply tiny runtime patches for the local demo without migrations."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    user_columns = {col["name"] for col in inspector.get_columns("users")}
    if "email" not in user_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR"))
    if "password_hash" not in user_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR"))

    youth_columns = {col["name"] for col in inspector.get_columns("youth_profiles")}
    youth_additions = {
        "rural_resident": "BOOLEAN DEFAULT FALSE",
        "differently_abled": "BOOLEAN DEFAULT FALSE",
        "assisted_access": "BOOLEAN DEFAULT FALSE",
        "preferred_language": "VARCHAR DEFAULT 'English'",
        "mobility_preference": "VARCHAR DEFAULT 'Within district'",
        "expected_salary": "INTEGER",
        "candidate_category": "VARCHAR DEFAULT 'IT'",
        "target_role": "VARCHAR",
        "notice_period_days": "INTEGER DEFAULT 0",
        "certificates": "TEXT",
    }
    for column, definition in youth_additions.items():
        if column not in youth_columns:
            with engine.begin() as conn:
                conn.execute(text(
                    f"ALTER TABLE youth_profiles ADD COLUMN {column} {definition}"
                ))


def get_db():
    """FastAPI dependency that yields a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
