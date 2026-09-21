"""FastAPI application entrypoint for the Constituency Youth Employment Platform."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine, ensure_runtime_schema
from .enhancement_seed import ensure_enhancement_seed_data
from .routers import (
    admin_router,
    ai_router,
    assessment_router,
    auth_router,
    ecosystem_router,
    provider_router,
    recruiter_router,
    reference_router,
    youth_router,
)

# Create tables on startup (SQLite demo — no migrations needed).
Base.metadata.create_all(bind=engine)
ensure_runtime_schema()
ensure_enhancement_seed_data()

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(reference_router.router)
app.include_router(ai_router.router)
app.include_router(assessment_router.router)
app.include_router(ecosystem_router.router)
app.include_router(youth_router.router)
app.include_router(recruiter_router.router)
app.include_router(provider_router.router)
app.include_router(admin_router.router)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok", "app": settings.app_name}
