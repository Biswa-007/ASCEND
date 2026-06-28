from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class DeploymentStatusEnum(str, Enum):
    PENDING = "pending"
    BUILDING = "building"
    RUNNING = "running"
    FAILED = "failed"
    STOPPED = "stopped"


class DeploymentCreate(BaseModel):
    """No input body needed — status starts as pending automatically."""
    pass


class DeploymentResponse(BaseModel):
    id: UUID
    project_id: UUID
    status: DeploymentStatusEnum
    container_id: Optional[str] = None
    image_tag: Optional[str] = None
    port: Optional[int] = None
    public_url: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
