"""Gemini-backed helpers for structured AI guidance."""
from __future__ import annotations

import os
from contextlib import contextmanager
from time import sleep

from pydantic import BaseModel
from google import genai
from google.genai import types
import certifi
import requests

from .config import settings


class AIConfigError(RuntimeError):
    """Raised when the Gemini integration is not configured."""


_SSL_READY = False


def _configure_ssl() -> None:
    global _SSL_READY
    if _SSL_READY:
        return

    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
    os.environ.setdefault("CURL_CA_BUNDLE", certifi.where())

    try:
        import truststore

        truststore.inject_into_ssl()
    except Exception:
        # Keep the certifi path fallback if truststore is unavailable.
        pass

    _SSL_READY = True


@contextmanager
def _requests_tls_mode():
    if settings.gemini_verify_ssl:
        yield
        return

    original_session = requests.Session

    class InsecureSession(original_session):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.verify = False

    requests.Session = InsecureSession
    try:
        yield
    finally:
        requests.Session = original_session


def is_configured() -> bool:
    return bool(settings.gemini_api_key)


def status_payload() -> dict[str, object]:
    return {
        "provider": "gemini",
        "model": settings.gemini_model,
        "configured": is_configured(),
    }


def generate_structured(*, system_instruction: str, prompt: str, schema_model: type[BaseModel]) -> BaseModel:
    if not settings.gemini_api_key:
        raise AIConfigError("Gemini API key is not configured on the backend")

    _configure_ssl()
    with _requests_tls_mode():
        client = genai.Client(api_key=settings.gemini_api_key)
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model=settings.gemini_model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.4,
                        response_mime_type="application/json",
                        response_schema=schema_model,
                    ),
                )
                return schema_model.model_validate_json(response.text)
            except Exception as exc:
                last_error = exc
                if "503" not in str(exc) and "UNAVAILABLE" not in str(exc).upper():
                    raise
                if attempt < 2:
                    sleep(1.5 * (attempt + 1))

    if last_error is not None:
        raise last_error
    raise RuntimeError("Gemini request failed without a response")
