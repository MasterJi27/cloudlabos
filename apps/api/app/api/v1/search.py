from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.core.security import get_current_user
from app.api.deps import require_workspace_member
from app.models.user import User
from app.models.agent import Agent
from app.models.workflow import Workflow, WorkflowRun
from app.models.memory import MemoryCollection, MemoryItem

router = APIRouter()


@router.get("/")
async def global_search(
    workspace_id: str = Query(...),
    q: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search agents, workflows, memory, and runs in one call — powers the
    command palette's global search."""
    await require_workspace_member(workspace_id, user, db)
    like = f"%{q.lower()}%"
    results: list[dict] = []

    agents = (await db.execute(
        select(Agent).where(Agent.workspace_id == workspace_id).limit(50)
    )).scalars().all()
    for a in agents:
        if q.lower() in (a.name or "").lower() or q.lower() in (a.description or "").lower():
            results.append({"type": "agent", "id": a.id, "title": a.name,
                            "subtitle": a.agent_type, "url": f"/agents/{a.id}"})

    workflows = (await db.execute(
        select(Workflow).where(Workflow.workspace_id == workspace_id).limit(50)
    )).scalars().all()
    for w in workflows:
        if q.lower() in (w.name or "").lower() or q.lower() in (w.description or "").lower():
            results.append({"type": "workflow", "id": w.id, "title": w.name,
                            "subtitle": w.description or "Workflow", "url": "/workflows"})

    collections = (await db.execute(
        select(MemoryCollection).where(MemoryCollection.workspace_id == workspace_id)
    )).scalars().all()
    col_ids = [c.id for c in collections]
    for c in collections:
        if q.lower() in (c.name or "").lower():
            results.append({"type": "collection", "id": c.id, "title": c.name,
                            "subtitle": "Memory collection", "url": "/memory"})
    if col_ids:
        items = (await db.execute(
            select(MemoryItem).where(MemoryItem.collection_id.in_(col_ids), MemoryItem.content.ilike(like)).limit(20)
        )).scalars().all()
        for it in items:
            results.append({"type": "memory", "id": it.id, "title": it.content[:60],
                            "subtitle": "Memory item", "url": "/memory"})

    runs = (await db.execute(
        select(WorkflowRun).join(Workflow).where(
            Workflow.workspace_id == workspace_id, WorkflowRun.workflow_name.ilike(like)
        ).limit(20)
    )).scalars().all()
    for r in runs:
        results.append({"type": "run", "id": r.id, "title": r.workflow_name,
                        "subtitle": f"Run · {r.status}", "url": "/runs"})

    return {"query": q, "count": len(results), "results": results[:50]}
