import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class DeploymentLog(Base):
    __tablename__ = "deployment_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deployment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("deployments.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence = Column(Integer, nullable=False)  # Monotonic counter for ordering
    line = Column(Text, nullable=False)
    emitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Composite index for efficient log polling
    __table_args__ = (
        Index("idx_deployment_sequence", "deployment_id", "sequence"),
    )

    # Relationship
    deployment = relationship("Deployment", back_populates="logs")

    def __repr__(self) -> str:
        return f"<DeploymentLog deployment_id={self.deployment_id} seq={self.sequence}>"
