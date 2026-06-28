import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session
from app.models.deployment import Deployment, DeploymentStatus
from app.routers import auth, deployments, logs, projects
from worker.main import worker_loop

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — start/stop the background worker task
# ---------------------------------------------------------------------------

NUM_WORKERS = 3  # concurrent deployment workers sharing the same asyncio.Queue


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start NUM_WORKERS concurrent worker loops on startup; cancel all on shutdown.

    asyncio.Queue is safe for multiple concurrent consumers: each queue.get()
    atomically hands one item to exactly one waiter — no two workers ever
    receive the same deployment_id.
    """
    # Startup recovery: mark any deployment left in PENDING or BUILDING by a
    # previous crash as FAILED.  Workers haven't started yet so there is no
    # concurrent access to these rows.
    async with async_session() as db:
        result = await db.execute(
            select(Deployment).where(
                Deployment.status.in_(
                    [DeploymentStatus.PENDING, DeploymentStatus.BUILDING]
                )
            )
        )
        stuck = result.scalars().all()
        if stuck:
            for dep in stuck:
                dep.status = DeploymentStatus.FAILED
            await db.commit()
            logger.warning(
                "Startup recovery: marked %d stuck deployment(s) as FAILED",
                len(stuck),
            )

    worker_tasks = [
        asyncio.create_task(worker_loop(worker_id=i), name=f"worker-{i}")
        for i in range(NUM_WORKERS)
    ]
    logger.info("Started %d worker tasks", NUM_WORKERS)
    try:
        yield
    finally:
        for task in worker_tasks:
            task.cancel()
        # return_exceptions=True: one task's CancelledError won't prevent
        # the others from being awaited and logged.
        await asyncio.gather(*worker_tasks, return_exceptions=True)
        logger.info("All %d worker tasks stopped", NUM_WORKERS)



# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    lifespan=lifespan,
    title="Ascend API",
    description=(
        "## Ascend — Platform as a Service\n\n"
        "Deploy any GitHub repository to production by pasting a URL and clicking deploy.\n\n"
        "### Authentication\n"
        "All endpoints (except `/auth/register` and `/auth/login`) require a JWT bearer token.\n"
        "Obtain a token via `POST /auth/login` and include it as:\n"
        "`Authorization: Bearer <token>`"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "auth", "description": "User registration and authentication"},
        {"name": "projects", "description": "Manage deployment projects"},
        {"name": "deployments", "description": "Create and monitor deployments"},
        {"name": "logs", "description": "Stream deployment build/runtime logs"},
    ],
)

# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(deployments.router)
app.include_router(logs.router)

# ---------------------------------------------------------------------------
# Health / Root
# ---------------------------------------------------------------------------
@app.get("/", tags=["health"], summary="API root / health check")
async def root() -> dict:
    return {
        "service": "Ascend API",
        "version": "1.0.0",
        "status": "healthy",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"], summary="Liveness probe")
async def health() -> dict:
    return {"status": "ok"}
