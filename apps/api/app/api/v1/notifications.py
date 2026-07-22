from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Any
from app.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.notification import NotificationService

router = APIRouter()

DEFAULT_PREFS = {
    "workflow_completed": True,
    "workflow_failed": True,
    "approval_required": True,
    "agent_error": True,
    "weekly_report": False,
}


class PrefsUpdate(BaseModel):
    prefs: dict[str, Any]


@router.get("/preferences")
async def get_preferences(user: User = Depends(get_current_user)):
    return {**DEFAULT_PREFS, **(user.notif_prefs or {})}


@router.put("/preferences")
async def update_preferences(body: PrefsUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user.notif_prefs = {**DEFAULT_PREFS, **(user.notif_prefs or {}), **body.prefs}
    await db.commit()
    return user.notif_prefs


@router.get("/")
async def list_notifications(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = NotificationService(db)
    notifications = await svc.list_for_user(user.id)
    unread = await svc.unread_count(user.id)
    return {
        "notifications": [{
            "id": n.id, "type": n.type, "title": n.title, "message": n.message,
            "data": n.data, "is_read": n.is_read, "created_at": n.created_at.isoformat(),
        } for n in notifications],
        "unread_count": unread,
    }


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = NotificationService(db)
    if not await svc.mark_read(user.id, notification_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"status": "read"}


@router.post("/read-all")
async def mark_all_read(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = NotificationService(db)
    await svc.mark_all_read(user.id)
    return {"status": "all read"}
