import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.dependencies import get_current_user
from app.exceptions import ForbiddenException, NotFoundException
from app.models.deployment import Deployment
from app.models.deployment_log import DeploymentLog
from app.models.user import User
from app.schemas.log import LogLineResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["logs"])


@router.get(
    "/deployments/{deployment_id}/logs",
    response_model=list[LogLineResponse],
    summary="Stream deployment logs (long-poll friendly)",
)
async def get_logs(
    deployment_id: UUID,
    since: int = Query(0, ge=0, description="Return logs with sequence number >= since (for incremental polling)"),
    limit: int = Query(200, ge=1, le=1000, description="Maximum number of log lines to return"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DeploymentLog]:
    """
    Retrieve deployment log lines.

    Supports incremental polling via `since`:
    - First call: `GET /deployments/{id}/logs` → returns all logs from sequence 0
    - Subsequent: `GET /deployments/{id}/logs?since=50` → returns only new lines

    Results are ordered by `sequence` ascending.
    """
    # Verify user owns this deployment's project
    stmt = (
        select(Deployment)
        .options(selectinload(Deployment.project))
        .where(Deployment.id == deployment_id)
    )
    result = await db.execute(stmt)
    deployment = result.scalar_one_or_none()

    if not deployment:
        raise NotFoundException("Deployment")

    if deployment.project.user_id != current_user.id:
        raise ForbiddenException()

    # Fetch logs with sequence >= since
    log_stmt = (
        select(DeploymentLog)
        .where(
            (DeploymentLog.deployment_id == deployment_id)
            & (DeploymentLog.sequence >= since)
        )
        .order_by(DeploymentLog.sequence.asc())
        .limit(limit)
    )
    log_result = await db.execute(log_stmt)
    logs = list(log_result.scalars().all())

    logger.debug("Returning %d log lines for deployment %s (since=%d)", len(logs), deployment_id, since)
    return logs
