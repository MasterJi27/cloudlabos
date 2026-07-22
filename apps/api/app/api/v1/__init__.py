from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.workspaces import router as workspaces_router
from app.api.v1.agents import router as agents_router
from app.api.v1.workflows import router as workflows_router
from app.api.v1.memory import router as memory_router
from app.api.v1.settings import router as settings_router
from app.api.v1.approvals import router as approvals_router
from app.api.v1.billing import router as billing_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.plugins import router as plugins_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.search import router as search_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.audit import router as audit_router
from app.api.v1.research import router as research_router

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
v1_router.include_router(users_router, prefix="/users", tags=["Users"])
v1_router.include_router(workspaces_router, prefix="/workspaces", tags=["Workspaces"])
v1_router.include_router(agents_router, prefix="/agents", tags=["Agents"])
v1_router.include_router(workflows_router, prefix="/workflows", tags=["Workflows"])
v1_router.include_router(memory_router, prefix="/memory", tags=["Memory"])
v1_router.include_router(settings_router, prefix="/settings", tags=["Settings"])
v1_router.include_router(approvals_router, prefix="/approvals", tags=["Approvals"])
v1_router.include_router(billing_router, prefix="/billing", tags=["Billing"])
v1_router.include_router(webhooks_router, prefix="/webhooks", tags=["Webhooks"])
v1_router.include_router(plugins_router, prefix="/plugins", tags=["Plugins"])
v1_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
v1_router.include_router(search_router, prefix="/search", tags=["Search"])
v1_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
v1_router.include_router(audit_router, prefix="/audit", tags=["Audit"])
v1_router.include_router(research_router, prefix="/research", tags=["Research"])
