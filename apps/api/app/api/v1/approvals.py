from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone
from app.database import get_db
from app.models.user import User
from app.core.security import get_current_user
from app.api.deps import require_workspace_member

router = APIRouter()

store: dict[str, list] = {}
next_id: int = 0


class ApprovalAction(BaseModel):
    notes: Optional[str] = None


class ApprovalResponse(BaseModel):
    id: str
    workflow_id: str
    workflow_name: str
    requester: str
    action: str
    status: str
    risk_score: float
    risk_reasons: list[str]
    created_at: str


@router.get("/")
async def list_approvals(workspace_id: str = Query(...), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_workspace_member(workspace_id, user, db)
    global next_id
    if workspace_id not in store:
        store[workspace_id] = [
            {
                "id": str(uuid.uuid4()),
                "workflow_id": str(uuid.uuid4()),
                "workflow_name": "Data Pipeline Approval",
                "requester": "ci-bot",
                "action": "Deploy to Production",
                "status": "pending",
                "risk_score": 0.35,
                "risk_reasons": ["Writes to production database", "Outside business hours"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "workflow_id": str(uuid.uuid4()),
                "workflow_name": "Security Audit Run",
                "requester": "audit-svc",
                "action": "Execute privileged commands",
                "status": "pending",
                "risk_score": 0.82,
                "risk_reasons": ["Requests elevated/root permissions", "Command allowlist not configured"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "workflow_id": str(uuid.uuid4()),
                "workflow_name": "Database Migration",
                "requester": "devops-bot",
                "action": "Apply schema changes",
                "status": "approved",
                "risk_score": 0.55,
                "risk_reasons": ["Schema change is irreversible without a backup"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        ]
    return store[workspace_id]


@router.post("/{approval_id}/approve")
async def approve_action(approval_id: str, body: ApprovalAction = ApprovalAction(), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    for ws_id, approvals in store.items():
        for a in approvals:
            if a["id"] == approval_id:
                await require_workspace_member(ws_id, user, db)
                a["status"] = "approved"
                a["notes"] = body.notes
                return {"status": "approved", "approval_id": approval_id}
    raise HTTPException(status_code=404, detail="Approval not found")


@router.post("/{approval_id}/reject")
async def reject_action(approval_id: str, body: ApprovalAction = ApprovalAction(), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    for ws_id, approvals in store.items():
        for a in approvals:
            if a["id"] == approval_id:
                await require_workspace_member(ws_id, user, db)
                a["status"] = "rejected"
                a["notes"] = body.notes
                return {"status": "rejected", "approval_id": approval_id}
    raise HTTPException(status_code=404, detail="Approval not found")
