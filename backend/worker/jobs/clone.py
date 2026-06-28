import asyncio
import os
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path
from uuid import UUID

logger = __import__("logging").getLogger(__name__)


# ---------------------------------------------------------------------------
# Exception
# ---------------------------------------------------------------------------

class CloneError(Exception):
    """
    Raised when git clone fails for any user-visible reason (bad URL, auth
    failure, network error). Message is always user-visible and specific.
    """

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BUILD_ROOT: Path = Path(tempfile.gettempdir()) / "ascend-builds"

CLONE_TIMEOUT_SECONDS: float = 120.0


# ---------------------------------------------------------------------------
# Internal blocking helpers
# ---------------------------------------------------------------------------

def _handle_readonly(func, path, exc_info):
    """
    onerror callback for shutil.rmtree on Windows.

    Git marks .pack and .idx files in .git/objects/pack/ as read-only (S_IREAD).
    shutil.rmtree calls os.unlink() on them, which raises PermissionError
    [WinError 5] on Windows. Clearing S_IWRITE and retrying fixes this.
    """
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass  # best-effort; if it still fails, we've logged it above


def _clone_blocking(repo_url: str, clone_path: Path) -> None:
    """
    Synchronous git clone via subprocess.
    Must be called via asyncio.to_thread() — blocks for the full transfer.
    GIT_TERMINAL_PROMPT=0 makes git fail fast instead of hanging for credentials.

    Timeout: subprocess.run kills the git process after CLONE_TIMEOUT_SECONDS - 5.
    This fires 5 seconds before asyncio.wait_for's outer timeout so the thread
    exits cleanly before cleanup_repo() runs, preventing WinError 5 from git
    holding file handles open on Windows.
    """
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"

    try:
        result = subprocess.run(
            ["git", "clone", "--depth=1", repo_url, str(clone_path)],
            capture_output=True,
            text=True,
            env=env,
            timeout=int(CLONE_TIMEOUT_SECONDS) - 5,
        )
    except FileNotFoundError:
        raise CloneError(
            "git is not installed or not in PATH — "
            "install git: https://git-scm.com/downloads"
        )
    except subprocess.TimeoutExpired:
        raise CloneError(
            f"git clone killed after {int(CLONE_TIMEOUT_SECONDS) - 5}s — "
            "repository may be too large or the network is too slow."
        )

    if result.returncode != 0:
        raise CloneError(result.stderr.strip() or "git clone failed")




def _cleanup_blocking(path: Path) -> None:
    """
    Synchronous directory removal with Windows read-only file handling.
    Must be called via asyncio.to_thread() to avoid blocking the event loop.
    """
    if not path.exists():
        return
    shutil.rmtree(path, onerror=_handle_readonly)
    logger.debug("cleanup_repo: removed %s", path)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def clone_repo(repo_url: str, deployment_id: UUID) -> Path:
    """
    Clone repo_url into a deployment-scoped directory under BUILD_ROOT.
    Returns the clone root Path on success. Raises on any failure.
    """
    clone_path = BUILD_ROOT / str(deployment_id)
    clone_path.mkdir(parents=True, exist_ok=True)

    await asyncio.wait_for(
        asyncio.to_thread(_clone_blocking, repo_url, clone_path),
        timeout=CLONE_TIMEOUT_SECONDS,
    )

    return clone_path


async def cleanup_repo(path: Path) -> None:
    """
    Remove the clone directory asynchronously.

    Runs _cleanup_blocking in a thread so the read-only file handling
    (which may involve os.chmod + unlink retries on Windows) does not
    block the async event loop.

    Safe to call whether or not the path exists.
    """
    await asyncio.to_thread(_cleanup_blocking, path)

