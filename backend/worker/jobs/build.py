"""
worker/jobs/build.py
--------------------
Pure infrastructure module — no DB access, no log writes, no status updates.
All of that stays in worker/main.py (handle_job).

Public API:
    IMAGE_TAG_FORMAT
    DockerBuildError
    build_image(repo_path, deployment_id) -> AsyncGenerator[str, None]
"""

import asyncio
import logging
import threading
from pathlib import Path
from typing import AsyncGenerator
from uuid import UUID

import docker
import docker.errors

logger = logging.getLogger(__name__)

IMAGE_TAG_FORMAT = "ascend-{deployment_id}:latest"


# ---------------------------------------------------------------------------
# Exception
# ---------------------------------------------------------------------------

class DockerBuildError(Exception):
    """
    Raised when a docker build fails for any reason.
    Message is user-visible.
    """


# ---------------------------------------------------------------------------
# Internal blocking build runner (runs in thread)
# ---------------------------------------------------------------------------

def _build_in_thread(
    repo_path: Path,
    image_tag: str,
    queue: asyncio.Queue,
    loop: asyncio.AbstractEventLoop,
    stop_event: threading.Event,
) -> None:
    """
    Runs docker build synchronously in a background thread.

    Sends:
        ("log", line)
        ("done", None)
        ("error", message)
    """

    def _put(item) -> bool:
        try:
            loop.call_soon_threadsafe(queue.put_nowait, item)
            return True
        except RuntimeError:
            logger.debug("Event loop closed during docker build queue push")
            return False

    client = None

    try:
        try:
            client = docker.from_env()
        except docker.errors.DockerException as exc:
            _put(("error", f"Docker daemon is unavailable: {exc}"))
            return

        for chunk in client.api.build(
            path=str(repo_path),
            tag=image_tag,
            decode=True,
            rm=True,
            forcerm=True,
        ):
            if stop_event.is_set():
                logger.info("Build stop requested for image %s", image_tag)
                return

            if "stream" in chunk:
                line = chunk["stream"].rstrip("\n")
                if line:
                    if not _put(("log", line)):
                        return

            elif "error" in chunk:
                error_detail = chunk.get("errorDetail", {})
                msg = error_detail.get("message") or chunk["error"]

                if not _put(("error", f"Build failed: {msg}")):
                    return
                return

        _put(("done", None))

    except docker.errors.BuildError as exc:
        _put(("error", f"Build failed: {exc}"))

    except docker.errors.APIError as exc:
        _put(("error", f"Docker API error: {exc}"))

    except Exception as exc:
        logger.exception("Unexpected docker build error")
        _put(("error", f"Unexpected build error: {exc}"))

    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                logger.exception("Failed to close docker client")


# ---------------------------------------------------------------------------
# Public API — async generator
# ---------------------------------------------------------------------------

async def build_image(
    repo_path: Path,
    deployment_id: UUID,
) -> AsyncGenerator[str, None]:
    """
    Build Docker image and stream logs asynchronously.
    """
    image_tag = IMAGE_TAG_FORMAT.format(deployment_id=deployment_id)

    queue: asyncio.Queue[tuple[str, str | None]] = asyncio.Queue()
    loop = asyncio.get_running_loop()
    stop_event = threading.Event()

    thread = threading.Thread(
        target=_build_in_thread,
        args=(repo_path, image_tag, queue, loop, stop_event),
        daemon=True,
        name=f"docker-build-{deployment_id}",
    )

    thread.start()

    logger.info(
        "Build thread started for deployment %s (tag=%s)",
        deployment_id,
        image_tag,
    )

    try:
        while True:
            try:
                kind, value = await asyncio.wait_for(queue.get(), timeout=5)

            except asyncio.TimeoutError:
                if not thread.is_alive():
                    raise DockerBuildError(
                        "Build thread terminated unexpectedly."
                    )
                continue

            if kind == "log":
                yield value

            elif kind == "done":
                logger.info(
                    "Build completed for deployment %s (tag=%s)",
                    deployment_id,
                    image_tag,
                )
                return

            elif kind == "error":
                logger.warning(
                    "Build failed for deployment %s: %s",
                    deployment_id,
                    value,
                )
                raise DockerBuildError(value)

            else:
                raise DockerBuildError(f"Unknown queue message type: {kind}")

    except asyncio.CancelledError:
        logger.warning(
            "Build cancelled for deployment %s",
            deployment_id,
        )
        stop_event.set()
        raise

    finally:
        stop_event.set()
        logger.debug(
            "Build generator exiting for deployment %s",
            deployment_id,
        )