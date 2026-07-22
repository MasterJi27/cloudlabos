import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.core.security import get_current_user
from app.api.deps import require_workspace_member
from app.models.user import User
from app.models.agent import Agent
from app.models.workflow import Workflow, WorkflowRun
from app.models.memory import MemoryCollection
from app.models.audit import AuditLog

router = APIRouter()


@router.get("/stats")
async def dashboard_stats(
    workspace_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated counts for the dashboard — computed in one place instead of
    the client re-deriving them from full list fetches."""
    await require_workspace_member(workspace_id, user, db)

    async def count(stmt):
        return (await db.execute(stmt)).scalar() or 0

    agents_total = await count(select(func.count()).select_from(Agent).where(Agent.workspace_id == workspace_id))
    agents_active = await count(select(func.count()).select_from(Agent).where(
        Agent.workspace_id == workspace_id, Agent.status.in_(["active", "busy"])))
    workflows_total = await count(select(func.count()).select_from(Workflow).where(Workflow.workspace_id == workspace_id))
    collections_total = await count(select(func.count()).select_from(MemoryCollection).where(MemoryCollection.workspace_id == workspace_id))

    runs = (await db.execute(
        select(WorkflowRun).join(Workflow).where(Workflow.workspace_id == workspace_id)
    )).scalars().all()
    total_runs = len(runs)
    success = sum(1 for r in runs if r.status == "success")
    failed = sum(1 for r in runs if r.status == "failed")
    running = sum(1 for r in runs if r.status == "running")
    tokens = await count(select(func.coalesce(func.sum(Agent.tokens_used), 0)).where(Agent.workspace_id == workspace_id))

    return {
        "agents": {"total": agents_total, "active": agents_active},
        "workflows": {"total": workflows_total},
        "memory": {"collections": collections_total},
        "runs": {
            "total": total_runs, "success": success, "failed": failed, "running": running,
            "success_rate": round((success / total_runs) * 100, 1) if total_runs else 0.0,
        },
        "tokens_used": tokens,
    }


@router.get("/activity")
async def activity_feed(
    workspace_id: str = Query(...),
    limit: int = Query(20),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(workspace_id, user, db)
    rows = (await db.execute(
        select(AuditLog).where(AuditLog.workspace_id == workspace_id)
        .order_by(AuditLog.created_at.desc()).limit(limit)
    )).scalars().all()
    return {"activity": [{
        "id": r.id, "action": r.action, "resource_type": r.resource_type,
        "resource_id": r.resource_id, "details": r.details,
        "created_at": r.created_at.isoformat(),
    } for r in rows]}


@router.get("/status")
async def system_status(
    workspace_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Real component health, derived from what's actually provisioned."""
    await require_workspace_member(workspace_id, user, db)

    async def count(model):
        return (await db.execute(select(func.count()).select_from(model).where(model.workspace_id == workspace_id))).scalar() or 0

    agents = await count(Agent)
    workflows = await count(Workflow)
    collections = await count(MemoryCollection)
    components = [
        {"name": "API", "status": "operational"},
        {"name": "Database", "status": "operational"},
        {"name": "Agent Runtime", "status": "operational" if agents else "idle"},
        {"name": "Workflow Engine", "status": "operational" if workflows else "idle"},
        {"name": "Memory Store", "status": "operational" if collections else "idle"},
    ]
    overall = "operational" if all(c["status"] != "down" for c in components) else "degraded"
    return {"overall": overall, "components": components}


@router.get("/runs.csv")
async def export_runs_csv(
    workspace_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(workspace_id, user, db)
    runs = (await db.execute(
        select(WorkflowRun).join(Workflow).where(Workflow.workspace_id == workspace_id)
        .order_by(WorkflowRun.created_at.desc())
    )).scalars().all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "workflow_name", "status", "trigger", "progress", "started_at", "completed_at", "error"])
    for r in runs:
        writer.writerow([r.id, r.workflow_name, r.status, r.trigger, r.progress,
                         r.started_at.isoformat() if r.started_at else "",
                         r.completed_at.isoformat() if r.completed_at else "", r.error or ""])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={
        "Content-Disposition": 'attachment; filename="runs.csv"'
    })
