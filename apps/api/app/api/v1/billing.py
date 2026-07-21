from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

router = APIRouter()

PLANS = [
    {"id": "free", "name": "Free", "price": 0, "agents": 3, "workflows": 5, "runs": 100, "features": ["Core agent runtime", "Basic workflows", "Community support"]},
    {"id": "pro", "name": "Pro", "price": 29, "agents": 20, "workflows": 50, "runs": 5000, "features": ["All Free features", "Advanced agents", "Priority support", "Custom tools"]},
    {"id": "team", "name": "Team", "price": 99, "agents": 100, "workflows": 200, "runs": 50000, "features": ["All Pro features", "Team workspaces", "API access", "Audit logs"]},
    {"id": "enterprise", "name": "Enterprise", "price": 499, "agents": 1000, "workflows": 1000, "runs": 1000000, "features": ["All Team features", "SSO/SAML", "Dedicated infra", "24/7 support"]},
]

subscriptions: dict[str, dict] = {}


class SubscriptionUpdate(BaseModel):
    plan_id: str


@router.get("/plans")
async def get_plans():
    return PLANS


@router.get("/subscription")
async def get_subscription(workspace_id: str = ""):
    sub = subscriptions.get(workspace_id) or {
        "plan_id": "pro",
        "plan_name": "Pro",
        "price": 29,
        "status": "active",
        "billing_cycle": "monthly",
        "next_billing_date": datetime.now(timezone.utc).isoformat(),
        "usage": {
            "agents_used": 5,
            "workflows_used": 12,
            "runs_this_month": 342,
            "runs_limit": 5000,
        },
    }
    return sub


@router.put("/subscription")
async def update_subscription(body: SubscriptionUpdate, workspace_id: str = ""):
    plan = next((p for p in PLANS if p["id"] == body.plan_id), None)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    subscriptions[workspace_id] = {
        "plan_id": plan["id"],
        "plan_name": plan["name"],
        "price": plan["price"],
        "status": "active",
        "billing_cycle": "monthly",
        "next_billing_date": datetime.now(timezone.utc).isoformat(),
        "usage": {
            "agents_used": 5,
            "workflows_used": 12,
            "runs_this_month": 342,
            "runs_limit": plan["runs"],
        },
    }
    return subscriptions[workspace_id]
