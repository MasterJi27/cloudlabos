"""CloudLabOS API Gateway - Main Application"""

from __future__ import annotations

import json
import os
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import asyncpg
import bcrypt
import httpx
import prometheus_client
import pyotp
import redis.asyncio as aioredis
import secrets
import string
import structlog
import uuid
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict

# Structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://cloudlabos:cloudlabos@localhost:5432/cloudlabos"
    REDIS_URL: str = "redis://localhost:6379"
    JWT_SECRET: str = ""
    ENCRYPTION_KEY: str = ""
    AGENT_SERVICE_URL: str = "http://localhost:8001"
    WORKFLOW_ENGINE_URL: str = "http://localhost:8002"
    MEMORY_SERVICE_URL: str = "http://localhost:8003"
    BROWSER_SERVICE_URL: str = "http://localhost:8004"
    RESEARCH_SERVICE_URL: str = "http://localhost:8005"
    CORS_ORIGINS: str = "http://localhost:3000"
    API_PORT: int = 8000
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

# Global state
db_pool: Optional[asyncpg.Pool] = None
redis_client: Optional[aioredis.Redis] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle"""
    global db_pool, redis_client

    # Startup
    if settings.ENVIRONMENT.lower() in {"production", "prod"}:
        unsafe_values = {"", "change-me", "cloudlabos_secure_pass_2024", "cloudlabos_redis_pass_2024"}
        if settings.JWT_SECRET in unsafe_values or len(settings.JWT_SECRET) < 32:
            raise RuntimeError("JWT_SECRET must be a unique value of at least 32 characters in production")
        if settings.ENCRYPTION_KEY in unsafe_values or len(settings.ENCRYPTION_KEY) < 32:
            raise RuntimeError("ENCRYPTION_KEY must be a unique value of at least 32 characters in production")
    logger.info("api_gateway.starting")
    db_pool = await asyncpg.create_pool(settings.DATABASE_URL)
    redis_client = await aioredis.from_url(settings.REDIS_URL, decode_responses=True, protocol=2)
    logger.info("api_gateway.ready", port=settings.API_PORT)

    yield

    # Shutdown
    logger.info("api_gateway.stopping")
    await db_pool.close()
    await redis_client.close()


app = FastAPI(
    title="CloudLabOS API",
    description="Enterprise AI Workflow Operating System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - restrict to configured origins
allowed_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def accept_bearer_tokens(request: Request, call_next):
    """Bridge Bearer authentication to legacy route signatures without exposing tokens in URLs."""
    if "token=" not in request.scope.get("query_string", b"").decode("latin-1"):
        authorization = request.headers.get("authorization", "")
        if authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
            if token:
                query = request.scope.get("query_string", b"")
                separator = b"&" if query else b""
                request.scope["query_string"] = query + separator + b"token=" + token.encode("utf-8")
    return await call_next(request)


# ============ Models ============

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: str
    password: str
    name: str


class WorkspaceCreate(BaseModel):
    name: str


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    definition: Dict[str, Any]


class WorkflowExecute(BaseModel):
    input_payload: Dict[str, Any] = {}
    trigger_type: str = "manual"
    approval_mode: str = "policy"
    timeout_seconds: int = 3600


class ArtifactCreate(BaseModel):
    name: str
    content_type: str
    storage_url: str
    checksum_sha256: Optional[str] = None
    size_bytes: Optional[int] = None
    step_id: Optional[str] = None


class WorkflowScheduleCreate(BaseModel):
    cron_expression: str
    timezone: str = "UTC"
    input_payload: Dict[str, Any] = {}


class ExecutionPolicyCreate(BaseModel):
    name: str
    allowed_domains: List[str] = []
    denied_commands: List[str] = []
    approval_threshold: float = 0.7
    monthly_budget_cents: Optional[int] = None


class ApprovalAction(BaseModel):
    reviewer_notes: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class EmailVerifySend(BaseModel):
    email: str


class EmailVerifyConfirm(BaseModel):
    email: str
    code: str


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class OAuthCallback(BaseModel):
    code: str
    state: str


class MFASetupResponse(BaseModel):
    secret: str
    qr_uri: str


class MFAVerify(BaseModel):
    code: str


class MFADisable(BaseModel):
    code: str


class ApiKeyCreate(BaseModel):
    name: str
    workspace_id: Optional[str] = None


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    created_at: str
    last_used_at: Optional[str] = None


class ApiKeyCreatedResponse(ApiKeyResponse):
    raw_key: str


class WorkspaceInvite(BaseModel):
    email: str
    role: str = "member"


class SubscriptionCreate(BaseModel):
    plan: str
    payment_method_id: Optional[str] = None


class WebhookCreate(BaseModel):
    url: str
    events: List[str]
    secret: Optional[str] = None


class WebhookUpdate(BaseModel):
    url: Optional[str] = None
    events: Optional[List[str]] = None
    secret: Optional[str] = None


class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    notification_type: str = "info"
    workspace_id: Optional[str] = None


class StripeWebhookEvent(BaseModel):
    type: str
    data: Dict[str, Any]


class PluginUpdate(BaseModel):
    name: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None


# ============ Auth ============

def create_access_token(data: Dict, expires_delta: timedelta = timedelta(hours=1)) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")


def validate_password(password: str) -> None:
    if len(password) < 12 or not re.search(r"[a-z]", password) or not re.search(r"[A-Z]", password) or not re.search(r"\d", password):
        raise HTTPException(
            status_code=422,
            detail="Password must be at least 12 characters and include upper-case, lower-case, and numeric characters",
        )


def get_current_user(token: str) -> Dict[str, Any]:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )


async def require_workspace_access(workspace_id: str, user_id: str, roles: Optional[set[str]] = None) -> str:
    """Ensure the caller belongs to the workspace and, when required, has a suitable role."""
    membership = await db_pool.fetchrow(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        workspace_id,
        user_id,
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Workspace access denied")
    role = membership["role"]
    if roles and role not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient workspace role")
    return role


def validate_workflow_definition(definition: Dict[str, Any]) -> None:
    """Reject malformed DAGs before they can enter the execution queue."""
    steps = definition.get("steps")
    if not isinstance(steps, list) or not steps:
        raise HTTPException(status_code=422, detail="Workflow definition requires at least one step")

    step_ids = [step.get("step_id") for step in steps if isinstance(step, dict)]
    if len(step_ids) != len(steps) or any(not isinstance(step_id, str) or not step_id.strip() for step_id in step_ids):
        raise HTTPException(status_code=422, detail="Every workflow step requires a non-empty step_id")
    if len(set(step_ids)) != len(step_ids):
        raise HTTPException(status_code=422, detail="Workflow step_id values must be unique")

    known = set(step_ids)
    for step in steps:
        if not step.get("agent_type") or not step.get("task_type"):
            raise HTTPException(status_code=422, detail=f"Step {step['step_id']} requires agent_type and task_type")
        dependencies = step.get("depends_on", [])
        if not isinstance(dependencies, list) or any(dep not in known or dep == step["step_id"] for dep in dependencies):
            raise HTTPException(status_code=422, detail=f"Step {step['step_id']} has an invalid dependency")

    unresolved = {step["step_id"]: set(step.get("depends_on", [])) for step in steps}
    resolved: set[str] = set()
    while unresolved:
        ready = [step_id for step_id, dependencies in unresolved.items() if dependencies <= resolved]
        if not ready:
            raise HTTPException(status_code=422, detail="Workflow definition contains a dependency cycle")
        for step_id in ready:
            resolved.add(step_id)
            unresolved.pop(step_id)


# ============ Routes ============

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "api-gateway",
    }


@app.get("/ready")
async def readiness_check():
    """Readiness probe"""
    try:
        await db_pool.fetchval("SELECT 1")
        await redis_client.ping()
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


# Auth endpoints
@app.post("/api/v1/auth/login", response_model=TokenResponse)
async def login(login_data: LoginRequest):
    """Login with email/password"""
    user = await db_pool.fetchrow(
        "SELECT id, email, name, role, password_hash FROM users WHERE email = $1", login_data.email
    )

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Verify password hash
    if user["password_hash"]:
        stored_hash = user["password_hash"].encode("utf-8") if isinstance(user["password_hash"], str) else user["password_hash"]
        if not bcrypt.checkpw(login_data.password.encode("utf-8"), stored_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
    else:
        # Fallback for users without password hash (legacy) - reject
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({
        "sub": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
    })

    # Update last login
    await db_pool.execute(
        "UPDATE users SET last_login_at = NOW() WHERE id = $1", user["id"]
    )

    return TokenResponse(access_token=token)


@app.post("/api/v1/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """Register new user"""
    validate_password(user_data.password)
    # Hash the password
    password_hash = bcrypt.hashpw(user_data.password.encode("utf-8"), bcrypt.gensalt())

    try:
        user_id = await db_pool.fetchval(
            """
            INSERT INTO users (email, name, password_hash, role, settings)
            VALUES ($1, $2, $3, 'viewer', '{}'::jsonb)
            RETURNING id
            """,
            user_data.email,
            user_data.name,
            password_hash.decode("utf-8"),
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=400, detail="Email already registered")

    token = create_access_token({
        "sub": str(user_id),
        "email": user_data.email,
        "name": user_data.name,
        "role": "viewer",
    })

    return TokenResponse(access_token=token)


@app.get("/api/v1/auth/me")
async def get_current_user_info(token: str = None):
    """Get current user info"""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_data = get_current_user(token)
    return {
        "id": user_data.get("sub"),
        "email": user_data.get("email"),
        "name": user_data.get("name"),
        "role": user_data.get("role"),
    }


# Workspace endpoints
@app.get("/api/v1/workspaces")
async def list_workspaces(token: str):
    """List workspaces for current user"""
    user_data = get_current_user(token)
    rows = await db_pool.fetch(
        """
        SELECT w.id, w.name, w.created_at, wm.role as member_role
        FROM workspaces w
        JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = $1
        ORDER BY w.created_at DESC
        """,
        user_data.get("sub"),
    )
    return [{"id": str(r["id"]), "name": r["name"], "created_at": r["created_at"].isoformat(), "role": r["member_role"]} for r in rows]


@app.post("/api/v1/workspaces")
async def create_workspace(workspace: WorkspaceCreate, token: str):
    """Create new workspace"""
    user_data = get_current_user(token)
    workspace_id = await db_pool.fetchval(
        """
        INSERT INTO workspaces (name, owner_id)
        VALUES ($1, $2)
        RETURNING id
        """,
        workspace.name,
        user_data.get("sub"),
    )

    # Add creator as admin
    await db_pool.execute(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')",
        workspace_id,
        user_data.get("sub"),
    )

    return {"id": str(workspace_id), "name": workspace.name}


# Workflow endpoints
@app.get("/api/v1/workflows")
async def list_workflows(workspace_id: str, token: str):
    """List workflows in workspace"""
    user_data = get_current_user(token)
    await require_workspace_access(workspace_id, user_data["sub"])
    rows = await db_pool.fetch(
        """
        SELECT id, name, description, status, version, created_at, updated_at
        FROM workflows
        WHERE workspace_id = $1 AND status != 'archived'
        ORDER BY updated_at DESC
        """,
        workspace_id,
    )
    return [
        {
            "id": str(r["id"]),
            "name": r["name"],
            "description": r["description"],
            "status": r["status"],
            "version": r["version"],
            "created_at": r["created_at"].isoformat(),
            "updated_at": r["updated_at"].isoformat(),
        }
        for r in rows
    ]


@app.get("/api/v1/workflows/{workflow_id}")
async def get_workflow(workflow_id: str, token: str):
    """Get workflow definition"""
    user_data = get_current_user(token)
    row = await db_pool.fetchrow(
        "SELECT id, workspace_id, name, description, definition, status, version FROM workflows WHERE id = $1",
        workflow_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await require_workspace_access(str(row["workspace_id"]), user_data["sub"])
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "description": row["description"],
        "definition": row["definition"],
        "status": row["status"],
        "version": row["version"],
    }


@app.post("/api/v1/workflows")
async def create_workflow(workflow: WorkflowCreate, workspace_id: str, token: str):
    """Create new workflow"""
    user_data = get_current_user(token)
    await require_workspace_access(workspace_id, user_data["sub"], {"admin", "editor"})
    validate_workflow_definition(workflow.definition)
    workflow_id = await db_pool.fetchval(
        """
        INSERT INTO workflows (workspace_id, name, description, definition, status, created_by)
        VALUES ($1, $2, $3, $4::jsonb, 'draft', $5)
        RETURNING id
        """,
        workspace_id,
        workflow.name,
        workflow.description,
        workflow.definition,
        user_data.get("sub"),
    )
    return {"id": str(workflow_id), "name": workflow.name}


@app.post("/api/v1/workflows/{workflow_id}/publish")
async def publish_workflow(workflow_id: str, token: str):
    user_data = get_current_user(token)
    workflow = await db_pool.fetchrow("SELECT workspace_id, definition, version FROM workflows WHERE id = $1", workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await require_workspace_access(str(workflow["workspace_id"]), user_data["sub"], {"admin", "editor"})
    next_version = workflow["version"] + 1
    await db_pool.execute("INSERT INTO workflow_versions (workflow_id, version, definition, created_by) VALUES ($1, $2, $3::jsonb, $4)", workflow_id, next_version, workflow["definition"], user_data["sub"])
    await db_pool.execute("UPDATE workflows SET status = 'active', version = $1, updated_at = NOW() WHERE id = $2", next_version, workflow_id)
    return {"id": workflow_id, "status": "active", "version": next_version}


@app.get("/api/v1/workflows/{workflow_id}/versions")
async def list_workflow_versions(workflow_id: str, token: str):
    user_data = get_current_user(token)
    workspace_id = await db_pool.fetchval("SELECT workspace_id FROM workflows WHERE id = $1", workflow_id)
    if not workspace_id:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await require_workspace_access(str(workspace_id), user_data["sub"])
    rows = await db_pool.fetch("SELECT id, version, created_at FROM workflow_versions WHERE workflow_id = $1 ORDER BY version DESC", workflow_id)
    return [{"id": str(row["id"]), "version": row["version"], "created_at": row["created_at"].isoformat()} for row in rows]


@app.post("/api/v1/workflows/{workflow_id}/rollback/{version}")
async def rollback_workflow(workflow_id: str, version: int, token: str):
    """Restore a previous workflow version. Creates a new version snapshot first, then restores."""
    user_data = get_current_user(token)
    wf = await db_pool.fetchrow("SELECT workspace_id, definition, version FROM workflows WHERE id = $1", workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await require_workspace_access(str(wf["workspace_id"]), user_data["sub"], {"admin", "editor"})

    version_row = await db_pool.fetchrow(
        "SELECT definition FROM workflow_versions WHERE workflow_id = $1 AND version = $2",
        workflow_id, version,
    )
    if not version_row:
        raise HTTPException(status_code=404, detail=f"Version {version} not found")

    next_version = wf["version"] + 1
    async with db_pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "INSERT INTO workflow_versions (workflow_id, version, definition, created_by) VALUES ($1, $2, $3::jsonb, $4)",
                workflow_id, next_version, wf["definition"], user_data["sub"],
            )
            await conn.execute(
                "UPDATE workflows SET definition = $1::jsonb, version = $2, status = 'active', updated_at = NOW() WHERE id = $3",
                version_row["definition"], next_version, workflow_id,
            )

    return {"id": workflow_id, "version": next_version, "rolled_back_to": version}


@app.post("/api/v1/workflows/{workflow_id}/schedules")
async def create_workflow_schedule(workflow_id: str, data: WorkflowScheduleCreate, token: str):
    user_data = get_current_user(token)
    if not re.fullmatch(r"[0-9*/?,\-\sA-Z]+", data.cron_expression, re.IGNORECASE):
        raise HTTPException(status_code=422, detail="Invalid cron expression")
    workflow = await db_pool.fetchrow("SELECT workspace_id FROM workflows WHERE id = $1", workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await require_workspace_access(str(workflow["workspace_id"]), user_data["sub"], {"admin", "editor"})
    schedule_id = await db_pool.fetchval("INSERT INTO workflow_schedules (workflow_id, workspace_id, cron_expression, timezone, input_payload, created_by) VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id", workflow_id, workflow["workspace_id"], data.cron_expression, data.timezone, data.input_payload, user_data["sub"])
    return {"id": str(schedule_id), "workflow_id": workflow_id, "enabled": True}


@app.get("/api/v1/workflows/{workflow_id}/schedules")
async def list_workflow_schedules(workflow_id: str, token: str):
    user_data = get_current_user(token)
    wf = await db_pool.fetchrow("SELECT workspace_id FROM workflows WHERE id = $1", workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await require_workspace_access(str(wf["workspace_id"]), user_data["sub"])
    rows = await db_pool.fetch(
        """SELECT id, workflow_id, cron_expression, timezone, enabled, input_payload,
                  next_run_at, last_run_at, created_at
           FROM workflow_schedules WHERE workflow_id = $1 ORDER BY created_at DESC""",
        workflow_id,
    )
    return [
        {
            "id": str(r["id"]),
            "workflow_id": str(r["workflow_id"]),
            "cron_expression": r["cron_expression"],
            "timezone": r["timezone"],
            "enabled": r["enabled"],
            "input_payload": r["input_payload"],
            "next_run_at": r["next_run_at"].isoformat() if r["next_run_at"] else None,
            "last_run_at": r["last_run_at"].isoformat() if r["last_run_at"] else None,
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@app.get("/api/v1/schedules/{schedule_id}")
async def get_schedule(schedule_id: str, token: str):
    user_data = get_current_user(token)
    row = await db_pool.fetchrow(
        """SELECT s.id, s.workflow_id, s.cron_expression, s.timezone, s.enabled,
                  s.input_payload, s.next_run_at, s.last_run_at, s.created_at,
                  w.workspace_id
           FROM workflow_schedules s
           JOIN workflows w ON w.id = s.workflow_id
           WHERE s.id = $1""",
        schedule_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await require_workspace_access(str(row["workspace_id"]), user_data["sub"])
    return {
        "id": str(row["id"]),
        "workflow_id": str(row["workflow_id"]),
        "cron_expression": row["cron_expression"],
        "timezone": row["timezone"],
        "enabled": row["enabled"],
        "input_payload": row["input_payload"],
        "next_run_at": row["next_run_at"].isoformat() if row["next_run_at"] else None,
        "last_run_at": row["last_run_at"].isoformat() if row["last_run_at"] else None,
        "created_at": row["created_at"].isoformat(),
    }


@app.put("/api/v1/schedules/{schedule_id}")
async def update_schedule(schedule_id: str, data: WorkflowScheduleCreate, token: str):
    user_data = get_current_user(token)
    row = await db_pool.fetchrow(
        "SELECT s.id, w.workspace_id FROM workflow_schedules s JOIN workflows w ON w.id = s.workflow_id WHERE s.id = $1",
        schedule_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await require_workspace_access(str(row["workspace_id"]), user_data["sub"], {"admin", "editor"})
    if not re.fullmatch(r"[0-9*/?,\-\sA-Z]+", data.cron_expression, re.IGNORECASE):
        raise HTTPException(status_code=422, detail="Invalid cron expression")
    import croniter
    now = datetime.now(timezone.utc)
    cron = croniter.croniter(data.cron_expression, now)
    next_run = cron.get_next(datetime)
    await db_pool.execute(
        """UPDATE workflow_schedules
           SET cron_expression = $1, timezone = $2, input_payload = $3::jsonb, next_run_at = $4
           WHERE id = $5""",
        data.cron_expression, data.timezone, data.input_payload, next_run, schedule_id,
    )
    return {"id": schedule_id, "updated": True}


@app.delete("/api/v1/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, token: str):
    user_data = get_current_user(token)
    row = await db_pool.fetchrow(
        "SELECT s.id, w.workspace_id FROM workflow_schedules s JOIN workflows w ON w.id = s.workflow_id WHERE s.id = $1",
        schedule_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await require_workspace_access(str(row["workspace_id"]), user_data["sub"], {"admin", "editor"})
    await db_pool.execute("DELETE FROM workflow_schedules WHERE id = $1", schedule_id)
    return {"message": "Schedule deleted"}


@app.post("/api/v1/schedules/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: str, token: str):
    user_data = get_current_user(token)
    row = await db_pool.fetchrow(
        "SELECT s.id, s.enabled, w.workspace_id FROM workflow_schedules s JOIN workflows w ON w.id = s.workflow_id WHERE s.id = $1",
        schedule_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await require_workspace_access(str(row["workspace_id"]), user_data["sub"], {"admin", "editor"})
    new_enabled = not row["enabled"]
    await db_pool.execute(
        "UPDATE workflow_schedules SET enabled = $1 WHERE id = $2",
        new_enabled, schedule_id,
    )
    return {"id": schedule_id, "enabled": new_enabled}


# ============ CONNECTOR CREDENTIALS (Secrets Vault) ============

class ConnectorCredentialCreate(BaseModel):
    provider: str
    name: str
    secret: str
    metadata: Dict[str, Any] = {}


class ConnectorCredentialResponse(BaseModel):
    id: str
    provider: str
    name: str
    metadata: Dict[str, Any]
    created_at: str
    rotated_at: Optional[str] = None


@app.get("/api/v1/workspaces/{workspace_id}/connectors")
async def list_connector_credentials(workspace_id: str, token: str):
    user_data = get_current_user(token)
    await require_workspace_access(workspace_id, user_data["sub"])
    rows = await db_pool.fetch(
        """SELECT id, provider, name, metadata, created_at, rotated_at
           FROM connector_credentials
           WHERE workspace_id = $1
           ORDER BY created_at DESC""",
        workspace_id,
    )
    return [
        {
            "id": str(r["id"]),
            "provider": r["provider"],
            "name": r["name"],
            "metadata": r["metadata"],
            "created_at": r["created_at"].isoformat(),
            "rotated_at": r["rotated_at"].isoformat() if r["rotated_at"] else None,
        }
        for r in rows
    ]


@app.post("/api/v1/workspaces/{workspace_id}/connectors")
async def create_connector_credential(workspace_id: str, data: ConnectorCredentialCreate, token: str):
    user_data = get_current_user(token)
    await require_workspace_access(workspace_id, user_data["sub"], {"admin"})
    from app.crypto import encrypt_secret
    encrypted = encrypt_secret(data.secret)
    cred_id = await db_pool.fetchval(
        """INSERT INTO connector_credentials (workspace_id, provider, name, encrypted_secret, metadata, created_by)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id""",
        workspace_id, data.provider, data.name, encrypted, data.metadata, user_data["sub"],
    )
    return {
        "id": str(cred_id),
        "provider": data.provider,
        "name": data.name,
        "metadata": data.metadata,
        "created_at": datetime.utcnow().isoformat(),
    }


@app.get("/api/v1/workspaces/{workspace_id}/connectors/{credential_id}")
async def get_connector_credential(workspace_id: str, credential_id: str, token: str):
    user_data = get_current_user(token)
    await require_workspace_access(workspace_id, user_data["sub"], {"admin"})
    row = await db_pool.fetchrow(
        "SELECT id, provider, name, metadata, created_at, rotated_at FROM connector_credentials WHERE id = $1 AND workspace_id = $2",
        credential_id, workspace_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Connector credential not found")
    return {
        "id": str(row["id"]),
        "provider": row["provider"],
        "name": row["name"],
        "metadata": row["metadata"],
        "created_at": row["created_at"].isoformat(),
        "rotated_at": row["rotated_at"].isoformat() if row["rotated_at"] else None,
    }


@app.delete("/api/v1/workspaces/{workspace_id}/connectors/{credential_id}")
async def delete_connector_credential(workspace_id: str, credential_id: str, token: str):
    user_data = get_current_user(token)
    await require_workspace_access(workspace_id, user_data["sub"], {"admin"})
    await db_pool.execute(
        "DELETE FROM connector_credentials WHERE id = $1 AND workspace_id = $2",
        credential_id, workspace_id,
    )
    return {"message": "Credential deleted"}


@app.post("/api/v1/workspaces/{workspace_id}/connectors/{credential_id}/rotate")
async def rotate_connector_credential(workspace_id: str, credential_id: str, data: ConnectorCredentialCreate, token: str):
    user_data = get_current_user(token)
    await require_workspace_access(workspace_id, user_data["sub"], {"admin"})
    from app.crypto import encrypt_secret
    encrypted = encrypt_secret(data.secret)
    await db_pool.execute(
        """UPDATE connector_credentials
           SET encrypted_secret = $1, metadata = $2::jsonb, rotated_at = NOW()
           WHERE id = $3 AND workspace_id = $4""",
        encrypted, data.metadata, credential_id, workspace_id,
    )
    return {"id": credential_id, "rotated": True}


# ============ EXECUTION POLICIES ============

@app.get("/api/v1/workspaces/{workspace_id}/policies")
async def list_execution_policies(workspace_id: str, token: str):
    user_data = get_current_user(token)
    await require_workspace_access(workspace_id, user_data["sub"])
    rows = await db_pool.fetch("SELECT id, name, enabled, allowed_domains, denied_commands, approval_threshold, monthly_budget_cents FROM execution_policies WHERE workspace_id = $1 ORDER BY created_at DESC", workspace_id)
    return [dict(row) | {"id": str(row["id"])} for row in rows]


@app.post("/api/v1/workspaces/{workspace_id}/policies")
async def create_execution_policy(workspace_id: str, data: ExecutionPolicyCreate, token: str):
    user_data = get_current_user(token)
    await require_workspace_access(workspace_id, user_data["sub"], {"admin"})
    if not 0 <= data.approval_threshold <= 1:
        raise HTTPException(status_code=422, detail="approval_threshold must be between 0 and 1")
    policy_id = await db_pool.fetchval("INSERT INTO execution_policies (workspace_id, name, allowed_domains, denied_commands, approval_threshold, monthly_budget_cents) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", workspace_id, data.name, data.allowed_domains, data.denied_commands, data.approval_threshold, data.monthly_budget_cents)
    return {"id": str(policy_id), "name": data.name}


@app.post("/api/v1/workflows/{workflow_id}/execute")
async def execute_workflow(workflow_id: str, execution: WorkflowExecute, token: str):
    """Start workflow execution"""
    user_data = get_current_user(token)

    # Get workflow
    wf = await db_pool.fetchrow(
        "SELECT id, workspace_id FROM workflows WHERE id = $1 AND status = 'active'",
        workflow_id,
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found or not active")
    await require_workspace_access(str(wf["workspace_id"]), user_data["sub"], {"admin", "editor"})

    # Create run
    run_id = await db_pool.fetchval(
        """
        INSERT INTO workflow_runs (workflow_id, workspace_id, status, trigger_type, input_payload, started_at)
        VALUES ($1, $2, 'pending', $3, $4::jsonb, NOW())
        RETURNING id
        """,
        workflow_id,
        wf["workspace_id"],
        execution.trigger_type,
        execution.input_payload,
    )

    # Publish to workflow engine (via Redis)
    await redis_client.publish(
        "workflow.start",
        json.dumps({
            "run_id": str(run_id),
            "workflow_id": str(workflow_id),
            "workspace_id": str(wf["workspace_id"]),
            "input_payload": execution.input_payload,
            "approval_mode": execution.approval_mode,
        }),
    )

    return {
        "run_id": str(run_id),
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
    }


# Run endpoints
@app.get("/api/v1/runs")
async def list_runs(workspace_id: str, token: str, status: str = None, limit: int = 50):
    user_data = get_current_user(token)
    await require_workspace_access(workspace_id, user_data["sub"])
    """List workflow runs"""
    query = """
        SELECT r.id, r.workflow_id, r.status, r.trigger_type, r.started_at, r.completed_at,
               w.name as workflow_name
        FROM workflow_runs r
        JOIN workflows w ON r.workflow_id = w.id
        WHERE r.workspace_id = $1
    """
    params = [workspace_id]

    if status:
        query += " AND r.status = $2 ORDER BY r.created_at DESC LIMIT $3"
        params.extend([status, limit])
    else:
        query += " ORDER BY r.created_at DESC LIMIT $2"
        params.append(limit)

    rows = await db_pool.fetch(query, *params)
    return [
        {
            "id": str(r["id"]),
            "workflow_id": str(r["workflow_id"]),
            "workflow_name": r["workflow_name"],
            "status": r["status"],
            "trigger_type": r["trigger_type"],
            "started_at": r["started_at"].isoformat() if r["started_at"] else None,
            "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
        }
        for r in rows
    ]


@app.get("/api/v1/runs/{run_id}")
async def get_run(run_id: str, token: str):
    """Get run state"""
    user_data = get_current_user(token)
    row = await db_pool.fetchrow(
        """
        SELECT r.id, r.workflow_id, r.status, r.trigger_type, r.input_payload, r.output_payload,
               r.started_at, r.completed_at, w.name as workflow_name
        FROM workflow_runs r
        JOIN workflows w ON r.workflow_id = w.id
        WHERE r.id = $1
        """,
        run_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")
    workspace_id = await db_pool.fetchval("SELECT workspace_id FROM workflow_runs WHERE id = $1", run_id)
    await require_workspace_access(str(workspace_id), user_data["sub"])

    return {
        "id": str(row["id"]),
        "workflow_id": str(row["workflow_id"]),
        "workflow_name": row["workflow_name"],
        "status": row["status"],
        "trigger_type": row["trigger_type"],
        "input_payload": row["input_payload"],
        "output_payload": row["output_payload"],
        "started_at": row["started_at"].isoformat() if row["started_at"] else None,
        "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
    }


@app.post("/api/v1/runs/{run_id}/cancel")
async def cancel_run(run_id: str, token: str):
    """Cancel a queued or active run and notify workers to stop safely."""
    user_data = get_current_user(token)
    row = await db_pool.fetchrow(
        "SELECT workspace_id, status FROM workflow_runs WHERE id = $1",
        run_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")
    await require_workspace_access(str(row["workspace_id"]), user_data["sub"], {"admin", "editor"})
    if row["status"] not in {"pending", "running"}:
        raise HTTPException(status_code=409, detail="Only pending or running runs can be cancelled")
    await db_pool.execute(
        "UPDATE workflow_runs SET status = 'cancelled', completed_at = NOW() WHERE id = $1",
        run_id,
    )
    await redis_client.setex(f"run:cancel:{run_id}", 3600, "1")
    await redis_client.publish("workflow.cancel", json.dumps({"run_id": run_id}))
    return {"id": run_id, "status": "cancelled"}


@app.get("/api/v1/runs/{run_id}/steps")
async def get_run_steps(run_id: str, token: str):
    """Get all steps for a run"""
    user_data = get_current_user(token)
    workspace_id = await db_pool.fetchval("SELECT workspace_id FROM workflow_runs WHERE id = $1", run_id)
    if not workspace_id:
        raise HTTPException(status_code=404, detail="Run not found")
    await require_workspace_access(str(workspace_id), user_data["sub"])
    rows = await db_pool.fetch(
        """
        SELECT id, step_name, agent_type, status, input_payload, output_payload,
               error_message, risk_score, started_at, completed_at
        FROM run_steps
        WHERE run_id = $1
        ORDER BY started_at
        """,
        run_id,
    )
    return [
        {
            "id": str(r["id"]),
            "step_name": r["step_name"],
            "agent_type": r["agent_type"],
            "status": r["status"],
            "input_payload": r["input_payload"],
            "output_payload": r["output_payload"],
            "error_message": r["error_message"],
            "risk_score": r["risk_score"],
            "started_at": r["started_at"].isoformat() if r["started_at"] else None,
            "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
        }
        for r in rows
    ]


@app.get("/api/v1/runs/{run_id}/artifacts")
async def list_run_artifacts(run_id: str, token: str):
    """List immutable output artifacts produced by an authorized workflow run."""
    user_data = get_current_user(token)
    workspace_id = await db_pool.fetchval("SELECT workspace_id FROM workflow_runs WHERE id = $1", run_id)
    if not workspace_id:
        raise HTTPException(status_code=404, detail="Run not found")
    await require_workspace_access(str(workspace_id), user_data["sub"])
    rows = await db_pool.fetch(
        "SELECT id, step_id, name, content_type, storage_url, checksum_sha256, size_bytes, created_at FROM run_artifacts WHERE run_id = $1 ORDER BY created_at DESC",
        run_id,
    )
    return [{
        "id": str(row["id"]), "step_id": str(row["step_id"]) if row["step_id"] else None,
        "name": row["name"], "content_type": row["content_type"], "storage_url": row["storage_url"],
        "checksum_sha256": row["checksum_sha256"], "size_bytes": row["size_bytes"],
        "created_at": row["created_at"].isoformat(),
    } for row in rows]


@app.post("/api/v1/runs/{run_id}/artifacts", status_code=201)
async def upload_run_artifact(run_id: str, request: Request, token: str, name: str = None, step_id: str = None):
    """Upload an artifact for a run. Send file as binary body, set name via query param."""
    user_data = get_current_user(token)
    workspace_id = await db_pool.fetchval("SELECT workspace_id FROM workflow_runs WHERE id = $1", run_id)
    if not workspace_id:
        raise HTTPException(status_code=404, detail="Run not found")
    await require_workspace_access(str(workspace_id), user_data["sub"], {"admin", "editor"})

    filename = name or f"artifact-{uuid.uuid4().hex}"
    content_type = request.headers.get("content-type", "application/octet-stream")
    body = await request.body()

    from app.storage import get_storage
    storage = get_storage()
    meta = await storage.store(run_id, step_id, filename, content_type, body)

    artifact_id = await db_pool.fetchval(
        """INSERT INTO run_artifacts (run_id, step_id, name, content_type, storage_url, checksum_sha256, size_bytes)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id""",
        run_id, step_id, filename, content_type, meta["storage_url"], meta["checksum_sha256"], meta["size_bytes"],
    )
    await redis_client.incrby(f"usage:storage:{workspace_id}", meta["size_bytes"])

    return {
        "id": str(artifact_id),
        "name": filename,
        "content_type": content_type,
        "size_bytes": meta["size_bytes"],
        "checksum_sha256": meta["checksum_sha256"],
    }


@app.get("/api/v1/artifacts/{artifact_id}/download")
async def download_run_artifact(artifact_id: str, token: str):
    """Download an artifact by its database id."""
    from fastapi.responses import Response
    user_data = get_current_user(token)
    row = await db_pool.fetchrow(
        """SELECT a.storage_url, a.name, a.content_type, r.workspace_id
           FROM run_artifacts a
           JOIN workflow_runs r ON r.id = a.run_id
           WHERE a.id = $1""",
        artifact_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Artifact not found")
    await require_workspace_access(str(row["workspace_id"]), user_data["sub"])

    from app.storage import get_storage
    storage = get_storage()
    try:
        data, content_type = await storage.retrieve(row["storage_url"])
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Artifact data not found on storage backend")

    return Response(
        content=data,
        media_type=content_type or row["content_type"],
        headers={"Content-Disposition": f'attachment; filename="{row["name"]}"'},
    )


# Approval endpoints
@app.get("/api/v1/approvals")
async def list_approvals(workspace_id: str, token: str):
    """List pending approvals for workspace"""
    user_data = get_current_user(token)
    await require_workspace_access(workspace_id, user_data["sub"])
    rows = await db_pool.fetch(
        """
        SELECT a.id, a.run_id, a.step_id, a.status, a.risk_score, a.risk_summary,
               a.action_preview, a.created_at
        FROM approvals a
        JOIN workflow_runs r ON a.run_id = r.id
        WHERE r.workspace_id = $1 AND a.status = 'pending'
        ORDER BY a.created_at DESC
        """,
        workspace_id,
    )
    return [
        {
            "id": str(r["id"]),
            "run_id": str(r["run_id"]),
            "step_id": str(r["step_id"]),
            "status": r["status"],
            "risk_score": r["risk_score"],
            "risk_summary": r["risk_summary"],
            "action_preview": r["action_preview"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@app.post("/api/v1/approvals/{approval_id}/approve")
async def approve_action(approval_id: str, action: ApprovalAction, token: str):
    """Approve a pending action"""
    user_data = get_current_user(token)
    approval = await db_pool.fetchrow(
        "SELECT a.status, r.workspace_id FROM approvals a JOIN workflow_runs r ON r.id = a.run_id WHERE a.id = $1",
        approval_id,
    )
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    await require_workspace_access(str(approval["workspace_id"]), user_data["sub"], {"admin", "editor"})
    if approval["status"] != "pending":
        raise HTTPException(status_code=409, detail="Approval has already been resolved")

    await db_pool.execute(
        """
        UPDATE approvals
        SET status = 'approved', reviewed_by = $1, review_notes = $2, updated_at = NOW()
        WHERE id = $3
        """,
        user_data.get("sub"),
        action.reviewer_notes,
        approval_id,
    )

    return {"status": "approved", "workflow_resumed": True}


@app.post("/api/v1/approvals/{approval_id}/reject")
async def reject_action(approval_id: str, action: ApprovalAction, token: str):
    """Reject a pending action"""
    user_data = get_current_user(token)
    approval = await db_pool.fetchrow(
        "SELECT a.status, r.workspace_id FROM approvals a JOIN workflow_runs r ON r.id = a.run_id WHERE a.id = $1",
        approval_id,
    )
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    await require_workspace_access(str(approval["workspace_id"]), user_data["sub"], {"admin", "editor"})
    if approval["status"] != "pending":
        raise HTTPException(status_code=409, detail="Approval has already been resolved")

    await db_pool.execute(
        """
        UPDATE approvals
        SET status = 'rejected', reviewed_by = $1, review_notes = $2, updated_at = NOW()
        WHERE id = $3
        """,
        user_data.get("sub"),
        action.reviewer_notes,
        approval_id,
    )

    return {"status": "rejected", "rollback_triggered": True}


# Agent endpoints
@app.get("/api/v1/agents")
async def list_agents(token: str):
    """List all agents with stats from Redis"""
    agents = []
    agent_types = ["orchestrator", "execution", "security", "vision", "planner", "validation"]

    for agent_type in agent_types:
        # Get stats from Redis hash
        stats = await redis_client.hgetall(f"agent:stats:{agent_type}")
        agents.append({
            "id": agent_type,
            "name": agent_type.capitalize(),
            "status": stats.get("status", "idle"),
            "tasks_total": int(stats.get("tasks_total", 0)),
            "tasks_success": int(stats.get("tasks_success", 0)),
            "tasks_failed": int(stats.get("tasks_failed", 0)),
            "avg_latency": stats.get("avg_latency", "0s"),
            "current_task": stats.get("current_task", "Idle"),
            "memory_usage": stats.get("memory_usage", "0MB"),
            "uptime": stats.get("uptime", "0m"),
        })

    return agents


@app.get("/api/v1/agents/{agent_id}")
async def get_agent(agent_id: str, token: str):
    """Get single agent details"""
    stats = await redis_client.hgetall(f"agent:stats:{agent_id}")
    if not stats:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {
        "id": agent_id,
        "name": agent_id.capitalize(),
        "status": stats.get("status", "idle"),
        "tasks_total": int(stats.get("tasks_total", 0)),
        "tasks_success": int(stats.get("tasks_success", 0)),
        "tasks_failed": int(stats.get("tasks_failed", 0)),
        "avg_latency": stats.get("avg_latency", "0s"),
        "current_task": stats.get("current_task", "Idle"),
        "memory_usage": stats.get("memory_usage", "0MB"),
        "uptime": stats.get("uptime", "0m"),
    }


@app.get("/api/v1/agents/{agent_id}/events")
async def get_agent_events(agent_id: str, token: str, limit: int = 20):
    """Get recent agent events from Redis stream"""
    try:
        events = await redis_client.xrevrange(
            f"agent:{agent_id}:events", count=limit
        )
        return [
            {"id": event_id, "data": data}
            for event_id, data in (events or [])
        ]
    except Exception:
        return []


# Logs endpoint
@app.get("/api/v1/logs")
async def list_logs(
    token: str,
    service: str = None,
    level: str = None,
    limit: int = 100,
    offset: int = 0,
):
    """List audit logs"""
    query = "SELECT id, action, resource_type, resource_id, payload, created_at FROM audit_logs"
    conditions = []
    params = []

    if service:
        conditions.append(f"payload->>'service' = ${len(params) + 1}")
        params.append(service)
    if level:
        conditions.append(f"payload->>'level' = ${len(params) + 1}")
        params.append(level)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += f" ORDER BY created_at DESC LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}"
    params.extend([limit, offset])

    try:
        rows = await db_pool.fetch(query, *params)
        total = await db_pool.fetchval("SELECT COUNT(*) FROM audit_logs")
        return {
            "logs": [
                {
                    "id": str(r["id"]),
                    "action": r["action"],
                    "resource_type": r["resource_type"],
                    "resource_id": r["resource_id"],
                    "payload": dict(r["payload"]) if r["payload"] else {},
                    "created_at": r["created_at"].isoformat(),
                }
                for r in rows
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    except Exception:
        return {"logs": [], "total": 0, "limit": limit, "offset": offset}


# Plugin endpoints
@app.get("/api/v1/plugins")
async def list_plugins(token: str, workspace_id: str = None):
    """List installed plugins"""
    try:
        if workspace_id:
            rows = await db_pool.fetch(
                "SELECT id, name, version, status, installed_at FROM plugins WHERE workspace_id = $1",
                workspace_id,
            )
        else:
            rows = await db_pool.fetch(
                "SELECT id, name, version, status, installed_at FROM plugins"
            )
        return [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "version": r["version"],
                "status": r["status"],
                "installed_at": r["installed_at"].isoformat(),
            }
            for r in rows
        ]
    except Exception:
        return []


# Settings endpoints
@app.get("/api/v1/settings")
async def get_settings(token: str):
    """Get user settings from database"""
    user_data = get_current_user(token)
    user_id = user_data.get("sub")

    row = await db_pool.fetchrow(
        "SELECT settings FROM users WHERE id = $1", user_id
    )

    if row and row["settings"]:
        return dict(row["settings"])

    # Default settings
    return {
        "theme": "dark",
        "language": "en",
        "notifications_enabled": True,
        "auto_approve_low_risk": False,
        "session_timeout_minutes": 60,
        "max_concurrent_workflows": 10,
    }


@app.put("/api/v1/settings")
async def update_settings(token: str, settings_update: dict = {}):
    """Update user settings in database"""
    user_data = get_current_user(token)
    user_id = user_data.get("sub")

    await db_pool.execute(
        "UPDATE users SET settings = $1::jsonb WHERE id = $2",
        settings_update,
        user_id,
    )

    return {"updated": True, "settings": settings_update}


# Memory endpoints
@app.get("/api/v1/memory/search")
async def search_memory(q: str, workspace_id: str, token: str, k: int = 5):
    """Semantic memory search - calls Memory Service"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.MEMORY_SERVICE_URL}/api/v1/memory/search",
                json={"query": q, "workspace_id": workspace_id, "k": k},
            )
            if resp.status_code == 200:
                return resp.json()
            return {"items": [], "query": q, "count": 0}
    except Exception as e:
        logger.warning("memory.search_failed", error=str(e))
        return {"items": [], "query": q, "count": 0}


@app.get("/api/v1/memory/timeline")
async def get_memory_timeline(run_id: str, token: str, limit: int = 50):
    """Get chronological memory for a run"""
    rows = await db_pool.fetch(
        """
        SELECT id, content, content_type, metadata, created_at
        FROM memory_items
        WHERE run_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        run_id,
        limit,
    )
    return [
        {
            "id": str(r["id"]),
            "content": r["content"],
            "content_type": r["content_type"],
            "metadata": r["metadata"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


# WebSocket endpoint with auth
@app.websocket("/ws/runs/{run_id}")
async def websocket_run(websocket: WebSocket, run_id: str):
    """Real-time run events WebSocket - requires token query param"""
    # Authenticate via query param
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    try:
        get_current_user(token)
    except HTTPException:
        await websocket.close(code=4001, reason="Invalid authentication token")
        return

    await websocket.accept()

    try:
        # Subscribe to Redis channel for this run
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"run:{run_id}:events")

        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message["type"] == "message":
                await websocket.send_text(message["data"])
    except WebSocketDisconnect:
        logger.info("ws.disconnected", run_id=run_id)
    finally:
        try:
            await pubsub.unsubscribe(f"run:{run_id}:events")
            await pubsub.close()
        except Exception:
            pass


# Module-level Prometheus counters (singletons)
_requests_total = prometheus_client.Counter("cloudlabos_http_requests_total", "Total HTTP requests", ["method", "endpoint"])
_login_attempts = prometheus_client.Counter("cloudlabos_login_attempts_total", "Total login attempts", ["status"])


# Metrics endpoint
@app.get("/metrics")
async def metrics():
    """Prometheus metrics"""
    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

    return JSONResponse(
        content=generate_latest().decode("utf-8"),
        media_type=CONTENT_TYPE_LATEST,
    )


# ============ 1. EMAIL VERIFICATION ============

@app.post("/api/v1/auth/verify-email/send")
async def send_verification_email(data: EmailVerifySend):
    code = "".join(secrets.choice(string.digits) for _ in range(6))
    await redis_client.setex(f"verify_email:{data.email}", 600, code)
    # A production mail provider must deliver this code; never emit it to logs.
    logger.info("email_verification.requested", email=data.email)
    return {"message": "Verification code sent", "expires_in": 600}


@app.post("/api/v1/auth/verify-email/confirm")
async def confirm_verification_email(data: EmailVerifyConfirm):
    stored = await redis_client.get(f"verify_email:{data.email}")
    if not stored or stored != data.code:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    await redis_client.delete(f"verify_email:{data.email}")
    await db_pool.execute("UPDATE users SET email_verified_at = NOW() WHERE email = $1", data.email)
    return {"message": "Email verified successfully"}


# ============ 2. PASSWORD RESET ============

@app.post("/api/v1/auth/password-reset/request")
async def password_reset_request(data: PasswordResetRequest):
    user = await db_pool.fetchrow("SELECT id, email FROM users WHERE email = $1", data.email)
    if not user:
        return {"message": "If the email exists, a reset link has been sent"}
    token = secrets.token_urlsafe(32)
    await redis_client.setex(f"password_reset:{token}", 900, str(user["id"]))
    # A production mail provider must deliver this token; never return it in the API response.
    logger.info("password_reset.requested", email=data.email)
    return {"message": "If the email exists, a reset link has been sent"}


@app.post("/api/v1/auth/password-reset/confirm")
async def password_reset_confirm(data: PasswordResetConfirm):
    user_id = await redis_client.get(f"password_reset:{data.token}")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    validate_password(data.new_password)
    password_hash = bcrypt.hashpw(data.new_password.encode("utf-8"), bcrypt.gensalt())
    await db_pool.execute(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        password_hash.decode("utf-8"), user_id,
    )
    await redis_client.delete(f"password_reset:{data.token}")
    return {"message": "Password reset successfully"}


# ============ 3. OAUTH ============

@app.get("/api/v1/auth/oauth/{provider}")
async def oauth_authorize(provider: str):
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="OAuth is disabled until a verified provider adapter is configured")


@app.post("/api/v1/auth/oauth/{provider}/callback")
async def oauth_callback(provider: str, data: OAuthCallback):
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="OAuth callback validation is not configured")


# ============ 4. MFA/2FA ============

@app.post("/api/v1/auth/mfa/setup")
async def mfa_setup(token: str):
    user_data = get_current_user(token)
    user_id = user_data.get("sub")
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    qr_uri = totp.provisioning_uri(name=user_data.get("email", ""), issuer_name="CloudLabOS")
    await db_pool.execute(
        "UPDATE users SET mfa_secret = $1 WHERE id = $2", secret, user_id,
    )
    return {"secret": secret, "qr_uri": qr_uri}


@app.post("/api/v1/auth/mfa/verify")
async def mfa_verify(data: MFAVerify, token: str):
    user_data = get_current_user(token)
    user_id = user_data.get("sub")
    row = await db_pool.fetchrow("SELECT mfa_secret FROM users WHERE id = $1", user_id)
    if not row or not row["mfa_secret"]:
        raise HTTPException(status_code=400, detail="MFA not set up")
    totp = pyotp.TOTP(row["mfa_secret"])
    if not totp.verify(data.code):
        raise HTTPException(status_code=400, detail="Invalid MFA code")
    await db_pool.execute("UPDATE users SET mfa_enabled = TRUE WHERE id = $1", user_id)
    return {"message": "MFA enabled successfully"}


@app.post("/api/v1/auth/mfa/disable")
async def mfa_disable(data: MFADisable, token: str):
    user_data = get_current_user(token)
    user_id = user_data.get("sub")
    row = await db_pool.fetchrow("SELECT mfa_secret FROM users WHERE id = $1", user_id)
    if not row or not row["mfa_secret"]:
        raise HTTPException(status_code=400, detail="MFA not set up")
    totp = pyotp.TOTP(row["mfa_secret"])
    if not totp.verify(data.code):
        raise HTTPException(status_code=400, detail="Invalid MFA code")
    await db_pool.execute(
        "UPDATE users SET mfa_secret = NULL, mfa_enabled = FALSE WHERE id = $1", user_id,
    )
    return {"message": "MFA disabled successfully"}


# ============ 5. API KEY MANAGEMENT ============

@app.get("/api/v1/auth/api-keys")
async def list_api_keys(token: str):
    user_data = get_current_user(token)
    rows = await db_pool.fetch(
        "SELECT id, name, key_prefix, created_at, last_used_at FROM api_keys WHERE user_id = $1 AND revoked = FALSE ORDER BY created_at DESC",
        user_data.get("sub"),
    )
    return [
        {
            "id": str(r["id"]),
            "name": r["name"],
            "key_prefix": r["key_prefix"],
            "created_at": r["created_at"].isoformat(),
            "last_used_at": r["last_used_at"].isoformat() if r["last_used_at"] else None,
        }
        for r in rows
    ]


@app.post("/api/v1/auth/api-keys")
async def create_api_key(data: ApiKeyCreate, token: str):
    user_data = get_current_user(token)
    raw_key = f"clk_{secrets.token_hex(24)}"
    key_hash = bcrypt.hashpw(raw_key.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    key_prefix = raw_key[:10]
    await db_pool.execute(
        """INSERT INTO api_keys (user_id, name, key_hash, key_prefix, workspace_id)
           VALUES ($1, $2, $3, $4, $5)""",
        user_data.get("sub"), data.name, key_hash, key_prefix, data.workspace_id,
    )
    return {"id": "", "name": data.name, "key_prefix": key_prefix, "raw_key": raw_key, "created_at": datetime.utcnow().isoformat()}


@app.delete("/api/v1/auth/api-keys/{key_id}")
async def revoke_api_key(key_id: str, token: str):
    user_data = get_current_user(token)
    await db_pool.execute(
        "UPDATE api_keys SET revoked = TRUE WHERE id = $1 AND user_id = $2",
        key_id, user_data.get("sub"),
    )
    return {"message": "API key revoked"}


# ============ 6. SESSION MANAGEMENT ============

@app.get("/api/v1/auth/sessions")
async def list_sessions(token: str):
    user_data = get_current_user(token)
    rows = await db_pool.fetch(
        "SELECT id, ip_address, user_agent, created_at, last_activity_at FROM sessions WHERE user_id = $1 AND revoked = FALSE ORDER BY last_activity_at DESC",
        user_data.get("sub"),
    )
    return [
        {
            "id": str(r["id"]),
            "ip_address": r["ip_address"],
            "user_agent": r["user_agent"],
            "created_at": r["created_at"].isoformat(),
            "last_activity_at": r["last_activity_at"].isoformat() if r["last_activity_at"] else None,
        }
        for r in rows
    ]


@app.delete("/api/v1/auth/sessions/{session_id}")
async def revoke_session(session_id: str, token: str):
    user_data = get_current_user(token)
    await db_pool.execute(
        "UPDATE sessions SET revoked = TRUE WHERE id = $1 AND user_id = $2",
        session_id, user_data.get("sub"),
    )
    return {"message": "Session revoked"}


# ============ 7. WORKSPACE INVITATIONS ============

@app.post("/api/v1/workspaces/{workspace_id}/invite")
async def invite_to_workspace(workspace_id: str, data: WorkspaceInvite, token: str):
    user_data = get_current_user(token)
    member = await db_pool.fetchrow(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        workspace_id, user_data.get("sub"),
    )
    if not member or member["role"] not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="Only admins can invite members")
    invite_token = secrets.token_urlsafe(32)
    invite_data = f"{workspace_id}:{data.email}:{data.role}"
    await redis_client.setex(f"workspace_invite:{invite_token}", 86400, invite_data)
    return {"invite_token": invite_token, "expires_in": 86400}


@app.post("/api/v1/workspaces/invitations/{token}/accept")
async def accept_invitation(token: str, auth_token: str):
    user_data = get_current_user(auth_token)
    raw = await redis_client.get(f"workspace_invite:{token}")
    if not raw:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")
    parts = raw.split(":")
    workspace_id, email, role = parts[0], parts[1], parts[2]
    if user_data.get("email") != email:
        raise HTTPException(status_code=403, detail="This invitation is for a different email")
    existing = await db_pool.fetchrow(
        "SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        workspace_id, user_data.get("sub"),
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already a member of this workspace")
    await db_pool.execute(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)",
        workspace_id, user_data.get("sub"), role,
    )
    await redis_client.delete(f"workspace_invite:{token}")
    return {"message": "Invitation accepted", "workspace_id": workspace_id}


@app.get("/api/v1/workspaces/{workspace_id}/members")
async def list_workspace_members(workspace_id: str, token: str):
    rows = await db_pool.fetch(
        """SELECT u.id, u.email, u.name, wm.role, wm.joined_at
           FROM workspace_members wm
           JOIN users u ON wm.user_id = u.id
           WHERE wm.workspace_id = $1
           ORDER BY wm.joined_at""",
        workspace_id,
    )
    return [
        {
            "id": str(r["id"]),
            "email": r["email"],
            "name": r["name"],
            "role": r["role"],
            "joined_at": r["joined_at"].isoformat(),
        }
        for r in rows
    ]


@app.delete("/api/v1/workspaces/{workspace_id}/members/{user_id}")
async def remove_workspace_member(workspace_id: str, user_id: str, token: str):
    user_data = get_current_user(token)
    member = await db_pool.fetchrow(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        workspace_id, user_data.get("sub"),
    )
    if not member or member["role"] not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="Only admins can remove members")
    await db_pool.execute(
        "DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        workspace_id, user_id,
    )
    return {"message": "Member removed"}


# ============ 8. RBAC ENFORCEMENT ============

async def require_role(required_roles: List[str], workspace_id: str, token: str):
    user_data = get_current_user(token)
    member = await db_pool.fetchrow(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        workspace_id, user_data.get("sub"),
    )
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
    if member["role"] not in required_roles:
        raise HTTPException(status_code=403, detail=f"Requires one of these roles: {required_roles}")
    return member["role"]


async def check_workspace_access(workspace_id: str, token: str):
    user_data = get_current_user(token)
    member = await db_pool.fetchrow(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        workspace_id, user_data.get("sub"),
    )
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
    return member["role"]


# ============ 9. RATE LIMITING MIDDLEWARE ============

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = None
    if token:
        try:
            payload = get_current_user(token)
            user_id = payload.get("sub")
        except HTTPException:
            pass
    if user_id:
        key = f"rate_limit:{user_id}"
        now = time.time()
        window = 60
        max_requests = 100
        pipe = redis_client.pipeline()
        pipe.zremrangebyscore(key, 0, now - window)
        pipe.zcard(key)
        pipe.zadd(key, {str(uuid.uuid4()): now})
        pipe.expire(key, window)
        results = await pipe.execute()
        count = results[1]
        if count > max_requests:
            retry_after = int(window - (now % window))
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded", "retry_after": retry_after},
                headers={"Retry-After": str(retry_after)},
            )
    response = await call_next(request)
    return response


# ============ 10. BILLING / SUBSCRIPTIONS ============

PLANS = [
    {"id": "free", "name": "Free", "price": 0, "features": ["5 workflows", "1 workspace", "Basic support"]},
    {"id": "pro", "name": "Pro", "price": 29, "features": ["Unlimited workflows", "10 workspaces", "Priority support", "API access"]},
    {"id": "enterprise", "name": "Enterprise", "price": 199, "features": ["Unlimited everything", "SSO", "Dedicated support", "Custom integrations", "SLA"]},
]


@app.get("/api/v1/billing/plans")
async def get_billing_plans():
    return {"plans": PLANS}


@app.get("/api/v1/billing/subscription")
async def get_subscription(token: str):
    user_data = get_current_user(token)
    row = await db_pool.fetchrow(
        "SELECT id, plan, status, current_period_start, current_period_end, stripe_subscription_id FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        user_data.get("sub"),
    )
    if not row:
        return {"subscription": None, "plan": "free"}
    return {
        "id": str(row["id"]),
        "plan": row["plan"],
        "status": row["status"],
        "current_period_start": row["current_period_start"].isoformat() if row["current_period_start"] else None,
        "current_period_end": row["current_period_end"].isoformat() if row["current_period_end"] else None,
        "stripe_subscription_id": row["stripe_subscription_id"],
    }


@app.post("/api/v1/billing/subscription")
async def create_subscription(data: SubscriptionCreate, token: str):
    get_current_user(token)
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Subscriptions require a verified payment-provider checkout")


@app.post("/api/v1/billing/checkout")
async def billing_checkout(token: str, plan: str = "pro"):
    get_current_user(token)
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Stripe Checkout is not configured")


@app.post("/api/v1/billing/webhook")
async def billing_webhook(event: StripeWebhookEvent, request: Request):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Stripe webhook signature verification is not configured",
    )


@app.get("/api/v1/billing/invoices")
async def list_invoices(token: str):
    user_data = get_current_user(token)
    rows = await db_pool.fetch(
        "SELECT id, amount, currency, status, invoice_url, created_at FROM invoices WHERE user_id = $1 ORDER BY created_at DESC",
        user_data.get("sub"),
    )
    return [
        {
            "id": str(r["id"]),
            "amount": r["amount"],
            "currency": r["currency"],
            "status": r["status"],
            "invoice_url": r["invoice_url"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


# ============ 11. WEBHOOK SYSTEM ============

@app.get("/api/v1/webhooks")
async def list_webhooks(workspace_id: str, token: str):
    await check_workspace_access(workspace_id, token)
    rows = await db_pool.fetch(
        "SELECT id, url, events, secret, created_at, updated_at FROM webhooks WHERE workspace_id = $1 ORDER BY created_at DESC",
        workspace_id,
    )
    return [
        {
            "id": str(r["id"]),
            "url": r["url"],
            "events": r["events"],
            "created_at": r["created_at"].isoformat(),
            "updated_at": r["updated_at"].isoformat(),
        }
        for r in rows
    ]


@app.post("/api/v1/webhooks")
async def create_webhook(workspace_id: str, data: WebhookCreate, token: str):
    await check_workspace_access(workspace_id, token)
    webhook_secret = data.secret or secrets.token_hex(32)
    webhook_id = await db_pool.fetchval(
        """INSERT INTO webhooks (workspace_id, url, events, secret)
           VALUES ($1, $2, $3::jsonb, $4) RETURNING id""",
        workspace_id, data.url, data.events, webhook_secret,
    )
    return {"id": str(webhook_id), "url": data.url, "events": data.events, "secret": webhook_secret}


@app.delete("/api/v1/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, token: str):
    row = await db_pool.fetchrow("SELECT workspace_id FROM webhooks WHERE id = $1", webhook_id)
    if not row:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await check_workspace_access(str(row["workspace_id"]), token)
    await db_pool.execute("DELETE FROM webhooks WHERE id = $1", webhook_id)
    return {"message": "Webhook deleted"}


@app.put("/api/v1/webhooks/{webhook_id}")
async def update_webhook(webhook_id: str, data: WebhookUpdate, token: str):
    row = await db_pool.fetchrow("SELECT workspace_id FROM webhooks WHERE id = $1", webhook_id)
    if not row:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await check_workspace_access(str(row["workspace_id"]), token)
    fields = []
    params = []
    idx = 1
    if data.url is not None:
        fields.append(f"url = ${idx}")
        params.append(data.url)
        idx += 1
    if data.events is not None:
        fields.append(f"events = ${idx}::jsonb")
        params.append(data.events)
        idx += 1
    if data.secret is not None:
        fields.append(f"secret = ${idx}")
        params.append(data.secret)
        idx += 1
    if fields:
        params.append(webhook_id)
        await db_pool.execute(
            f"UPDATE webhooks SET {', '.join(fields)}, updated_at = NOW() WHERE id = ${idx}",
            *params,
        )
    return {"message": "Webhook updated"}


@app.get("/api/v1/webhooks/{webhook_id}/logs")
async def get_webhook_logs(webhook_id: str, token: str, limit: int = 50):
    row = await db_pool.fetchrow("SELECT workspace_id FROM webhooks WHERE id = $1", webhook_id)
    if not row:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await check_workspace_access(str(row["workspace_id"]), token)
    rows = await db_pool.fetch(
        "SELECT id, event_type, status, request_body, response_body, response_status, delivered_at FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY delivered_at DESC LIMIT $2",
        webhook_id, limit,
    )
    return [
        {
            "id": str(r["id"]),
            "event_type": r["event_type"],
            "status": r["status"],
            "request_body": r["request_body"],
            "response_body": r["response_body"],
            "response_status": r["response_status"],
            "delivered_at": r["delivered_at"].isoformat(),
        }
        for r in rows
    ]


# ============ 12. NOTIFICATIONS ============

@app.get("/api/v1/notifications")
async def list_notifications(token: str, limit: int = 50, offset: int = 0):
    user_data = get_current_user(token)
    rows = await db_pool.fetch(
        "SELECT id, title, message, notification_type, is_read, workspace_id, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        user_data.get("sub"), limit, offset,
    )
    total = await db_pool.fetchval(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1", user_data.get("sub"),
    )
    return {
        "notifications": [
            {
                "id": str(r["id"]),
                "title": r["title"],
                "message": r["message"],
                "notification_type": r["notification_type"],
                "is_read": r["is_read"],
                "workspace_id": str(r["workspace_id"]) if r["workspace_id"] else None,
                "created_at": r["created_at"].isoformat(),
            }
            for r in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@app.post("/api/v1/notifications")
async def create_notification(data: NotificationCreate, token: str):
    user_data = get_current_user(token)
    await db_pool.execute(
        """INSERT INTO notifications (user_id, title, message, notification_type, workspace_id)
           VALUES ($1, $2, $3, $4, $5)""",
        data.user_id, data.title, data.message, data.notification_type, data.workspace_id,
    )
    return {"message": "Notification created"}


@app.put("/api/v1/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, token: str):
    user_data = get_current_user(token)
    await db_pool.execute(
        "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2",
        notification_id, user_data.get("sub"),
    )
    return {"message": "Notification marked as read"}


@app.put("/api/v1/notifications/read-all")
async def mark_all_notifications_read(token: str):
    user_data = get_current_user(token)
    await db_pool.execute(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
        user_data.get("sub"),
    )
    return {"message": "All notifications marked as read"}


@app.get("/api/v1/notifications/unread-count")
async def get_unread_notification_count(token: str):
    user_data = get_current_user(token)
    count = await db_pool.fetchval(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE",
        user_data.get("sub"),
    )
    return {"unread_count": count}


@app.post("/api/v1/notifications/send-email")
async def send_notification_email(token: str, notification_id: str = None):
    user_data = get_current_user(token)
    logger.info("notification.email_simulated", user_id=user_data.get("sub"), notification_id=notification_id)
    return {"message": "Email notification sent (simulated)"}


# ============ 13. USAGE METERING ============

@app.get("/api/v1/usage")
async def get_usage(workspace_id: str, token: str):
    await check_workspace_access(workspace_id, token)
    runs_count = await db_pool.fetchval(
        "SELECT COUNT(*) FROM workflow_runs WHERE workspace_id = $1", workspace_id,
    )
    storage_key = f"usage:storage:{workspace_id}"
    storage_used = await redis_client.get(storage_key) or "0"
    api_calls_key = f"usage:api_calls:{workspace_id}"
    api_calls = int(await redis_client.get(api_calls_key) or 0)
    await redis_client.incr(api_calls_key)
    return {
        "workspace_id": workspace_id,
        "runs_count": runs_count,
        "storage_used_bytes": int(storage_used),
        "api_calls": api_calls,
    }


# ============ 14. DATA EXPORT ============

@app.get("/api/v1/export/workflows")
async def export_workflows(workspace_id: str, token: str):
    await check_workspace_access(workspace_id, token)
    rows = await db_pool.fetch(
        "SELECT id, name, description, definition, status, version, created_at, updated_at FROM workflows WHERE workspace_id = $1",
        workspace_id,
    )
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "workspace_id": workspace_id,
        "workflows": [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "description": r["description"],
                "definition": r["definition"],
                "status": r["status"],
                "version": r["version"],
                "created_at": r["created_at"].isoformat(),
                "updated_at": r["updated_at"].isoformat(),
            }
            for r in rows
        ],
    }


@app.get("/api/v1/export/runs")
async def export_runs(workspace_id: str, token: str):
    await check_workspace_access(workspace_id, token)
    rows = await db_pool.fetch(
        """SELECT r.id, r.workflow_id, r.status, r.trigger_type, r.input_payload, r.output_payload,
                  r.started_at, r.completed_at, w.name as workflow_name
           FROM workflow_runs r
           JOIN workflows w ON r.workflow_id = w.id
           WHERE r.workspace_id = $1
           ORDER BY r.started_at DESC""",
        workspace_id,
    )
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "workspace_id": workspace_id,
        "runs": [
            {
                "id": str(r["id"]),
                "workflow_id": str(r["workflow_id"]),
                "workflow_name": r["workflow_name"],
                "status": r["status"],
                "trigger_type": r["trigger_type"],
                "input_payload": r["input_payload"],
                "output_payload": r["output_payload"],
                "started_at": r["started_at"].isoformat() if r["started_at"] else None,
                "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
            }
            for r in rows
        ],
    }


# ============ 15. GDPR ============

@app.get("/api/v1/gdpr/data-export")
async def gdpr_data_export(token: str):
    user_data = get_current_user(token)
    user_id = user_data.get("sub")
    user = await db_pool.fetchrow("SELECT id, email, name, role, settings, created_at FROM users WHERE id = $1", user_id)
    workspaces = await db_pool.fetch(
        "SELECT w.id, w.name, wm.role FROM workspaces w JOIN workspace_members wm ON w.id = wm.workspace_id WHERE wm.user_id = $1",
        user_id,
    )
    workflows = await db_pool.fetch(
        "SELECT id, name, description, definition, status, created_at FROM workflows WHERE created_by = $1",
        user_id,
    )
    runs = await db_pool.fetch(
        "SELECT id, workflow_id, status, trigger_type, input_payload, output_payload, started_at, completed_at FROM workflow_runs WHERE id IN (SELECT id FROM workflows WHERE created_by = $1)",
        user_id,
    )
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "user": {
            "id": str(user["id"]),
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "settings": user["settings"],
            "created_at": user["created_at"].isoformat(),
        },
        "workspaces": [
            {"id": str(w["id"]), "name": w["name"], "role": w["role"]}
            for w in workspaces
        ],
        "workflows": [
            {"id": str(w["id"]), "name": w["name"], "description": w["description"], "status": w["status"], "created_at": w["created_at"].isoformat()}
            for w in workflows
        ],
        "runs": [
            {"id": str(r["id"]), "workflow_id": str(r["workflow_id"]), "status": r["status"], "started_at": r["started_at"].isoformat() if r["started_at"] else None}
            for r in runs
        ],
    }


@app.delete("/api/v1/gdpr/data-deletion")
async def gdpr_data_deletion(token: str):
    user_data = get_current_user(token)
    user_id = user_data.get("sub")
    await db_pool.execute("DELETE FROM workflow_runs WHERE id IN (SELECT id FROM workflows WHERE created_by = $1)", user_id)
    await db_pool.execute("DELETE FROM workflows WHERE created_by = $1", user_id)
    await db_pool.execute("DELETE FROM workspace_members WHERE user_id = $1", user_id)
    await db_pool.execute("DELETE FROM sessions WHERE user_id = $1", user_id)
    await db_pool.execute("DELETE FROM api_keys WHERE user_id = $1", user_id)
    await db_pool.execute("DELETE FROM notifications WHERE user_id = $1", user_id)
    await db_pool.execute(
        "UPDATE users SET email = $1, name = 'Deleted User', password_hash = NULL, settings = '{}'::jsonb WHERE id = $2",
        f"deleted_{user_id}@cloudlabos.io", user_id,
    )
    return {"message": "All personal data deleted and account anonymized"}


# ============ 16. SSO/SAML ============

@app.get("/api/v1/auth/sso/{provider}")
async def sso_authorize(provider: str):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="SSO is disabled until a verified SAML or OIDC provider is configured",
    )


@app.post("/api/v1/auth/sso/{provider}/acs")
async def sso_acs(provider: str, assertion: Dict[str, Any] = {}):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="SSO assertion validation is not configured",
    )


# ============ 17. PUBLIC API DOCS ============

@app.get("/api/v1/openapi.json")
async def get_openapi_spec():
    return app.openapi()


@app.get("/api/v1/docs")
async def redirect_to_docs():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")


# ============ 18. STATUS PAGE ============

@app.get("/api/v1/status")
async def get_status():
    services = {
        "postgres": {"status": "unknown"},
        "redis": {"status": "unknown"},
        "agent_service": {"status": "unknown"},
        "workflow_engine": {"status": "unknown"},
        "memory_service": {"status": "unknown"},
        "browser_service": {"status": "unknown"},
        "research_service": {"status": "unknown"},
    }
    try:
        await db_pool.fetchval("SELECT 1")
        services["postgres"] = {"status": "healthy"}
    except Exception as e:
        services["postgres"] = {"status": "unhealthy", "error": str(e)}
    try:
        await redis_client.ping()
        services["redis"] = {"status": "healthy"}
    except Exception as e:
        services["redis"] = {"status": "unhealthy", "error": str(e)}
    async def check_service(name: str, url: str):
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{url}/health")
                if resp.status_code == 200:
                    services[name] = {"status": "healthy"}
                else:
                    services[name] = {"status": "degraded", "code": resp.status_code}
        except Exception as e:
            services[name] = {"status": "unhealthy", "error": str(e)}
    await check_service("agent_service", settings.AGENT_SERVICE_URL)
    await check_service("workflow_engine", settings.WORKFLOW_ENGINE_URL)
    await check_service("memory_service", settings.MEMORY_SERVICE_URL)
    await check_service("browser_service", settings.BROWSER_SERVICE_URL)
    await check_service("research_service", settings.RESEARCH_SERVICE_URL)
    overall = "healthy" if all(s["status"] == "healthy" for s in services.values()) else "degraded"
    return {"status": overall, "timestamp": datetime.utcnow().isoformat(), "services": services}


# ============ 19. PLUGIN MANAGEMENT ENHANCEMENTS ============

@app.post("/api/v1/plugins/{plugin_id}/install")
async def install_plugin(plugin_id: str, token: str, workspace_id: str = None):
    user_data = get_current_user(token)
    await db_pool.execute(
        "UPDATE plugins SET status = 'active' WHERE id = $1", plugin_id,
    )
    return {"message": "Plugin installed", "plugin_id": plugin_id}


@app.post("/api/v1/plugins/{plugin_id}/uninstall")
async def uninstall_plugin(plugin_id: str, token: str, workspace_id: str = None):
    user_data = get_current_user(token)
    await db_pool.execute(
        "UPDATE plugins SET status = 'uninstalled' WHERE id = $1", plugin_id,
    )
    return {"message": "Plugin uninstalled", "plugin_id": plugin_id}


@app.put("/api/v1/plugins/{plugin_id}")
async def update_plugin(plugin_id: str, data: PluginUpdate, token: str):
    user_data = get_current_user(token)
    fields = []
    params = []
    idx = 1
    if data.name is not None:
        fields.append(f"name = ${idx}")
        params.append(data.name)
        idx += 1
    if data.version is not None:
        fields.append(f"version = ${idx}")
        params.append(data.version)
        idx += 1
    if data.status is not None:
        fields.append(f"status = ${idx}")
        params.append(data.status)
        idx += 1
    if fields:
        params.append(plugin_id)
        await db_pool.execute(
            f"UPDATE plugins SET {', '.join(fields)} WHERE id = ${idx}",
            *params,
        )
    return {"message": "Plugin updated", "plugin_id": plugin_id}


# ============ 20. RATE LIMIT ERROR HANDLING ============

@app.exception_handler(429)
async def rate_limit_handler(request: Request, exc: HTTPException):
    retry_after = request.headers.get("Retry-After", "60")
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please wait before retrying.", "retry_after": int(retry_after)},
        headers={"Retry-After": str(retry_after)},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.API_PORT)
