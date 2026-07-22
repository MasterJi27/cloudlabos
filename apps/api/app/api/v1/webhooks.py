import time
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import uuid
import random
import httpx
from datetime import datetime, timezone
from app.database import get_db
from app.models.user import User
from app.core.security import get_current_user
from app.api.deps import require_workspace_member

router = APIRouter()

stores: dict[str, list] = {}
deliveries: dict[str, list] = {}


class WebhookCreate(BaseModel):
    name: str
    url: str
    events: list[str]
    secret: Optional[str] = None


class WebhookUpdate(BaseModel):
    active: Optional[bool] = None
    name: Optional[str] = None
    url: Optional[str] = None
    events: Optional[list[str]] = None


@router.get("/")
async def list_webhooks(workspace_id: str = Query(...), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_workspace_member(workspace_id, user, db)
    if workspace_id not in stores:
        stores[workspace_id] = [
            { "id": str(uuid.uuid4()), "name": "Slack Notifier", "url": "https://hooks.slack.com/services/T00/B00/xxx", "events": ["run.completed", "agent.error"], "active": True, "created_at": datetime.now(timezone.utc).isoformat() },
            { "id": str(uuid.uuid4()), "name": "Datadog Metrics", "url": "https://api.datadoghq.com/api/v2/series", "events": ["workflow.started", "workflow.completed"], "active": True, "created_at": datetime.now(timezone.utc).isoformat() },
            { "id": str(uuid.uuid4()), "name": "PagerDuty Alert", "url": "https://events.pagerduty.com/v2/enqueue", "events": ["run.failed", "agent.crashed"], "active": False, "created_at": datetime.now(timezone.utc).isoformat() },
        ]
        deliveries[workspace_id] = [
            { "id": str(uuid.uuid4()), "webhook_id": stores[workspace_id][0]["id"], "event": "run.completed", "status": random.choice(["success", "success", "success", "failed"]), "duration": f"{random.randint(100, 2000)}ms", "created_at": datetime.now(timezone.utc).isoformat() },
            { "id": str(uuid.uuid4()), "webhook_id": stores[workspace_id][1]["id"], "event": "workflow.started", "status": "success", "duration": "450ms", "created_at": datetime.now(timezone.utc).isoformat() },
        ]
    return stores[workspace_id]


@router.post("/")
async def create_webhook(body: WebhookCreate, workspace_id: str = Query(...), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_workspace_member(workspace_id, user, db)
    data = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "url": body.url,
        "events": body.events,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if workspace_id not in stores:
        stores[workspace_id] = []
    stores[workspace_id].append(data)
    return data


@router.patch("/{webhook_id}")
async def update_webhook(webhook_id: str, body: WebhookUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    for ws_id, hooks in stores.items():
        for h in hooks:
            if h["id"] == webhook_id:
                await require_workspace_member(ws_id, user, db)
                update = body.model_dump(exclude_unset=True)
                h.update(update)
                return h
    raise HTTPException(status_code=404, detail="Webhook not found")


@router.delete("/{webhook_id}")
async def delete_webhook(webhook_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    for ws_id, hooks in stores.items():
        for h in hooks:
            if h["id"] == webhook_id:
                await require_workspace_member(ws_id, user, db)
                hooks.remove(h)
                return {"status": "deleted", "webhook_id": webhook_id}
    raise HTTPException(status_code=404, detail="Webhook not found")


@router.get("/deliveries")
async def list_deliveries(workspace_id: str = Query(...), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_workspace_member(workspace_id, user, db)
    return deliveries.get(workspace_id, [])


@router.post("/{webhook_id}/test")
async def test_webhook(webhook_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    webhook = None
    ws_id = None
    for wid, hooks in stores.items():
        for h in hooks:
            if h["id"] == webhook_id:
                webhook, ws_id = h, wid
                break
        if webhook:
            break
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await require_workspace_member(ws_id, user, db)

    payload = {"event": "test.event", "webhook_id": webhook_id, "triggered_by": user.email,
               "timestamp": datetime.now(timezone.utc).isoformat()}
    started = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook["url"], json=payload)
        duration_ms = int((time.monotonic() - started) * 1000)
        status_ = "success" if resp.status_code < 400 else "failed"
    except Exception:
        duration_ms = int((time.monotonic() - started) * 1000)
        status_ = "failed"

    delivery = {
        "id": str(uuid.uuid4()), "webhook_id": webhook_id, "event": "test.event",
        "status": status_, "duration": f"{duration_ms}ms",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    deliveries.setdefault(ws_id, []).insert(0, delivery)
    return {"status": status_, "duration": f"{duration_ms}ms"}
