"""
worker/jobs/detect_runtime.py
------------------------------
Pure infrastructure module — no DB access, no log writes, no status updates.
All of that stays in worker/main.py (handle_job).

Public API:
    RUNTIME_BASE_DIR                        — Path to deployment-runtime/ at repo root
    RuntimeDetectionError                   — raised when runtime cannot be determined
    detect_runtime(repo_path) -> str        — inspects repo, returns runtime key
    copy_base_dockerfile(runtime, repo_path) — copies matching Dockerfile into clone dir
"""

import json
import shutil
from pathlib import Path

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
# Anchor on this file's known position in the tree — named variables so the
# structure is self-documenting and any future refactor breaks loudly.
#
#   __file__  →  backend/worker/jobs/detect_runtime.py
#   parent[0] →  backend/worker/jobs/
#   parent[1] →  backend/worker/
#   parent[2] →  backend/
#   parent[3] →  ASCEND/  (repo root)

_JOBS_DIR     = Path(__file__).resolve().parent   # backend/worker/jobs/
_WORKER_DIR   = _JOBS_DIR.parent                  # backend/worker/
_BACKEND_DIR  = _WORKER_DIR.parent                # backend/
_PROJECT_ROOT = _BACKEND_DIR.parent               # ASCEND/ — repo root

RUNTIME_BASE_DIR: Path = _PROJECT_ROOT / "deployment-runtime"


# ---------------------------------------------------------------------------
# Exception
# ---------------------------------------------------------------------------

class RuntimeDetectionError(Exception):
    """
    Raised when a deployable runtime cannot be determined for a repository.
    The message is always user-visible — never generic.
    """


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _has_start_script(package_json_path: Path) -> bool:
    """
    Return True if package.json defines a non-empty 'scripts.start' entry.

    Returns False (not raises) on any parse error — the caller handles the
    "package.json found but no start script" case explicitly.
    """
    try:
        data = json.loads(package_json_path.read_text(encoding="utf-8"))
        return bool(data.get("scripts", {}).get("start"))
    except (json.JSONDecodeError, OSError):
        return False


def _has_server_entrypoint(repo_path: Path) -> bool:
    """
    Return True if a common server entrypoint file exists at the repo root.

    Used to exclude repos that have index.html but are actually server-side
    apps — those should fail detection rather than be silently classified
    as static sites.
    """
    server_markers = {
        # Python
        "app.py", "main.py", "server.py", "wsgi.py", "asgi.py", "manage.py",
        # Node / TypeScript
        "server.js", "app.js", "index.js",
        "server.ts", "app.ts", "index.ts",
        # Other
        "go.mod", "pom.xml", "build.gradle",
    }
    return any((repo_path / name).exists() for name in server_markers)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_runtime(repo_path: Path) -> str:
    """
    Inspect the cloned repository and return a runtime identifier.

    Detection order (first match wins):
        1. Dockerfile present      → "dockerfile"  (repo brings its own)
        2. package.json present    → "node"         (only if scripts.start exists)
           package.json, no start  → RuntimeDetectionError  (specific message)
        3. requirements.txt        → "python"
        4. index.html, no server   → "static"
        5. None matched            → RuntimeDetectionError

    Returns one of: "dockerfile", "node", "python", "static"

    Raises RuntimeDetectionError with a specific, user-visible message on
    any failure — never a generic fallback.
    """
    # 1. Repo ships its own Dockerfile — use it as-is, skip all base files
    if (repo_path / "Dockerfile").exists():
        return "dockerfile"

    # 2. Node — present only if a start script is defined
    package_json = repo_path / "package.json"
    if package_json.exists():
        if _has_start_script(package_json):
            return "node"
        raise RuntimeDetectionError(
            "Found package.json but no 'start' script is defined under 'scripts'. "
            "Add a start script (e.g. \"start\": \"node index.js\") and redeploy."
        )

    # 3. Python
    if (repo_path / "requirements.txt").exists():
        return "python"

    # 4. Static — only if no server entrypoint is also present
    if (repo_path / "index.html").exists():
        if _has_server_entrypoint(repo_path):
            raise RuntimeDetectionError(
                "Found index.html alongside a server entrypoint file. "
                "Could not decide between 'static' and a server runtime. "
                "Add a Dockerfile or requirements.txt to disambiguate."
            )
        return "static"

    # 5. Nothing matched
    raise RuntimeDetectionError(
        "Could not detect a supported runtime. "
        "Expected one of: Dockerfile, package.json (with a 'start' script), "
        "requirements.txt, or index.html (static, no server entrypoint)."
    )


# Runtime → human-readable log label
RUNTIME_LABELS: dict[str, str] = {
    "dockerfile": "Custom Dockerfile detected. Using repository's own Dockerfile.",
    "node":       "Node.js runtime detected. Using deployment-runtime/node/Dockerfile.",
    "python":     "Python runtime detected. Using deployment-runtime/python/Dockerfile.",
    "static":     "Static site detected. Using deployment-runtime/static/Dockerfile.",
}


def copy_base_dockerfile(runtime: str, repo_path: Path) -> None:
    """
    Copy the base Dockerfile for *runtime* into *repo_path*.

    No-op for "dockerfile" — the repo already has its own Dockerfile in place.

    Raises FileNotFoundError if the base Dockerfile is missing from
    deployment-runtime/ — this is a configuration/deployment error, not a
    user error, and should surface loudly.
    """
    if runtime == "dockerfile":
        return

    src = RUNTIME_BASE_DIR / runtime / "Dockerfile"
    if not src.exists():
        raise FileNotFoundError(
            f"Base Dockerfile for runtime '{runtime}' not found at {src}. "
            "This is a deployment-runtime configuration error."
        )
    shutil.copy2(src, repo_path / "Dockerfile")
