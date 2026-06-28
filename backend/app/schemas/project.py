from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, HttpUrl, field_validator


class ProjectCreate(BaseModel):
    name: str
    repo_url: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Project name cannot be empty")
        return v

    @field_validator("repo_url")
    @classmethod
    def repo_url_must_be_github(cls, v: str) -> str:
        if not v.startswith("https://github.com/") and not v.startswith("http://github.com/"):
            raise ValueError("repo_url must be a GitHub URL (https://github.com/...)")
        return v


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    repo_url: Optional[str] = None


class ProjectResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    repo_url: str
    created_at: datetime

    model_config = {"from_attributes": True}
