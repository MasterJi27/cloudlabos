from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.workflow import Workflow, WorkflowRun, WorkflowRunStep, WorkflowSchedule, WorkflowStatus, StepStatus


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
            workspace_id=workspace_id,
            created_by=created_by,
        )
        self.db.add(wf)
        await self.db.commit()
        await self.db.refresh(wf)
        return wf

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
        for i, step_def in enumerate(steps):
            step = WorkflowRunStep(
                run_id=run.id,
                name=step_def.get("name", f"Step {i+1}"),
                status=StepStatus.PENDING,
                input=step_def,
            )
            self.db.add(step)
        run.progress = 0
        await self.db.commit()
        await self.db.refresh(run)
        return run

    async def create_schedule(self, workflow_id: str, cron: str) -> WorkflowSchedule:
        schedule = WorkflowSchedule(workflow_id=workflow_id, cron=cron)
        self.db.add(schedule)
        await self.db.commit()
        await self.db.refresh(schedule)
        return schedule

    async def list_schedules(self, workflow_id: str) -> list[WorkflowSchedule]:
        result = await self.db.execute(
            select(WorkflowSchedule).where(WorkflowSchedule.workflow_id == workflow_id)
        )
        return result.scalars().all()
