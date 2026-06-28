import uuid

from enum import Enum as PyEnum
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class DeploymentStatus(str, PyEnum):
    PENDING = "pending"
    BUILDING = "building"
    RUNNING = "running"
    FAILED = "failed"
    STOPPED = "stopped"


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(
        Enum(DeploymentStatus, name="deploymentstatus"),
        default=DeploymentStatus.PENDING,
        nullable=False,
    )
    container_id = Column(String(255), nullable=True)
    image_tag = Column(String(255), nullable=True)
    port = Column(Integer, nullable=True)  # Allocated host port (8001–8999)
    public_url = Column(String(255), nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    stopped_at = Column(DateTime, nullable=True)
    created_at = Column(
      DateTime(timezone=True),
      default=lambda: datetime.now(timezone.utc),
      nullable=False,
    )

    # Relationships
    project = relationship("Project", back_populates="deployments")
    logs = relationship(
       "DeploymentLog",
       back_populates="deployment",
       cascade="all, delete-orphan",
       lazy="raise",
    )

    def __repr__(self) -> str:
        return f"<Deployment id={self.id} status={self.status}>"
