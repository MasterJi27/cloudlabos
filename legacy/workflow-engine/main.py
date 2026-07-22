"""CloudLabOS Workflow Engine - DAG execution + Schedule polling"""

import asyncio
import json
import os
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from dotenv import load_dotenv
load_dotenv()

import asyncpg
import croniter
import redis.asyncio as aioredis
import structlog

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()


class WorkflowRunner:
    """Executes workflow DAG by resolving dependencies and dispatching steps"""

    def __init__(self, db_pool: asyncpg.Pool, redis: aioredis.Redis):
        self._db = db_pool
        self._r = redis

    async def start_run(self, workflow_id: str, workspace_id: str, input_payload: Dict, approval_mode: str, run_id: Optional[str] = None) -> str:
        """Start a new workflow run"""
        run_id = run_id or str(uuid.uuid4())

        # Load workflow definition
        row = await self._db.fetchrow(
            "SELECT definition FROM workflows WHERE id = $1", workflow_id
        )
        if not row:
            raise ValueError(f"Workflow {workflow_id} not found")

        dag = row["definition"]

        # The API gateway creates the durable run before publishing work. Reuse it
        # so clients, logs, approvals, and the engine all refer to one run id.
        updated = await self._db.execute(
            """
            UPDATE workflow_runs
            SET status = 'running', started_at = COALESCE(started_at, NOW())
            WHERE id = $1 AND workflow_id = $2 AND workspace_id = $3
            """,
            run_id, workflow_id, workspace_id,
        )
        if updated == "UPDATE 0":
            await self._db.execute(
                """
                INSERT INTO workflow_runs (id, workflow_id, workspace_id, status, trigger_type, input_payload, started_at)
                VALUES ($1, $2, $3, 'running', 'api', $4::jsonb, NOW())
                """,
                run_id, workflow_id, workspace_id, json.dumps(input_payload),
            )

        # Render variables
        dag = self._render_variables(dag, input_payload)

        # Store run state in Redis
        await self._r.hset(f"run:state:{run_id}", mapping={
            "status": "running",
            "current_step": "",
            "started_at": str(int(time.time())),
        })

        # Emit run started event
        await self._r.publish(
            f"run:{run_id}:events",
            json.dumps({"type": "run.started", "run_id": run_id, "timestamp": time.time()}),
        )

        # Start async execution
        asyncio.create_task(self._execute_dag(run_id, workspace_id, dag, approval_mode))
        return run_id

    async def _execute_dag(self, run_id: str, workspace_id: str, dag: Dict, approval_mode: str):
        """Execute the DAG with per-step retry and dead-letter support"""
        steps = {s["step_id"]: s for s in dag["steps"]}
        completed: Set[str] = set()
        failed: Set[str] = set()
        in_progress: Set[str] = set()
        retry_counts: Dict[str, int] = {}
        error_messages: Dict[str, str] = {}

        dependents = defaultdict(list)
        for step in dag["steps"]:
            for dep in step.get("depends_on", []):
                dependents[dep].append(step["step_id"])

        ready = [sid for sid, s in steps.items() if not s.get("depends_on")]

        while ready:
            if await self._r.get(f"run:cancel:{run_id}"):
                await self._db.execute(
                    "UPDATE workflow_runs SET status = 'cancelled', completed_at = NOW() WHERE id = $1",
                    run_id,
                )
                await self._r.hset(f"run:state:{run_id}", "status", "cancelled")
                logger.info("run.cancelled", run_id=run_id)
                return
            batch = list(ready)
            ready.clear()
            in_progress.update(batch)
            results = await asyncio.gather(
                *(self._run_step(run_id, workspace_id, steps[step_id], approval_mode) for step_id in batch),
                return_exceptions=True,
            )

            for step_id, result in zip(batch, results):
                in_progress.discard(step_id)
                if isinstance(result, Exception):
                    logger.exception("run.step_error", run_id=run_id, step_id=step_id, error=str(result))
                    failed.add(step_id)
                    continue

                _, success, error_msg = result

                if success:
                    completed.add(step_id)
                    for dep_id in dependents[step_id]:
                        dep_step = steps[dep_id]
                        if all(d in completed for d in dep_step.get("depends_on", [])):
                            ready.append(dep_id)
                else:
                    retry_counts[step_id] = retry_counts.get(step_id, 0) + 1
                    error_messages[step_id] = error_msg or "step failed"
                    max_retries = steps[step_id].get("max_retries", 3)

                    if retry_counts[step_id] <= max_retries:
                        logger.info(
                            "run.step_retry",
                            run_id=run_id, step_id=step_id,
                            attempt=retry_counts[step_id], max_retries=max_retries,
                        )
                        ready.append(step_id)
                    else:
                        logger.warning(
                            "run.step_dead_letter",
                            run_id=run_id, step_id=step_id,
                            error=error_messages[step_id],
                        )
                        failed.add(step_id)

        unresolved = set(steps) - completed - failed
        status = "success" if not failed and not unresolved else "completed_with_errors"
        await self._db.execute(
            "UPDATE workflow_runs SET status = $1, completed_at = NOW() WHERE id = $2",
            status, run_id,
        )
        await self._r.hset(f"run:state:{run_id}", "status", status)
        logger.info("run.complete", run_id=run_id, status=status)

    async def _run_step(self, run_id: str, workspace_id: str, step: Dict, approval_mode: str) -> tuple[str, bool, Optional[str]]:
        """Run a single step with retry tracking. Returns (step_id, success, error_message)."""
        step_id = step["step_id"]
        agent_type = step["agent_type"]
        task_type = step["task_type"]

        # Load existing retry_count if this step was already attempted
        existing = await self._db.fetchrow(
            "SELECT id, retry_count FROM run_steps WHERE run_id = $1 AND step_name = $2 ORDER BY started_at DESC LIMIT 1",
            run_id, step.get("name", step_id),
        )
        retry_count = existing["retry_count"] if existing else 0

        step_record_id = str(uuid.uuid4())
        task_id = f"{run_id}:{step_id}:{retry_count}"
        step_name = step.get("name", step_id)
        await self._db.execute(
            """
            INSERT INTO run_steps (id, run_id, step_name, agent_type, status, input_payload, retry_count, started_at)
            VALUES ($1, $2, $3, $4, 'running', $5::jsonb, $6, NOW())
            """,
            step_record_id, run_id, step_name, agent_type,
            json.dumps(step.get("payload", {})), retry_count,
        )

        # Emit step started event
        await self._r.publish(
            f"run:{run_id}:events",
            json.dumps({
                "type": "step.started", "run_id": run_id, "step_id": step_id,
                "step_name": step_name, "agent_type": agent_type, "retry_count": retry_count,
                "timestamp": time.time(),
            }),
        )

        await self._r.publish(
            f"agent.{agent_type}.tasks",
            json.dumps({
                "task_id": task_id,
                "workflow_run_id": run_id,
                "task_type": task_type,
                "payload": step.get("payload", {}),
                "timeout_seconds": step.get("timeout_s", 300),
            })
        )

        result = await self._wait_for_result(task_id, step.get("timeout_s", 300))

        success = result.get("status") == "success" if result else False
        error_message = None
        if not success:
            if result and result.get("output", {}).get("error"):
                error_message = str(result["output"]["error"])
            elif result is None:
                error_message = "timeout"

        await self._db.execute(
            """
            UPDATE run_steps
            SET status = $1, output_payload = $2::jsonb, error_message = $3, completed_at = NOW()
            WHERE id = $4
            """,
            "success" if success else "failed",
            json.dumps(result.get("output", {}) if result else {}),
            error_message,
            step_record_id,
        )

        # Emit step completed event
        await self._r.publish(
            f"run:{run_id}:events",
            json.dumps({
                "type": "step.completed" if success else "step.failed",
                "run_id": run_id, "step_id": step_id, "step_name": step_name,
                "success": success, "error": error_message,
                "timestamp": time.time(),
            }),
        )

        return step_id, success, error_message

    async def _wait_for_result(self, task_id: str, timeout_s: int) -> Optional[Dict]:
        """Poll for task result"""
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if await self._r.get(f"run:cancel:{task_id.split(':', 1)[0]}"):
                return {"status": "cancelled", "output": {"reason": "run cancelled"}}
            raw = await self._r.get(f"task:result:{task_id}")
            if raw:
                return json.loads(raw)
            await asyncio.sleep(1)
        return None

    @staticmethod
    def _render_variables(dag: Dict, variables: Dict) -> Dict:
        """Substitute {{ VAR }} placeholders"""
        dag_str = json.dumps(dag)
        for key, value in variables.items():
            dag_str = dag_str.replace(f"{{{{ {key} }}}}", str(value))
        return json.loads(dag_str)


class SchedulePoller:
    """Polls workflow_schedules and triggers runs on cron match"""

    def __init__(self, db_pool: asyncpg.Pool, redis: aioredis.Redis, runner: WorkflowRunner):
        self._db = db_pool
        self._r = redis
        self._runner = runner
        self._poll_interval = 60

    async def run(self):
        logger.info("scheduler.started", poll_interval_s=self._poll_interval)
        while True:
            try:
                await self._tick()
            except Exception as e:
                logger.error("scheduler.tick_error", error=str(e))
            await asyncio.sleep(self._poll_interval)

    async def _tick(self):
        now = datetime.now(timezone.utc)
        rows = await self._db.fetch(
            """
            SELECT s.id, s.workflow_id, s.workspace_id, s.cron_expression,
                   s.timezone, s.input_payload, s.next_run_at, s.last_run_at
            FROM workflow_schedules s
            WHERE s.enabled = TRUE
              AND (s.next_run_at IS NULL OR s.next_run_at <= $1)
            FOR UPDATE SKIP LOCKED
            """,
            now,
        )
        for row in rows:
            try:
                await self._fire(row, now)
            except Exception as e:
                logger.error("scheduler.fire_error", schedule_id=str(row["id"]), error=str(e))

    async def _fire(self, row, now: datetime):
        schedule_id = str(row["id"])
        workflow_id = str(row["workflow_id"])
        workspace_id = str(row["workspace_id"])
        input_payload = row["input_payload"] or {}

        # Load workflow to confirm it is still active
        wf = await self._db.fetchrow(
            "SELECT id, definition FROM workflows WHERE id = $1 AND status = 'active'",
            workflow_id,
        )
        if not wf:
            logger.warning("scheduler.workflow_inactive", workflow_id=workflow_id, schedule_id=schedule_id)
            return

        # Create a durable run
        run_id = str(uuid.uuid4())
        await self._db.execute(
            """
            INSERT INTO workflow_runs (id, workflow_id, workspace_id, status, trigger_type, input_payload, started_at)
            VALUES ($1, $2, $3, 'pending', 'schedule', $4::jsonb, NOW())
            """,
            run_id, workflow_id, workspace_id, json.dumps(input_payload),
        )

        # Compute next run
        tz = row["timezone"] or "UTC"
        cron = croniter.croniter(row["cron_expression"], now)
        next_run = cron.get_next(datetime)

        # Update schedule and fire the run
        await self._db.execute(
            """
            UPDATE workflow_schedules
            SET last_run_at = $1, next_run_at = $2
            WHERE id = $3
            """,
            now, next_run, schedule_id,
        )

        await self._r.publish(
            "workflow.start",
            json.dumps({
                "run_id": run_id,
                "workflow_id": workflow_id,
                "workspace_id": workspace_id,
                "input_payload": input_payload,
                "approval_mode": "policy",
            }),
        )
        logger.info("scheduler.fired", schedule_id=schedule_id, workflow_id=workflow_id, run_id=run_id)


async def health_server():
    """Simple HTTP health server on port 8002"""
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    import uvicorn

    health_app = FastAPI()

    @health_app.get("/health")
    async def health():
        return {"status": "healthy", "service": "workflow-engine"}

    @health_app.get("/ready")
    async def ready():
        try:
            await _db_pool.fetchval("SELECT 1")
            return {"status": "ready"}
        except Exception as e:
            return JSONResponse(status_code=503, content={"status": "not ready", "error": str(e)})

    @health_app.get("/metrics")
    async def metrics():
        from prometheus_client import CONTENT_TYPE_LATEST, generate_latest, Counter, Gauge

        runs_total = Counter("cloudlabos_workflow_runs_total", "Total workflow runs", ["status"])
        steps_total = Counter("cloudlabos_workflow_steps_total", "Total workflow steps executed", ["agent_type", "status"])
        active_runs = Gauge("cloudlabos_workflow_active_runs", "Currently active workflow runs")

        return JSONResponse(
            content=generate_latest().decode("utf-8"),
            media_type=CONTENT_TYPE_LATEST,
        )

    config = uvicorn.Config(health_app, host="0.0.0.0", port=8002, log_level="warning")
    server = uvicorn.Server(config)
    await server.serve()


# Global references for health server
_db_pool = None


async def main():
    global _db_pool

    db_url = os.environ.get("DATABASE_URL", "postgresql://cloudlabos:cloudlabos@localhost:5432/cloudlabos")
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")

    db_pool = await asyncpg.create_pool(db_url)
    _db_pool = db_pool
    redis = await aioredis.from_url(redis_url, decode_responses=True, protocol=2)

    runner = WorkflowRunner(db_pool, redis)

    # Start health server in background FIRST
    health_task = asyncio.create_task(health_server())

    # Start schedule poller in background
    poller = SchedulePoller(db_pool, redis, runner)
    scheduler_task = asyncio.create_task(poller.run())

    await asyncio.sleep(1)
    logger.info("workflow_engine.started")

    # Subscribe to workflow start events
    pubsub = redis.pubsub()
    await pubsub.subscribe("workflow.start")

    async for message in pubsub.listen():
        if message["type"] == "message":
            try:
                data = json.loads(message["data"])
                run_id = await runner.start_run(
                    data["workflow_id"],
                    data["workspace_id"],
                    data["input_payload"],
                    data.get("approval_mode", "policy"),
                    data.get("run_id"),
                )
                logger.info("workflow.started", run_id=run_id)
            except Exception as e:
                logger.error("workflow.message_error", error=str(e))


if __name__ == "__main__":
    asyncio.run(main())
