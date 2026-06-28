# Ascend — Worker Engine Implementation Plan
### For Claude Sonnet 4.6 in Antigravity IDE

This plan picks up exactly where the audit left off. Shell is done (90% UI, 90% DB, 85% auth, 90% projects). The only real gap is the **deployment engine** (worker, clone, build, run, ports, logs, status transitions). This plan sequences that work so each day produces something testable, and flags the exact mistakes to avoid based on what's already built.

---

## Before You Start — 3 Things to Fix First

These aren't new features. They're corrections to what already exists, and skipping them will cause the worker to fail silently later.

### Fix 1 — The Deploy Endpoint Doesn't Enqueue Anything
Current code only inserts a `pending` row and returns. There is no second step. Before building the worker, the deploy endpoint must be changed to:
1. Insert deployment row (`pending`) — already works
2. Push `deployment.id` onto a queue (in-process `asyncio.Queue` is enough for V1 — do not reach for Celery/Redis yet, that's V2)
3. Return the response immediately — do not `await` the job

If this isn't fixed first, the worker you build in Days 1–6 will have nothing to consume.

### Fix 2 — Status Enum Mismatch Risk
The model defines `DeploymentStatus` as a Python enum, but the column is `String(20)`. Confirm that the value written to DB is always `.value` (e.g. `"pending"`), not the enum member repr (e.g. `DeploymentStatus.PENDING`). This is one of the most common silent bugs in SQLAlchemy + enum setups — it won't error, it'll just store the wrong string and break frontend status badges.

### Fix 3 — No Cleanup Path for Cloned Repos
Nothing in the plan currently deletes cloned repos after a build. Without this, Day 2's clone step will quietly fill up disk over a week of testing. Build cleanup into clone.py on Day 2, not as a later afterthought.

---

## Architecture Decision — Lock This Before Day 1

**Queue:** In-process `asyncio.Queue`, single worker coroutine, run inside the same FastAPI process via a background task started on app startup. Do **not** spin up a separate worker process or Celery for V1 — the audit's own roadmap correctly defers this to V2, and reintroducing it now will double the surface area for bugs in a 7-day window.

**Job shape:** Worker only ever receives a `deployment_id` (UUID), never a full payload. Every job handler re-fetches the deployment + project from the DB at the start of its run. This avoids stale-data bugs if the queue holds a job for a few seconds.

**Status transition rule:** Status only ever moves forward: `pending → building → running` or `pending → building → failed`. Never write `running` and `failed` to the same deployment. Wrap each phase in try/except and set `failed` + write an error log line on any exception, then `return` — never let an exception propagate and crash the worker loop, or every subsequent job dies with it.

---

## Day 1 — Worker Skeleton + Queue

**Goal:** A worker loop that can receive a `deployment_id` and update its status to `building`, with nothing else happening yet. This proves the plumbing before any Docker/Git logic is added.

**Build:**
- `worker/queue.py` — single global `asyncio.Queue()`
- `worker/main.py` — `async def worker_loop()`: infinite loop, `await queue.get()`, dispatch to a (stubbed) job handler, catch all exceptions
- Hook into `app/main.py`'s startup event: `asyncio.create_task(worker_loop())`
- Modify the deployment POST endpoint (Fix 1 above) to call `queue.put_nowait(deployment.id)` after commit

**Test before moving on:**
- Deploy via curl/Postman → confirm `pending` row is created
- Confirm worker log shows the job was picked up
- Manually update status to `building` in the stub handler, confirm GET `/deployments/{id}` reflects it

**Mistake to avoid:** Don't let the stub handler do nothing and return silently — write at least one `deployment_logs` row (e.g. "Job received") so Day 6's log viewer has something to render from Day 1 onward, rather than testing against empty logs all week.

---

## Day 2 — Git Clone

**Goal:** Worker clones the project's `repo_url` to a temp directory and cleans up after itself.

**Build:**
- `worker/jobs/clone.py`:
  - `clone_repo(repo_url: str, deployment_id: UUID) -> Path` using GitPython's `Repo.clone_from()`
  - Clone target: `/tmp/ascend-builds/{deployment_id}/`
  - Wrap in try/except: invalid URL, private repo without access, network timeout → all should set status `failed` and write a clear log line, not crash the worker
  - Add a `cleanup_repo(path: Path)` function — call it after the build step succeeds OR fails (use try/finally in the job handler, not just on success)

**Test before moving on:**
- Deploy a public repo URL → confirm files appear in `/tmp/ascend-builds/{id}/`
- Deploy an invalid URL → confirm status becomes `failed` with a log line, and the worker loop is still alive afterward (deploy a second, valid repo right after to prove it)
- Confirm the temp folder is deleted after the job finishes either way

**Mistake to avoid:** Don't clone to a fixed path like `/tmp/repo` — concurrent deployments will overwrite each other. Always namespace by `deployment_id`.

---

## Day 3 — Runtime Detection

**Goal:** Worker inspects the cloned repo and decides which Dockerfile to use.

**Build:**
- `worker/jobs/detect_runtime.py`:
  ```
  if Dockerfile exists in repo root → use repo's own Dockerfile
  elif package.json exists → copy deployment-runtime/node/Dockerfile
  elif requirements.txt exists → copy deployment-runtime/python/Dockerfile
  elif index.html exists (and no server file) → copy deployment-runtime/static/Dockerfile
  else → fail with "Could not detect runtime" log line
  ```
- Create the three base Dockerfiles in `deployment-runtime/` if they don't exist yet:
  - `node/Dockerfile`: `FROM node:18-alpine`, copy, `npm install`, `npm start`
  - `python/Dockerfile`: `FROM python:3.11-slim`, copy, `pip install -r requirements.txt`, run entrypoint
  - `static/Dockerfile`: `FROM nginx:alpine`, copy static files to `/usr/share/nginx/html`

**Test before moving on:**
- Deploy a small Node repo, a small Python repo, and a static HTML repo (use throwaway test repos, not your own real apps yet) → confirm correct Dockerfile gets copied into each clone directory
- Deploy a repo with none of these markers → confirm clean `failed` status, not a crash

**Mistake to avoid:** Don't assume `package.json` alone means "run `npm start`" — confirm a `start` script exists in it, or the container will build successfully and then exit immediately, which looks like a build success but is actually a silent runtime failure (this exact pattern is what causes "Status: Running" with no actual server, which the original spec's demo log explicitly shows succeeding — don't let your real implementation regress behind that demo).

---

## Day 4 — Docker Build

**Goal:** Worker builds an image from the cloned + Dockerfile-equipped repo.

**Build:**
- `worker/jobs/build.py`:
  - `build_image(repo_path: Path, deployment_id: UUID) -> str` using Docker SDK's `client.images.build()`
  - Tag format: `ascend-{deployment_id}:latest`
  - Stream build output line-by-line into `deployment_logs` (this is the real producer the audit flagged as missing — Day 6's table/router already exist, they just need rows)
  - On build failure (bad Dockerfile, missing deps, etc.) → status `failed`, write the Docker error message as the last log line

**Test before moving on:**
- Confirm a successful build writes >5 log lines that show real `docker build` output, not placeholder text
- Confirm a deliberately broken repo (e.g. typo in `requirements.txt`) fails cleanly with the actual pip error visible in logs
- Confirm image tags don't collide across two different deployments of the same project (re-deploying the same repo should produce a new tag or overwrite cleanly, not error)

**Mistake to avoid:** Don't call `client.images.build()` synchronously inside the async worker loop without `await asyncio.to_thread(...)` — the Docker SDK is blocking, and calling it directly will freeze the entire worker loop (and therefore every other deployment) for the full build duration.

---

## Day 5 — Docker Run + Resource Limits

**Goal:** Worker runs the built image as a container with hard resource caps.

**Build:**
- `worker/jobs/run.py`:
  - `run_container(image_tag: str, port: int, deployment_id: UUID) -> str` (returns container_id)
  - Resource limits, non-negotiable for V1: `mem_limit="512m"`, `nano_cpus=500_000_000`, `network_mode="bridge"`
  - Write `container_id`, `port`, and `started_at` to the deployment row on success
  - Status → `running` only after confirming the container is actually alive (check `container.status == "running"` after a short delay, not immediately after `.run()` returns — a container can start and crash within a second)

**Test before moving on:**
- Confirm a working app reaches `running` status and is reachable at `http://localhost:{port}`
- Confirm a container that crashes on startup (e.g. app throws on boot) does **not** get marked `running` — this is the gap the audit flagged in section 14 ("Only pending used, no transitions")
- Deploy two apps back-to-back → confirm they get different ports and don't collide

**Mistake to avoid:** Don't skip the post-start health check. Marking status `running` immediately after `containers.run()` is what causes the false-positive "Running" state the audit identified as missing real transition logic — the container object existing is not the same as the app inside it staying up.

---

## Day 6 — Port Registry + Log Streaming Wire-Up

**Goal:** Formalize port allocation (used informally since Day 5) and confirm the existing logs table/router are actually being fed in real time.

**Build:**
- `worker/jobs/ports.py`:
  - `allocate_port(db) -> int`: query all `running` deployments' `port` values, scan 5000–5999, return first free one
  - Call this *before* `run_container()` on Day 5's flow — if Day 5 hardcoded a port for testing, replace it now
  - Release logic: when a deployment's status moves to `failed` or `stopped`, its port becomes immediately reusable (no extra table needed — just query `WHERE status = 'running'`)
- Confirm `deployment_logs` writes happen at every phase transition, not just during the Day 4 build step: "Cloning repository...", "Repository cloned", "Detecting runtime...", "Building image...", "Image built", "Allocating port...", "Port {n} assigned", "Starting container...", "Deployment running"

**Test before moving on:**
- Deploy 3 apps concurrently → confirm 3 distinct ports, no collision
- Stop one → confirm its port is allocated to the next new deployment
- Open the frontend's log viewer against a live deployment → confirm lines appear progressively, not all at once at the end (this is what makes the polling-based `GET /logs?since=seq` endpoint from the backend prompt actually pay off)

**Mistake to avoid:** Don't allocate the port inside `run_container()` itself — allocate it as a separate explicit step before run, and write it to the DB immediately on allocation (not after the container starts). If the container start fails after allocation, the port still needs to be released by virtue of the deployment status becoming `failed`.

---

## Day 7 — Full Integration Pass

**Goal:** No new code. Only end-to-end verification and bug-fixing across the full pipeline.

**Run this exact sequence and confirm the log output matches:**
```
Cloning repository...
Repository cloned.
Detecting runtime...
Node app detected.
Building Docker image...
Build complete.
Allocating port...
Port 5001 assigned.
Starting container...
Deployment running.
```

**Checklist:**
- [ ] Deploy succeeds end-to-end for one repo of each type (Node, Python, static)
- [ ] Deploy fails cleanly (clear log, `failed` status, worker loop still alive) for: invalid URL, undetectable runtime, broken build
- [ ] Two concurrent deployments don't share a port or step on each other's `/tmp` clone directory
- [ ] Frontend dashboard reflects live status changes without manual refresh (polling working)
- [ ] Stopping a deployment frees its port for reuse
- [ ] Restarting the FastAPI process doesn't leave orphaned containers running with no matching DB row in `running` state (acceptable for V1 to require a manual `docker ps` check here — just confirm you know the current behavior, don't need to fix orphan-recovery this week)

**If anything fails here:** Go back to the specific day above rather than patching it as a one-off in Day 7 — the day-by-day boundaries exist so each fix has a single, known place to live.

---

## What This Plan Deliberately Leaves Out (and why)

- **Celery/Redis queue** — V2. In-process `asyncio.Queue` is correct for a single-instance V1.
- **GitHub webhooks / auto-deploy on push** — V2, not needed for the manual "click Deploy" MVP.
- **Refresh tokens** — already correctly flagged as V2 in the audit; don't let it bleed into this week's scope.
- **Streaming logs over websockets** — polling via `GET /logs?since=seq` is sufficient and is what the backend already implements; don't add websockets this week.
- **Orphan container recovery on restart** — acknowledged as a known gap, deferred past V1 by design.

Keeping these out is what makes the 7-day window realistic. Each of them is a real future improvement, not a current blocker.