from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.database import get_db
from app.core.security import get_current_user
from app.api.deps import require_workspace_member
from app.models.user import User
from app.services.audit import AuditService

router = APIRouter()


@router.get("/")
async def list_audit(
    workspace_id: str = Query(...),
    action: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(workspace_id, user, db)
    svc = AuditService(db)
    rows = await svc.list_for_workspace(workspace_id, limit=limit, action=action)
    return {"entries": [{
        "id": r.id, "user_id": r.user_id, "action": r.action,
        "resource_type": r.resource_type, "resource_id": r.resource_id,
        "details": r.details, "created_at": r.created_at.isoformat(),
    } for r in rows]}
