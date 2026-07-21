from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.workflow import (
    WorkflowCreate, WorkflowUpdate, WorkflowResponse,
    WorkflowRunResponse, WorkflowRunDetailResponse, WorkflowRunStepResponse,
    ScheduleCreate, ScheduleResponse,
)
from app.services.workflow import WorkflowService
from app.core.security import get_current_user, require_permission
from app.api.deps import require_workspace_member
from app.models.user import User
from typing import Optional

router = APIRouter()


async def _get_workflow_or_404(svc: WorkflowService, workflow_id: str, user: User, db: AsyncSession):
    wf = await svc.get_workflow(workflow_id)
    if not wf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    await require_workspace_member(wf.workspace_id, user, db)
    return wf


# Runs routes must be before /{workflow_id} to avoid path conflicts
@router.get("/runs/all", response_model=list[WorkflowRunResponse])
async def list_runs(
    workspace_id: str = Query(...),
    status: Optional[str] = Query(None),
    user: User = Depends(require_permission("run:read")),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(workspace_id, user, db)
    svc = WorkflowService(db)
    runs = await svc.list_runs(workspace_id, status)
    return [WorkflowRunResponse(
        id=r.id, workflow_id=r.workflow_id,
        workflow_name=r.workflow_name,
        status=r.status, trigger=r.trigger,
        progress=r.progress, error=r.error,
        started_at=r.started_at, completed_at=r.completed_at,
        created_by=r.created_by, created_at=r.created_at,
    ) for r in runs]


@router.delete("/runs/{run_id}", response_model=WorkflowRunResponse)
async def cancel_run(
    run_id: str,
    user: User = Depends(require_permission("run:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    ws_id = await svc.get_run_workspace_id(run_id)
    if not ws_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    await require_workspace_member(ws_id, user, db)
    run = await svc.cancel_run(run_id)
    return WorkflowRunResponse(
        id=run.id, workflow_id=run.workflow_id,
        workflow_name=run.workflow_name,
        status=run.status, trigger=run.trigger,
        progress=run.progress, error=run.error,
        started_at=run.started_at, completed_at=run.completed_at,
        created_by=run.created_by, created_at=run.created_at,
    )


@router.get("/runs/{run_id}", response_model=WorkflowRunDetailResponse)
async def get_run(
    run_id: str,
    user: User = Depends(require_permission("run:read")),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    run = await svc.get_run(run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    ws_id = await svc.get_run_workspace_id(run_id)
    await require_workspace_member(ws_id, user, db)
    steps = await svc.get_run_steps(run_id)
    return WorkflowRunDetailResponse(
        id=run.id, workflow_id=run.workflow_id,
        workflow_name=run.workflow_name,
        status=run.status, trigger=run.trigger,
        progress=run.progress,
        steps=[WorkflowRunStepResponse(
            id=s.id, run_id=s.run_id, name=s.name,
            status=s.status.value if hasattr(s.status, 'value') else s.status,
            input=s.input, output=s.output,
            started_at=s.started_at, completed_at=s.completed_at,
        ) for s in steps],
        error=run.error,
        started_at=run.started_at, completed_at=run.completed_at,
        created_by=run.created_by, created_at=run.created_at,
    )


@router.get("/", response_model=list[WorkflowResponse])
async def list_workflows(
    workspace_id: str = Query(...),
    user: User = Depends(require_permission("workflow:read")),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(workspace_id, user, db)
    svc = WorkflowService(db)
    workflows = await svc.list_workflows(workspace_id)
    return [WorkflowResponse(
        id=w.id, name=w.name, description=w.description,
        status=w.status.value if hasattr(w.status, 'value') else w.status,
        version=w.version, steps=w.steps,
        last_run=None,
        workspace_id=w.workspace_id, created_by=w.created_by,
        created_at=w.created_at,
    ) for w in workflows]


@router.post("/", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    workspace_id: str = Query(...),
    body: WorkflowCreate = ...,
    user: User = Depends(require_permission("workflow:*")),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(workspace_id, user, db)
    svc = WorkflowService(db)
    wf = await svc.create_workflow(workspace_id, user.id, body.model_dump())
    return WorkflowResponse(
        id=wf.id, name=wf.name, description=wf.description,
        status=wf.status.value if hasattr(wf.status, 'value') else wf.status,
        version=wf.version, steps=wf.steps, last_run=None,
        workspace_id=wf.workspace_id, created_by=wf.created_by,
        created_at=wf.created_at,
    )


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: str,
    user: User = Depends(require_permission("workflow:read")),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    wf = await _get_workflow_or_404(svc, workflow_id, user, db)
    return WorkflowResponse(
        id=wf.id, name=wf.name, description=wf.description,
        status=wf.status.value if hasattr(wf.status, 'value') else wf.status,
        version=wf.version, steps=wf.steps, last_run=None,
        workspace_id=wf.workspace_id, created_by=wf.created_by,
        created_at=wf.created_at,
    )


@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    body: WorkflowUpdate,
    user: User = Depends(require_permission("workflow:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    await _get_workflow_or_404(svc, workflow_id, user, db)
    wf = await svc.update_workflow(workflow_id, body.model_dump(exclude_unset=True))
    return WorkflowResponse(
        id=wf.id, name=wf.name, description=wf.description,
        status=wf.status.value if hasattr(wf.status, 'value') else wf.status,
        version=wf.version, steps=wf.steps, last_run=None,
        workspace_id=wf.workspace_id, created_by=wf.created_by,
        created_at=wf.created_at,
    )


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: str,
    user: User = Depends(require_permission("workflow:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    await _get_workflow_or_404(svc, workflow_id, user, db)
    await svc.delete_workflow(workflow_id)


@router.post("/{workflow_id}/publish", response_model=WorkflowResponse)
async def publish_workflow(
    workflow_id: str,
    user: User = Depends(require_permission("workflow:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    await _get_workflow_or_404(svc, workflow_id, user, db)
    wf = await svc.publish_workflow(workflow_id)
    return WorkflowResponse(
        id=wf.id, name=wf.name, description=wf.description,
        status=wf.status.value if hasattr(wf.status, 'value') else wf.status,
        version=wf.version, steps=wf.steps, last_run=None,
        workspace_id=wf.workspace_id, created_by=wf.created_by,
        created_at=wf.created_at,
    )


@router.post("/{workflow_id}/execute", response_model=WorkflowRunResponse)
async def execute_workflow(
    workflow_id: str,
    user: User = Depends(require_permission("workflow:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    await _get_workflow_or_404(svc, workflow_id, user, db)
    try:
        run = await svc.execute_workflow(workflow_id, user.id)
        return WorkflowRunResponse(
            id=run.id, workflow_id=run.workflow_id,
            workflow_name=run.workflow_name,
            status=run.status, trigger=run.trigger,
            progress=run.progress, error=run.error,
            started_at=run.started_at, completed_at=run.completed_at,
            created_by=run.created_by, created_at=run.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{workflow_id}/schedule", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    workflow_id: str,
    body: ScheduleCreate,
    user: User = Depends(require_permission("workflow:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    await _get_workflow_or_404(svc, workflow_id, user, db)
    schedule = await svc.create_schedule(workflow_id, body.cron)
    return ScheduleResponse(
        id=schedule.id, workflow_id=schedule.workflow_id,
        cron=schedule.cron, enabled=schedule.enabled,
        last_run_at=schedule.last_run_at, created_at=schedule.created_at,
    )


@router.get("/{workflow_id}/schedules", response_model=list[ScheduleResponse])
async def list_schedules(
    workflow_id: str,
    user: User = Depends(require_permission("workflow:read")),
    db: AsyncSession = Depends(get_db),
):
    svc = WorkflowService(db)
    await _get_workflow_or_404(svc, workflow_id, user, db)
    schedules = await svc.list_schedules(workflow_id)
    return [ScheduleResponse(
        id=s.id, workflow_id=s.workflow_id,
        cron=s.cron, enabled=s.enabled,
        last_run_at=s.last_run_at, created_at=s.created_at,
    ) for s in schedules]
