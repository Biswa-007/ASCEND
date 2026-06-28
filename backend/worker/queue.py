"""
worker/queue.py
---------------
Single global asyncio.Queue used to hand deployment IDs from the HTTP layer to
the in-process worker loop.

Both the FastAPI request handlers and the worker coroutine live in the same
process and the same event loop, so a plain asyncio.Queue is sufficient —
no Celery / Redis / RabbitMQ required for V1.

Usage (producer side — deploy endpoint):
    from worker.queue import deployment_queue
    deployment_queue.put_nowait(deployment.id)

Usage (consumer side — worker loop):
    from worker.queue import deployment_queue
    deployment_id = await deployment_queue.get()
"""

import asyncio

# Unbounded queue — back-pressure is not a concern at V1 scale.
deployment_queue: asyncio.Queue = asyncio.Queue()
