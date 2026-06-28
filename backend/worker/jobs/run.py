# worker/jobs/run.py

import asyncio
import logging
import docker
import docker.errors

logger = logging.getLogger(__name__)

RUNTIME_CONTAINER_PORTS = {
    "node": 3000,
    "python": 8000,
    "static": 80,
    "dockerfile": 80,  # TODO: replace with EXPOSE parsing or user-defined port
}


class ContainerRuntimeError(Exception):
    """Base exception for container runtime errors."""
    pass


class ImageNotFoundError(ContainerRuntimeError):
    """Raised when docker image is missing."""
    pass


class PortAlreadyBoundError(ContainerRuntimeError):
    """Raised when host port is already in use."""
    pass


class ContainerLaunchError(ContainerRuntimeError):
    """Raised when container starts but fails health checks."""
    pass


def _run_container_sync(
    image_tag: str,
    host_port: int,
    container_port: int,
) -> str:
    client = docker.from_env()

    try:
        container = client.containers.run(
            image_tag,
            detach=True,
            ports={f"{container_port}/tcp": host_port},
            environment={"PORT": str(container_port)},
            name=f"ascend-{image_tag.replace(':', '-')}",
        )
        return container.id

    except docker.errors.ImageNotFound as exc:
        raise ImageNotFoundError(f"Docker image not found: {image_tag}") from exc

    except docker.errors.APIError as exc:
        err_msg = str(exc)

        if (
            "port is already allocated" in err_msg
            or "address already in use" in err_msg
        ):
            raise PortAlreadyBoundError(
                f"Host port {host_port} is already allocated."
            ) from exc

        raise ContainerRuntimeError(
            f"Docker API error starting container: {exc}"
        ) from exc

    except Exception as exc:
        raise ContainerRuntimeError(
            f"Unexpected error starting container: {exc}"
        ) from exc

    finally:
        client.close()


def _check_container_health_sync(container_id: str) -> bool:
    client = docker.from_env()

    try:
        container = client.containers.get(container_id)
        container.reload()
        return container.status == "running"

    except docker.errors.NotFound:
        return False

    except Exception as exc:
        logger.warning(
            "Error checking container health for %s: %s",
            container_id,
            exc,
        )
        return False

    finally:
        client.close()


def _get_container_logs_sync(container_id: str) -> str:
    client = docker.from_env()

    try:
        container = client.containers.get(container_id)
        logs = container.logs(tail=100).decode(errors="replace")
        return logs or "No logs available."

    except docker.errors.NotFound:
        return "Container not found while retrieving logs."

    except Exception as exc:
        return f"Failed to fetch logs: {exc}"

    finally:
        client.close()


def _stop_container_sync(container_id: str) -> None:
    client = docker.from_env()

    try:
        container = client.containers.get(container_id)
        container.stop(timeout=10)

    except docker.errors.NotFound:
        logger.warning("Container %s not found while stopping.", container_id)

    except Exception as exc:
        raise ContainerRuntimeError(
            f"Failed to stop container {container_id}: {exc}"
        ) from exc

    finally:
        client.close()


def _remove_container_sync(container_id: str) -> None:
    client = docker.from_env()

    try:
        container = client.containers.get(container_id)
        container.remove(force=True)

    except docker.errors.NotFound:
        logger.warning("Container %s not found while removing.", container_id)

    except Exception as exc:
        raise ContainerRuntimeError(
            f"Failed to remove container {container_id}: {exc}"
        ) from exc

    finally:
        client.close()


async def run_container(
    image_tag: str,
    host_port: int,
    container_port: int,
) -> str:
    """
    Start container and perform startup health checks.

    Health check:
    - poll container status every second
    - total 5 checks
    - if container exits during startup, fetch logs and fail
    """
    container_id = await asyncio.to_thread(
        _run_container_sync,
        image_tag,
        host_port,
        container_port,
    )

    try:
        for _ in range(5):
            await asyncio.sleep(1)

            healthy = await asyncio.to_thread(
                _check_container_health_sync,
                container_id,
            )

            if not healthy:
                logs = await asyncio.to_thread(
                    _get_container_logs_sync,
                    container_id,
                )

                try:
                    await stop_container(container_id)
                    await remove_container(container_id)
                except Exception as cleanup_exc:
                    logger.warning(
                        "Failed to cleanup crashed container %s: %s",
                        container_id,
                        cleanup_exc,
                    )

                raise ContainerLaunchError(
                    f"Container crashed during startup.\nLogs:\n{logs}"
                )

        return container_id

    except Exception:
        raise


async def stop_container(container_id: str) -> None:
    await asyncio.to_thread(_stop_container_sync, container_id)


async def remove_container(container_id: str) -> None:
    await asyncio.to_thread(_remove_container_sync, container_id)