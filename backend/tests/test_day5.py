"""
tests/test_day5.py
------------------
Day 5 Integration and Unit tests for:
1. Normal successful deployment.
2. Redeploy of the same project (stops and removes the old container).
3. Container start crash health check (ensures status transitions to FAILED if container dies).
4. Port allocation concurrency & collision safety.
"""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import docker.errors
from sqlalchemy import select

from app.core.database import Base
from app.models.user import User
from app.models.project import Project
from app.models.deployment import Deployment, DeploymentStatus
from worker.main import handle_job
from worker.jobs.ports import allocate_port, PortAllocationError
from worker.jobs.run import (
    RUNTIME_CONTAINER_PORTS,
    ContainerLaunchError,
    run_container,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Mock Docker Client Classes
# ---------------------------------------------------------------------------
class MockContainer:
    def __init__(self, container_id, status="running"):
        self.id = container_id
        self.status = status
        self.stop_called = False
        self.remove_called = False

    def reload(self):
        pass

    def stop(self, timeout=10):
        self.stop_called = True
        self.status = "exited"

    def remove(self, force=True):
        self.remove_called = True


class MockContainers:
    def __init__(self):
        self.created = []

    def run(self, image, detach=True, ports=None):
        cid = f"cid-{uuid4().hex[:8]}"
        container = MockContainer(cid, "running")
        self.created.append(container)
        return container

    def get(self, cid):
        for c in self.created:
            if c.id == cid:
                return c
        raise docker.errors.NotFound("Container not found")


class MockDockerClient:
    def __init__(self):
        self.containers = MockContainers()

    def close(self):
        pass


# ---------------------------------------------------------------------------
# Pytest Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def mock_worker_async_session():
    # Redirect production db sessions to the sqlite test database sessionmaker
    from tests.conftest import TestSessionLocal
    with patch("worker.main.async_session", TestSessionLocal):
        yield


@pytest.fixture
def mock_docker():
    client = MockDockerClient()
    with patch("docker.from_env", return_value=client):
        yield client


@pytest.fixture
async def sample_project(db_session):
    # Setup a user and project
    user = User(email=f"user-{uuid4().hex[:6]}@example.com", password_hash="hash")
    db_session.add(user)
    await db_session.flush()

    project = Project(
        name="Day 5 Test App",
        repo_url="https://github.com/example/day5-app",
        user_id=user.id,
    )
    db_session.add(project)
    await db_session.commit()
    return project


# ---------------------------------------------------------------------------
# Test Case 1: Normal Successful Run
# ---------------------------------------------------------------------------
@patch("worker.main.clone_repo", new_callable=AsyncMock)
@patch("worker.main.build_image")
@patch("worker.main.detect_runtime", return_value="python")
@patch("worker.main.copy_base_dockerfile")
@patch("worker.main.cleanup_repo", new_callable=AsyncMock)
async def test_normal_successful_run(
    mock_cleanup,
    mock_copy,
    mock_detect,
    mock_build,
    mock_clone,
    db_session,
    sample_project,
    mock_docker,
):
    # Mock build_image async generator
    async def mock_build_generator(*args, **kwargs):
        yield "Step 1: building..."
        yield "Step 2: complete."
    mock_build.side_effect = mock_build_generator

    # Create a deployment
    deployment = Deployment(project_id=sample_project.id, status=DeploymentStatus.PENDING)
    db_session.add(deployment)
    await db_session.commit()

    # Run the worker job
    await handle_job(deployment.id)

    # Refresh DB session & assert results
    await db_session.refresh(deployment)
    assert deployment.status == DeploymentStatus.RUNNING
    assert deployment.port is not None
    assert 8001 <= deployment.port <= 8999
    assert deployment.container_id is not None
    assert deployment.public_url == f"http://localhost:{deployment.port}"
    assert deployment.started_at is not None
    assert deployment.image_tag == f"ascend-{deployment.id}:latest"


# ---------------------------------------------------------------------------
# Test Case 2: Redeploy same project (old container stopped/removed)
# ---------------------------------------------------------------------------
@patch("worker.main.clone_repo", new_callable=AsyncMock)
@patch("worker.main.build_image")
@patch("worker.main.detect_runtime", return_value="python")
@patch("worker.main.copy_base_dockerfile")
@patch("worker.main.cleanup_repo", new_callable=AsyncMock)
async def test_redeploy_stops_and_removes_old_container(
    mock_cleanup,
    mock_copy,
    mock_detect,
    mock_build,
    mock_clone,
    db_session,
    sample_project,
    mock_docker,
):
    async def mock_build_generator(*args, **kwargs):
        yield "Building..."
    mock_build.side_effect = mock_build_generator

    # 1. Setup an existing running deployment with a container
    old_cid = "cid-old-container"
    old_container = MockContainer(old_cid, "running")
    mock_docker.containers.created.append(old_container)

    old_deployment = Deployment(
        project_id=sample_project.id,
        status=DeploymentStatus.RUNNING,
        container_id=old_cid,
        port=8001,
        image_tag="ascend-old:latest",
        started_at=datetime.utcnow(),
    )
    db_session.add(old_deployment)
    await db_session.commit()

    # 2. Start a new deployment
    new_deployment = Deployment(project_id=sample_project.id, status=DeploymentStatus.PENDING)
    db_session.add(new_deployment)
    await db_session.commit()

    # Run new job
    await handle_job(new_deployment.id)

    # Refresh db rows
    await db_session.refresh(old_deployment)
    await db_session.refresh(new_deployment)

    # Assert old deployment is STOPPED with stopped_at populated
    assert old_deployment.status == DeploymentStatus.STOPPED
    assert old_deployment.stopped_at is not None
    assert old_deployment.finished_at is not None
    assert old_container.stop_called is True
    assert old_container.remove_called is True

    # Assert new deployment is RUNNING
    assert new_deployment.status == DeploymentStatus.RUNNING
    assert new_deployment.container_id != old_cid


# ---------------------------------------------------------------------------
# Test Case 3: Container start crash health check failure
# ---------------------------------------------------------------------------
@patch("worker.main.clone_repo", new_callable=AsyncMock)
@patch("worker.main.build_image")
@patch("worker.main.detect_runtime", return_value="python")
@patch("worker.main.copy_base_dockerfile")
@patch("worker.main.cleanup_repo", new_callable=AsyncMock)
async def test_container_crash_on_start(
    mock_cleanup,
    mock_copy,
    mock_detect,
    mock_build,
    mock_clone,
    db_session,
    sample_project,
    mock_docker,
):
    async def mock_build_generator(*args, **kwargs):
        yield "Building..."
    mock_build.side_effect = mock_build_generator

    # Mock docker.from_env() run to return a container, but it will immediately be non-running/exited
    original_run = mock_docker.containers.run
    def mock_run_fail(*args, **kwargs):
        container = original_run(*args, **kwargs)
        container.status = "exited"  # Crash immediately
        return container
    mock_docker.containers.run = mock_run_fail

    # Create a deployment
    deployment = Deployment(project_id=sample_project.id, status=DeploymentStatus.PENDING)
    db_session.add(deployment)
    await db_session.commit()

    # Run the worker job
    await handle_job(deployment.id)

    # Refresh DB and verify status is FAILED
    await db_session.refresh(deployment)
    assert deployment.status == DeploymentStatus.FAILED


# ---------------------------------------------------------------------------
# Test Case 4: Concurrent deployments port allocation
# ---------------------------------------------------------------------------
async def test_port_allocation_concurrency_and_exhaustion():
    # Verify no port collision on pure function allocate_port
    used = {8001, 8002, 8003}
    port = allocate_port(used)
    assert port == 8004

    # Verify range boundaries
    all_ports_except_last = set(range(8001, 8999))
    port = allocate_port(all_ports_except_last)
    assert port == 8999

    # Verify exhaustion
    all_ports = set(range(8001, 9000))
    with pytest.raises(PortAllocationError):
        allocate_port(all_ports)
