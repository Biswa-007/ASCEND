import logging
from uuid import UUID

from datetime import datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from worker.jobs.run import stop_container, remove_container

from app.core.database import get_db
from app.dependencies import get_current_user
from app.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.models.deployment import Deployment, DeploymentStatus
from app.models.project import Project
from app.models.user import User
from app.schemas.deployment import DeploymentResponse
from worker.queue import deployment_queue

logger = logging.getLogger(__name__)

router = APIRouter(tags=["deployments"])


@router.post(
    "/projects/{project_id}/deployments",
    response_model=DeploymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Trigger a new deployment for a project",
)
async def create_deployment(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Deployment:
    project = await _get_user_project(project_id, current_user, db)

    active = await db.execute(
        select(Deployment).where(
            (Deployment.project_id == project_id)
            & Deployment.status.in_(
                [DeploymentStatus.PENDING, DeploymentStatus.BUILDING]
            )
        )
    )
    if active.scalar_one_or_none():
        raise ConflictException("A deployment is already in progress for this project")

    deployment = Deployment(
        project_id=project_id,
        status=DeploymentStatus.PENDING,
    )
    db.add(deployment)
    await db.commit()
    await db.refresh(deployment)

    logger.info(
        "Deployment created: %s for project %s (user=%s)",
        deployment.id, project.id, current_user.id,
    )

    deployment_queue.put_nowait(deployment.id)
    logger.info("Deployment %s enqueued for worker", deployment.id)

    return deployment


@router.get(
    "/projects/{project_id}/deployments",
    response_model=list[DeploymentResponse],
    summary="List all deployments for a project",
)
async def list_deployments(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Deployment]:
    await _get_user_project(project_id, current_user, db)

    stmt = (
        select(Deployment)
        .where(Deployment.project_id == project_id)
        .order_by(Deployment.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/deployments/{deployment_id}",
    response_model=DeploymentResponse,
    summary="Get a deployment by ID",
)
async def get_deployment(
    deployment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Deployment:
    deployment = await _get_user_deployment(deployment_id, current_user, db)
    return deployment


@router.post(
    "/deployments/{deployment_id}/stop",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Stop a running deployment",
)
async def stop_deployment(
    deployment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    deployment = await _get_user_deployment(deployment_id, current_user, db)

    stoppable = {
        DeploymentStatus.PENDING,
        DeploymentStatus.BUILDING,
        DeploymentStatus.RUNNING,
    }

    if deployment.status not in stoppable:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot stop a deployment with status '{deployment.status}'",
        )
    
    if deployment.container_id:
        try:
            await stop_container(deployment.container_id)
        except Exception:
            logger.exception("Failed to stop container %s", deployment.container_id)

        try:
            await remove_container(deployment.container_id)
        except Exception:
            logger.exception("Failed to remove container %s", deployment.container_id)


    deployment.status = DeploymentStatus.STOPPED

    now = datetime.utcnow()
    deployment.finished_at = now
    deployment.stopped_at = now

    await db.commit()

    logger.info("Deployment stopped: %s (user=%s)", deployment_id, current_user.id)


async def _get_user_project(project_id: UUID, current_user: User, db: AsyncSession) -> Project:
    stmt = select(Project).where(
        (Project.id == project_id) & (Project.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise NotFoundException("Project")
    return project


async def _get_user_deployment(deployment_id: UUID, current_user: User, db: AsyncSession) -> Deployment:
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

    return deployment