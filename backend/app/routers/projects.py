import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user
from app.exceptions import NotFoundException
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get(
    "",
    response_model=list[ProjectResponse],
    summary="List all projects for the current user",
)
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Project]:
    """Return all projects owned by the authenticated user."""
    stmt = select(Project).where(Project.user_id == current_user.id).order_by(Project.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """
    Create a new deployment project linked to the authenticated user.

    - `name`: Human-readable project name
    - `repo_url`: Must be a valid GitHub repository URL
    """
    new_project = Project(
        user_id=current_user.id,
        name=project_data.name,
        repo_url=project_data.repo_url,
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)

    logger.info("Project created: %s (id=%s) by user %s", new_project.name, new_project.id, current_user.id)
    return new_project


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Get a project by ID",
)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """Retrieve a specific project. Only the owner can access it."""
    project = await _get_user_project(project_id, current_user, db)
    return project


@router.patch(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Update a project",
)
async def update_project(
    project_id: UUID,
    update_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """Update project name and/or repo_url. Only provided fields are updated."""
    project = await _get_user_project(project_id, current_user, db)

    if update_data.name is not None:
        project.name = update_data.name
    if update_data.repo_url is not None:
        project.repo_url = update_data.repo_url

    await db.commit()
    await db.refresh(project)
    logger.info("Project updated: %s (id=%s)", project.name, project.id)
    return project


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project",
)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a project and all its deployments/logs (cascade).
    Only the owner can delete a project.
    """
    project = await _get_user_project(project_id, current_user, db)
    await db.delete(project)
    await db.commit()
    logger.info("Project deleted: %s (id=%s)", project.name, project.id)


async def _get_user_project(
    project_id: UUID,
    current_user: User,
    db: AsyncSession,
) -> Project:
    """Helper: fetch a project by ID and verify ownership."""
    stmt = select(Project).where(
        (Project.id == project_id) & (Project.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()

    if not project:
        raise NotFoundException("Project")

    return project
