from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class LogLineResponse(BaseModel):
    id: UUID
    deployment_id: UUID
    sequence: int
    line: str
    emitted_at: datetime

    model_config = {"from_attributes": True}
