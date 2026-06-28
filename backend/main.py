"""
Entry point for the Ascend backend API.

Run with:
    uvicorn main:app --reload --port 8000
Or from the backend/ directory:
    uvicorn app.main:app --reload --port 8000
"""
from app.main import app  # noqa: F401 — re-export for uvicorn

__all__ = ["app"]
