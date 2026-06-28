# worker/main.py

import asyncio
import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.database import async_session
from app.models.deployment import Deployment, DeploymentStatus
from app.models.deployment_log import DeploymentLog
from worker.jobs.build import DockerBuildError, build_image, IMAGE_TAG_FORMAT
from worker.jobs.clone import (
    BUILD_ROOT,
    CLONE_TIMEOUT_SECONDS,
    CloneError,
    cleanup_repo,
    clone_repo,
)
from worker.jobs.detect_runtime import (
    RUNTIME_LABELS,
    RuntimeDetectionError,
    copy_base_dockerfile,
    detect_runtime,
)
from worker.jobs.ports import PortAllocationError, allocate_port
from worker.jobs.run import (
    ContainerRuntimeError,
    RUNTIME_CONTAINER_PORTS,
    run_container,
    stop_container,
    remove_container,
)
from worker.queue import deployment_queue

logger = logging.getLogger(__name__)

# Lock to serialise port allocation and prevent concurrent port collisions
_port_lock = asyncio.Lock()


# ---------------------------------------------------------------------------
# DB Helpers
# ---------------------------------------------------------------------------

async def clear_runtime_metadata(deployment_id: UUID) -> None:
    async with async_session() as db:
        deployment = await db.get(Deployment, deployment_id)
        if deployment:
            deployment.port = None
            deployment.container_id = None
            deployment.public_url = None
            deployment.image_tag = None
            await db.commit()


async def write_log_no_flush(
    db,
    deployment_id: UUID,
    sequence: int,
    line: str,
) -> None:
    log_entry = DeploymentLog(
        deployment_id=deployment_id,
        sequence=sequence,
        line=line,
        emitted_at=datetime.utcnow(),   # keep naive UTC for current DB schema
    )
    db.add(log_entry)


async def update_status(
    deployment_id: UUID,
    status: DeploymentStatus,
) -> None:
    async with async_session() as db:
        deployment = await db.get(Deployment, deployment_id)
        if deployment:
            deployment.status = status
            await db.commit()


async def append_log(
    deployment_id: UUID,
    sequence: int,
    line: str,
) -> None:
    async with async_session() as db:
        await write_log_no_flush(db, deployment_id, sequence, line)
        await db.commit()


async def append_logs_bulk(
    deployment_id: UUID,
    start_seq: int,
    lines: list[str],
) -> None:
    async with async_session() as db:
        for i, line in enumerate(lines):
            await write_log_no_flush(
                db,
                deployment_id,
                start_seq + i,
                line,
            )
        await db.commit()


async def flush_log_buffer(
    deployment_id: UUID,
    seq: int,
    log_buffer: list[str],
) -> int:
    if log_buffer:
        await append_logs_bulk(deployment_id, seq, log_buffer)
        seq += len(log_buffer)
        log_buffer.clear()
    return seq

# ---------------------------------------------------------------------------
# Job Handler
# ---------------------------------------------------------------------------

async def handle_job(deployment_id: UUID) -> None:
    clone_path = BUILD_ROOT / str(deployment_id)
    seq = 1
    log_buffer: list[str] = []

    try:
        async with async_session() as db:
            result = await db.execute(
                select(Deployment)
                .options(joinedload(Deployment.project))
                .where(Deployment.id == deployment_id)
            )
            deployment = result.scalar_one_or_none()

        if deployment is None:
            logger.error("Deployment %s not found", deployment_id)
            return

        repo_url = deployment.project.repo_url
        project_id = deployment.project_id

        await append_log(deployment_id, seq, "Job received.")
        seq += 1

        await update_status(deployment_id, DeploymentStatus.BUILDING)

        await append_log(deployment_id, seq, "Cloning repository...")
        seq += 1

        await clone_repo(repo_url, deployment_id)

        await append_log(deployment_id, seq, "Repository cloned successfully.")
        seq += 1

        await append_log(deployment_id, seq, "Detecting runtime...")
        seq += 1

        runtime = detect_runtime(clone_path)
        copy_base_dockerfile(runtime, clone_path)

        runtime_msg = RUNTIME_LABELS[runtime]
        await append_log(deployment_id, seq, runtime_msg)
        seq += 1

        await append_log(deployment_id, seq, "Building Docker image...")
        seq += 1

        async for build_line in build_image(clone_path, deployment_id):
            log_buffer.append(build_line)

            if len(log_buffer) >= 10:
                await append_logs_bulk(deployment_id, seq, log_buffer)
                seq += len(log_buffer)
                log_buffer.clear()

        seq = await flush_log_buffer(deployment_id, seq, log_buffer)

        await append_log(deployment_id, seq, "Image built successfully.")
        seq += 1

        # 1. Allocate port
        await append_log(deployment_id, seq, "Allocating host port...")
        seq += 1

        async with _port_lock:
            # Query used ports: any port allocated to BUILDING or RUNNING deployments
            async with async_session() as db:
                result = await db.execute(
                    select(Deployment.port).where(
                       (Deployment.id != deployment_id)
                       & Deployment.status.in_([DeploymentStatus.BUILDING, DeploymentStatus.RUNNING])
                       & Deployment.port.isnot(None)
                    )
                )
                used_ports = {row[0] for row in result.all()}

            host_port = allocate_port(used_ports)

            # Persist port allocation in DB to reserve it
            async with async_session() as db:
                db_dep = await db.get(Deployment, deployment_id)
                if db_dep:
                    db_dep.port = host_port
                    await db.commit()

        await append_log(deployment_id, seq, f"Allocated host port {host_port}.")
        seq += 1

        # 2. Redeploy rule
        # Find the single most recent RUNNING deployment for this project
        await append_log(deployment_id, seq, "Checking for existing active deployments...")
        seq += 1

        async with async_session() as db:
            result = await db.execute(
                select(Deployment)
                .where(
                    (Deployment.project_id == project_id)
                    & (Deployment.id != deployment_id)
                    & (Deployment.status == DeploymentStatus.RUNNING)
                )
                .order_by(Deployment.created_at.desc())
                .limit(1)
            )
            old_deployment = result.scalar_one_or_none()

            old_container_id = old_deployment.container_id if old_deployment else None
            old_dep_id = old_deployment.id if old_deployment else None

        if old_dep_id and old_container_id:
            await append_log(deployment_id, seq, f"Stopping old deployment {old_dep_id} (container {old_container_id})...")
            seq += 1

            # Stop and remove container (no DB block)
            try:
                await stop_container(old_container_id)
            except Exception as exc:
                logger.warning("Failed stopping old container %s: %s", old_container_id, exc)

            try:
                await remove_container(old_container_id)
            except Exception as exc:
                logger.warning("Failed removing old container %s: %s", old_container_id, exc)

            # Update old deployment status in a short DB session
            async with async_session() as db:
                db_old_dep = await db.get(Deployment, old_dep_id)
                if db_old_dep:

                    now = datetime.utcnow()

                    db_old_dep.status = DeploymentStatus.STOPPED
                    db_old_dep.stopped_at = now
                    db_old_dep.finished_at = now
                    await db.commit()

            await append_log(deployment_id, seq, f"Old deployment container {old_container_id} stopped and removed.")
            seq += 1
        else:
            await append_log(deployment_id, seq, "No active deployments found to stop.")
            seq += 1

        # 3. Start the container
        container_port = RUNTIME_CONTAINER_PORTS.get(runtime, 80)

        image_tag = IMAGE_TAG_FORMAT.format(deployment_id=deployment_id)

        await append_log(deployment_id, seq, f"Starting container (image={image_tag}, container_port={container_port}, host_port={host_port})...")
        seq += 1

        container_id = await run_container(image_tag, host_port, container_port)

        # 4. Save metadata and move status to RUNNING
        public_url = f"http://localhost:{host_port}"
        started_at = datetime.utcnow()

        async with async_session() as db:
            db_dep = await db.get(Deployment, deployment_id)
            if db_dep:
                db_dep.container_id = container_id
                db_dep.image_tag = image_tag
                db_dep.public_url = public_url
                db_dep.started_at = started_at
                db_dep.status = DeploymentStatus.RUNNING
                await db.commit()

        await append_log(deployment_id, seq, f"Container is running. Public URL: {public_url}")
        seq += 1

        logger.info("Deployment %s container running successfully", deployment_id)

    except asyncio.TimeoutError:
        seq = await flush_log_buffer(deployment_id, seq, log_buffer)

        msg = f"Clone timed out after {int(CLONE_TIMEOUT_SECONDS)} s"
        logger.warning(msg)

        await append_log(deployment_id, seq, msg)
        await update_status(deployment_id, DeploymentStatus.FAILED)

    except CloneError as exc:
        seq = await flush_log_buffer(deployment_id, seq, log_buffer)

        stderr = str(exc)
        lower = stderr.lower()

        if "repository not found" in lower or "does not exist" in lower:
            msg = f"Repository not found: {repo_url}"
        elif (
            "authentication failed" in lower
            or "403" in lower
            or "401" in lower
            or "could not read" in lower
        ):
            msg = "Repository is private or credentials were rejected."
        elif "could not resolve host" in lower or "unable to connect" in lower:
            msg = "Network error: could not resolve or reach repository host."
        elif stderr:
            msg = f"Git error: {stderr}"
        else:
            msg = "Git clone failed (no details from git)"

        logger.warning(msg)
        await append_log(deployment_id, seq, msg)
        await update_status(deployment_id, DeploymentStatus.FAILED)

    except RuntimeDetectionError as exc:
        seq = await flush_log_buffer(deployment_id, seq, log_buffer)

        msg = str(exc)
        logger.warning(msg)

        await append_log(deployment_id, seq, msg)
        await update_status(deployment_id, DeploymentStatus.FAILED)

    except DockerBuildError as exc:
        seq = await flush_log_buffer(deployment_id, seq, log_buffer)

        msg = str(exc)
        logger.warning(msg)

        await append_log(deployment_id, seq, msg)
        await update_status(deployment_id, DeploymentStatus.FAILED)

    except PortAllocationError as exc:
        seq = await flush_log_buffer(deployment_id, seq, log_buffer)

        msg = f"Port allocation failed: {exc}"
        logger.warning(msg)

        await clear_runtime_metadata(deployment_id)
        await append_log(deployment_id, seq, msg)
        await update_status(deployment_id, DeploymentStatus.FAILED)

    except ContainerRuntimeError as exc:
        seq = await flush_log_buffer(deployment_id, seq, log_buffer)

        msg = f"Container runtime failed: {exc}"
        logger.warning(msg)

        try:
           async with async_session() as db:
               dep = await db.get(Deployment, deployment_id)
               if dep and dep.container_id:
                   try:
                      await stop_container(dep.container_id)
                   except Exception:
                      logger.exception("Failed stopping container")

                   try:
                      await remove_container(dep.container_id)
                   except Exception:
                      logger.exception("Failed removing container")
        except Exception:
            logger.exception("Runtime cleanup failed")

        await clear_runtime_metadata(deployment_id)
        await append_log(deployment_id, seq, msg)
        await update_status(deployment_id, DeploymentStatus.FAILED)

    except Exception as exc:
        seq = await flush_log_buffer(deployment_id, seq, log_buffer)

        logger.exception("Unexpected error in handle_job")
        msg = f"Unexpected error: {type(exc).__name__}: {str(exc)}"

        await clear_runtime_metadata(deployment_id)

        try:
            await append_log(deployment_id, seq, msg)
            await update_status(deployment_id, DeploymentStatus.FAILED)
        except Exception:
            logger.exception("Recovery failed")
            raise

    finally:
        try:
            await cleanup_repo(clone_path)
            logger.debug("Clone dir removed")
        except Exception:
            logger.exception("Cleanup failed")


# ---------------------------------------------------------------------------
# Worker Loop
# ---------------------------------------------------------------------------

async def worker_loop(worker_id: int = 0) -> None:
    logger.info("Worker-%d started and waiting for jobs", worker_id)

    while True:
        deployment_id: UUID = await deployment_queue.get()

        try:
            logger.info(
                "Worker-%d: picked up deployment %s",
                worker_id,
                deployment_id,
            )

            await handle_job(deployment_id)

            logger.info(
                "Worker-%d: finished deployment %s",
                worker_id,
                deployment_id,
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Worker-%d: unhandled error processing deployment %s — attempting recovery",
                worker_id,
                deployment_id,
            )

            try:
                async with async_session() as recovery_db:
                    result = await recovery_db.execute(
                        select(Deployment).where(
                            Deployment.id == deployment_id
                        )
                    )
                    dep = result.scalar_one_or_none()

                    if dep and dep.status == DeploymentStatus.BUILDING:
                        dep.status = DeploymentStatus.FAILED
                        await recovery_db.commit()

                        logger.warning(
                            "Worker-%d: deployment %s recovered → FAILED",
                            worker_id,
                            deployment_id,
                        )

            except Exception:
                logger.exception(
                    "Worker-%d: recovery failed for deployment %s",
                    worker_id,
                    deployment_id,
                )

        finally:
            deployment_queue.task_done()