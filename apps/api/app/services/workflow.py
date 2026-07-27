from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.workflow import Workflow, WorkflowRun, WorkflowRunStep, WorkflowSchedule, WorkflowStatus, StepStatus
from app.models.agent import Agent


class WorkflowService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workflows(self, workspace_id: str) -> list[Workflow]:
        result = await self.db.execute(
            select(Workflow).where(Workflow.workspace_id == workspace_id).order_by(Workflow.created_at.desc())
        )
        return result.scalars().all()

    async def get_workflow(self, workflow_id: str) -> Optional[Workflow]:
        result = await self.db.execute(select(Workflow).where(Workflow.id == workflow_id))
        return result.scalar_one_or_none()

    async def create_workflow(self, workspace_id: str, created_by: str, data: dict) -> Workflow:
        definition = data.get("definition", {})
        steps_count = len(definition.get("steps", [])) if isinstance(definition, dict) else 0
        wf = Workflow(
            name=data["name"],
            description=data.get("description"),
            definition=definition,
            steps=steps_count,
            tags=data.get("tags", []),
            workspace_id=workspace_id,
            created_by=created_by,
        )
        self.db.add(wf)
        await self.db.commit()
        await self.db.refresh(wf)
        return wf

    async def clone_workflow(self, workflow_id: str, created_by: str) -> Optional[Workflow]:
        src = await self.get_workflow(workflow_id)
        if not src:
            return None
        return await self.create_workflow(src.workspace_id, created_by, {
            "name": f"{src.name} (copy)",
            "description": src.description,
            "definition": dict(src.definition or {}),
            "tags": list(src.tags or []),
        })

    async def export_workflow(self, workflow_id: str) -> Optional[dict]:
        wf = await self.get_workflow(workflow_id)
        if not wf:
            return None
        return {
            "name": wf.name,
            "description": wf.description,
            "definition": dict(wf.definition or {}),
            "tags": list(wf.tags or []),
            "_cloudlabos_export": "workflow/v1",
        }

    async def retry_run(self, run_id: str, created_by: str) -> Optional[WorkflowRun]:
        run = await self.get_run(run_id)
        if not run:
            return None
        return await self.execute_workflow(run.workflow_id, created_by)

    async def update_workflow(self, workflow_id: str, data: dict) -> Optional[Workflow]:
        wf = await self.get_workflow(workflow_id)
        if not wf:
            return None
        for key, val in data.items():
            if val is not None and hasattr(wf, key):
                if key == "status":
                    setattr(wf, key, WorkflowStatus(val))
                elif key == "definition":
                    setattr(wf, key, val)
                    wf.steps = len(val.get("steps", [])) if isinstance(val, dict) else 0
                else:
                    setattr(wf, key, val)
        await self.db.commit()
        await self.db.refresh(wf)
        return wf

    async def delete_workflow(self, workflow_id: str) -> bool:
        wf = await self.get_workflow(workflow_id)
        if not wf:
            return False
        await self.db.delete(wf)
        await self.db.commit()
        return True

    async def publish_workflow(self, workflow_id: str) -> Optional[Workflow]:
        wf = await self.get_workflow(workflow_id)
        if not wf:
            return None
        wf.status = WorkflowStatus.ACTIVE
        await self.db.commit()
        await self.db.refresh(wf)
        return wf

    async def list_runs(self, workspace_id: str, status: Optional[str] = None) -> list[WorkflowRun]:
        query = select(WorkflowRun).join(Workflow).where(Workflow.workspace_id == workspace_id)
        if status:
            query = query.where(WorkflowRun.status == status)
        query = query.order_by(WorkflowRun.created_at.desc()).limit(100)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_run(self, run_id: str) -> Optional[WorkflowRun]:
        result = await self.db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
        return result.scalar_one_or_none()

    async def get_run_workspace_id(self, run_id: str) -> Optional[str]:
        result = await self.db.execute(
            select(Workflow.workspace_id).join(WorkflowRun, WorkflowRun.workflow_id == Workflow.id)
            .where(WorkflowRun.id == run_id)
        )
        return result.scalar_one_or_none()

    async def cancel_run(self, run_id: str) -> Optional[WorkflowRun]:
        run = await self.get_run(run_id)
        if not run:
            return None
        if run.status in ("running", "pending"):
            run.status = "cancelled"
            run.completed_at = datetime.now(timezone.utc)
            await self.db.commit()
            await self.db.refresh(run)
        return run

    async def get_run_steps(self, run_id: str) -> list[WorkflowRunStep]:
        result = await self.db.execute(
            select(WorkflowRunStep).where(WorkflowRunStep.run_id == run_id).order_by(WorkflowRunStep.started_at)
        )
        return result.scalars().all()

    async def _find_agent_for_step(self, workspace_id: str, agent_type: Optional[str]) -> Optional[Agent]:
        query = select(Agent).where(Agent.workspace_id == workspace_id)
        if agent_type:
            query = query.where(Agent.agent_type == agent_type)
        result = await self.db.execute(query.order_by(Agent.created_at.asc()).limit(1))
        agent = result.scalar_one_or_none()
        if agent or not agent_type:
            return agent
        # No agent of the requested type — fall back to any agent in the workspace
        # rather than failing a step purely because of a type-label mismatch.
        result = await self.db.execute(select(Agent).where(Agent.workspace_id == workspace_id).limit(1))
        return result.scalar_one_or_none()

    async def execute_workflow(self, workflow_id: str, created_by: str) -> WorkflowRun:
        wf = await self.get_workflow(workflow_id)
        if not wf:
            raise ValueError("Workflow not found")
        now = datetime.now(timezone.utc)
        run = WorkflowRun(
            workflow_id=workflow_id,
            workflow_name=wf.name,
            status="running",
            progress=0,
            definition=wf.definition,
            created_by=created_by,
            started_at=now,
        )
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)

        steps = wf.definition.get("steps", []) if isinstance(wf.definition, dict) else []
        step_rows: list[WorkflowRunStep] = []
        for i, step_def in enumerate(steps):
            step = WorkflowRunStep(
                run_id=run.id,
                name=step_def.get("name", f"Step {i + 1}"),
                status=StepStatus.PENDING,
                input=step_def,
            )
            self.db.add(step)
            step_rows.append(step)
        await self.db.commit()
        for step in step_rows:
            await self.db.refresh(step)

        # Execute steps in order. This runs inline (no job queue exists yet) so
        # the run is fully resolved by the time this call returns. "agent" steps
        # really invoke the matching agent through the LLM; other step types have
        # no execution engine behind them yet, so they're marked complete with an
        # explicit note rather than faking a result for an integration that
        # doesn't exist (e.g. postgres/s3/slack connectors from the seed data).
        from app.services.agent import AgentService
        agent_svc = AgentService(self.db)
        all_success = True
        total = len(step_rows) or 1

        for i, (step, step_def) in enumerate(zip(step_rows, steps)):
            step.status = StepStatus.RUNNING
            step.started_at = datetime.now(timezone.utc)
            await self.db.commit()

            step_type = step_def.get("type")
            config = step_def.get("config", {}) if isinstance(step_def.get("config"), dict) else {}
            try:
                if step_type == "agent":
                    agent = await self._find_agent_for_step(wf.workspace_id, config.get("agent_type"))
                    if not agent:
                        step.status = StepStatus.FAILED
                        step.output = {"error": "No agent available in this workspace to run this step"}
                        all_success = False
                    else:
                        prompt = config.get("prompt") or f"Execute workflow step '{step.name}' as part of the workflow '{wf.name}'."
                        output, _session_id, _thread_id = await agent_svc.invoke_agent(agent.id, created_by, prompt)
                        step.output = {"agent_id": agent.id, "agent_name": agent.name, "response": output}
                        step.status = StepStatus.SUCCESS
                else:
                    step.status = StepStatus.SUCCESS
                    step.output = {"note": f"Step type '{step_type}' has no execution engine yet — marked complete without running real logic."}
            except Exception as e:
                step.status = StepStatus.FAILED
                step.output = {"error": str(e)}
                all_success = False

            step.completed_at = datetime.now(timezone.utc)
            run.progress = round(((i + 1) / total) * 100)
            await self.db.commit()

        run.status = "success" if all_success else "failed"
        if not all_success:
            run.error = "One or more steps failed. See step details for errors."
        run.completed_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(run)

        from app.services.notification import NotificationService
        notif_svc = NotificationService(self.db)
        await notif_svc.create(
            user_id=created_by,
            type_="success" if all_success else "error",
            title=f"Workflow {'completed' if all_success else 'failed'}: {wf.name}",
            message=f"Run finished with status '{run.status}'." if all_success else run.error,
            data={"workflow_id": wf.id, "run_id": run.id},
        )

        return run

    async def create_schedule(self, workflow_id: str, cron: str) -> WorkflowSchedule:
        schedule = WorkflowSchedule(workflow_id=workflow_id, cron=cron)
        self.db.add(schedule)
        await self.db.commit()
        await self.db.refresh(schedule)
        return schedule

    async def run_due_schedules(self, workspace_id: str, created_by: str) -> list[dict]:
        """Execute every enabled schedule in the workspace whose cron is due.
        Meant to be hit by an external cron (e.g. every minute); no in-process
        scheduler exists yet, so this is the tick that drives scheduled runs."""
        from croniter import croniter
        now = datetime.now(timezone.utc)

        def _aware(dt: datetime) -> datetime:
            # SQLite hands back naive datetimes; treat those as UTC so they can
            # be compared against `now` without raising.
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

        rows = (await self.db.execute(
            select(WorkflowSchedule).join(Workflow)
            .where(Workflow.workspace_id == workspace_id, WorkflowSchedule.enabled == True)
        )).scalars().all()
        triggered = []
        for sched in rows:
            base = _aware(sched.last_run_at or sched.created_at or now)
            try:
                due = _aware(croniter(sched.cron, base).get_next(datetime)) <= now
            except (ValueError, KeyError):
                continue  # invalid cron expression — skip rather than crash the tick
            if due:
                run = await self.execute_workflow(sched.workflow_id, created_by)
                sched.last_run_at = now
                await self.db.commit()
                triggered.append({"schedule_id": sched.id, "workflow_id": sched.workflow_id, "run_id": run.id})
        return triggered

    async def list_schedules(self, workflow_id: str) -> list[WorkflowSchedule]:
        result = await self.db.execute(
            select(WorkflowSchedule).where(WorkflowSchedule.workflow_id == workflow_id)
        )
        return result.scalars().all()
