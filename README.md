# 🚀 Ascend — From Repository to Production

## The Vision

Ascend is a **Platform-as-a-Service (PaaS)** similar to Heroku, Render, Railway, and Fly.io.

A developer should be able to:

```
1. Create account
2. Paste GitHub repository URL
3. Click Deploy
4. Receive live URL
```

Without touching: Docker, Linux servers, Kubernetes, reverse proxies, or CI/CD pipelines.

---

## Problem It Solves

Most beginner developers can write code. Most cannot deploy it.

Instead of:

```bash
git clone
docker build
docker push
kubectl apply
kubectl logs
kubectl get pods
```

The user simply clicks **Deploy**.

---

## MVP Goal (Week 1)

User provides a GitHub URL. Ascend:

```
Clone repository
↓
Detect runtime (or use existing Dockerfile)
↓
Build Docker image
↓
Allocate port
↓
Start container (with resource limits)
↓
Stream logs
↓
Return live URL
```

Output:

```
Status: Running
URL: http://localhost:5001
```

---

## Core Features (MVP)

### Authentication

- Register, login, logout
- JWT access tokens (short-lived, 15 min)
- BCrypt password hashing
- ⚠️ **Improvement:** Add refresh token via httpOnly cookie (V2) — short-lived access tokens alone log users out mid-session

### Projects

```json
{
  "name": "Weather App",
  "repo_url": "https://github.com/user/weather-app"
}
```

### Deployments

User clicks **Deploy**. Ascend:

1. Enqueues a job (returns `deployment_id` immediately — API does not block)
2. Worker picks up job: git clone → detect runtime → docker build → docker run
3. Status tracked in PostgreSQL

### Runtime Detection (NEW — was missing from original spec)

Before building, the worker checks:

```python
if repo contains Dockerfile:
    use it

elif repo contains package.json:
    copy deployment-runtime/node/Dockerfile

elif repo contains requirements.txt:
    copy deployment-runtime/python/Dockerfile

elif repo contains index.html (and no server):
    copy deployment-runtime/static/Dockerfile

else:
    fail with helpful error message
```

Without this, the "paste any repo" promise doesn't actually work.

### Port Registry (NEW — was missing from original spec)

```python
def allocate_port(db) -> int:
    used = {d.port for d in db.query(Deployment).filter(Deployment.status == "running")}
    for port in range(5000, 6000):
        if port not in used:
            return port
    raise RuntimeError("No free ports available")
```

Store the allocated port in the `deployments` table. Without this, two deployments collide on the same port and fail silently.

### Container Security (NEW — was missing from original spec)

```python
container = client.containers.run(
    image_tag,
    detach=True,
    ports={"3000/tcp": allocated_port},
    mem_limit="512m",
    nano_cpus=500_000_000,  # 0.5 CPU
    network_mode="bridge",
    read_only=False,         # set True if app supports it
)
```

Without resource limits, one runaway deployment can starve the host.

### Logs

```
Building image...
Installing dependencies...
Starting server...
Server listening on port 3000...
```

⚠️ **Improvement:** Store logs in a separate table (see schema below), not as a `text` column on the deployment row. This enables streaming, search, and avoids unbounded row sizes.

### Dashboard

```
Weather App      Status: Running    Port: 5001
Chat App         Status: Failed
API Server       Status: Building
```

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React + TypeScript | Dashboard, login, project management |
| Tailwind CSS | Styling |
| Axios | API requests |
| React Router | Client-side routing |

### Backend

| Technology | Purpose |
|---|---|
| FastAPI | REST API — auth, projects, deployments, logs |
| SQLAlchemy | ORM for database operations |
| Pydantic | Request/response validation |
| Alembic | Database migrations |
| python-jose | JWT token creation/verification |
| passlib (BCrypt) | Password hashing |

### Deployment Engine

| Technology | Purpose |
|---|---|
| Python Worker | Async job processor (decoupled from API) |
| GitPython | `git clone` inside Python |
| Docker SDK | `build`, `run`, `stop`, `logs` — no shell commands |

### Infrastructure

| Technology | Purpose |
|---|---|
| PostgreSQL | Users, projects, deployments, logs |
| Docker Compose | Local orchestration of all services |

---

## Architecture

```
             React Frontend
                    │
                    ▼ HTTP/JSON
             FastAPI Backend
                    │
       ┌────────────┼────────────┐
       │                         │
       ▼                         ▼
  PostgreSQL              Job Queue (asyncio.Queue → Celery in V2)
                                 │
                                 ▼
                         Python Worker
                                 │
              ┌──────────────────┤
              │                  │
              ▼                  ▼
         GitPython          Docker Engine
         (git clone)    (build · run · logs)
                                 │
                                 ▼
                     Isolated Containers
                    (resource-limited, bridged)
```

**Key design decision:** The API returns a `deployment_id` immediately and the worker runs asynchronously. This means slow builds (2–3 min) never block HTTP responses. The frontend polls `GET /deployments/{id}` for status.

---

## Database Schema

### users

```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
email        VARCHAR(255) UNIQUE NOT NULL
password_hash TEXT NOT NULL
created_at   TIMESTAMPTZ DEFAULT NOW()
```

### projects

```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
name         VARCHAR(255) NOT NULL
repo_url     TEXT NOT NULL
created_at   TIMESTAMPTZ DEFAULT NOW()
```

### deployments

```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE
status       VARCHAR(20) NOT NULL DEFAULT 'pending'
             -- pending | building | running | failed | stopped
container_id TEXT
image_tag    TEXT
port         INTEGER                 -- ⬅ new: allocated host port
started_at   TIMESTAMPTZ
finished_at  TIMESTAMPTZ
created_at   TIMESTAMPTZ DEFAULT NOW()
```

### deployment_logs (NEW — replaces `logs TEXT` column)

```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
deployment_id  UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE
sequence       INTEGER NOT NULL          -- for ordering
line           TEXT NOT NULL             -- one log line
emitted_at     TIMESTAMPTZ DEFAULT NOW()

INDEX on (deployment_id, sequence)
```

**Why:** The original spec stored logs as a single `text` column on the deployment row. That approach:
- Cannot stream (you'd have to read the entire column)
- Creates unbounded row sizes for long builds
- Cannot be searched or paginated

The separate table enables `GET /deployments/{id}/logs?since=42` for efficient polling.

---

## Repository Structure

```
ascend/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Project.tsx
│   │   │   └── Deployment.tsx
│   │   ├── components/
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── LogViewer.tsx
│   │   │   └── DeployButton.tsx
│   │   └── api/
│   │       └── client.ts          # Axios + typed API calls
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   ├── deployment.py
│   │   │   └── deployment_log.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── projects.py
│   │   │   ├── deployments.py
│   │   │   └── logs.py
│   │   ├── schemas/              # Pydantic models
│   │   └── core/
│   │       ├── auth.py           # JWT logic
│   │       ├── config.py         # Settings from .env
│   │       └── database.py       # SQLAlchemy session
│   └── alembic/                  # Migrations
│
├── worker/
│   ├── jobs/
│   │   ├── clone.py              # GitPython clone
│   │   ├── detect_runtime.py     # ⬅ new: Dockerfile detection
│   │   ├── build.py              # Docker SDK build
│   │   ├── run.py                # Docker SDK run + log capture
│   │   └── ports.py              # ⬅ new: port allocation
│   └── main.py                   # Job dispatcher
│
├── deployment-runtime/           # Base Dockerfiles per language
│   ├── node/Dockerfile
│   ├── python/Dockerfile
│   └── static/Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## User Flow

```
Login
  │
  ▼
Dashboard
  │
  ▼
Create Project (name + GitHub URL)
  │
  ▼
Click Deploy
  │
  ▼
API enqueues job → returns deployment_id immediately
  │
  ▼
Worker: Clone repo
  │
  ▼
Worker: Detect runtime / copy base Dockerfile
  │
  ▼
Worker: Build Docker image (stream logs → deployment_logs table)
  │
  ▼
Worker: Allocate port
  │
  ▼
Worker: Run container (with memory + CPU limits)
  │
  ▼
Status: Running   URL: http://localhost:{port}
```

---

## Version Roadmap

### V1 — Week 1 (Build now)

- ✅ JWT authentication (register, login, logout)
- ✅ Project creation with GitHub URL
- ✅ Git clone via GitPython
- ✅ Runtime detection (Dockerfile or auto-inject)
- ✅ Docker build + run via Python SDK
- ✅ Port registry — no deployment collisions
- ✅ Container resource limits (memory + CPU)
- ✅ Deployment status tracking in PostgreSQL
- ✅ Build logs via deployment_logs table
- ✅ Dashboard with live status

### V2 — 1–2 Months

- GitHub webhook → auto-deploy on `git push`
- Deployment history per project
- Restart, stop, delete deployments
- Streaming log endpoint (`GET /logs?since=seq`)
- Environment variable injection per deployment
- Celery + Redis job queue (replaces asyncio.Queue)
- Refresh token flow (httpOnly cookie)

### V3 — 3–4 Months

- Kubernetes backend — replace `docker run` with `kubectl apply`
- Auto-generate Deployment + Service + Ingress manifests
- Namespace isolation per user
- Horizontal pod autoscaling

### V4 — 5–6 Months

- Prometheus metrics scraping per container
- Grafana dashboards (CPU, RAM, disk, network)
- Alert rules — notify on crash or high CPU

### V5 — Production

- Custom domains + automatic TLS (Let's Encrypt)
- Secrets manager — encrypted env vars at rest
- One-click rollback to any prior image
- Team accounts + per-project RBAC
- Usage-based billing

---

## What This Project Teaches

- Docker (build, run, SDK, resource limits)
- Linux fundamentals and networking
- Reverse proxies and port management
- CI/CD pipeline design
- PostgreSQL and relational schema design
- Async job processing
- Kubernetes (V3+)
- Observability with Prometheus + Grafana
- System design at scale

This aligns directly with a **Cloud/DevOps Engineering** career path and is a project you can demo within a week.