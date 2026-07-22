from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.agent import (
    AgentCreate, AgentUpdate, AgentResponse, AgentImport,
    ToolCreate, ToolResponse, AgentSessionResponse,
    AgentInvokeRequest, AgentInvokeResponse,
)
from app.services.agent import AgentService
from app.services.audit import AuditService
from app.core.security import get_current_user, require_permission
from app.core.agent_presets import available_types
from app.api.deps import require_workspace_member
from app.models.user import User
from typing import Optional

router = APIRouter()


def _agent_response(a, tools) -> AgentResponse:
    return AgentResponse(
        id=a.id, name=a.name, description=a.description,
        status=a.status.value if hasattr(a.status, "value") else a.status,
        agent_type=a.agent_type, model=a.model, system_prompt=a.system_prompt,
        memory_usage=a.memory_usage, uptime=a.uptime,
        tasks_total=a.tasks_total, tokens_used=a.tokens_used or 0,
        tags=list(a.tags or []), is_starred=bool(a.is_starred), tools=tools,
        workspace_id=a.workspace_id, created_by=a.created_by, created_at=a.created_at,
    )


async def _get_agent_or_404(svc: AgentService, agent_id: str, user: User, db: AsyncSession):
    agent = await svc.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    await require_workspace_member(agent.workspace_id, user, db)
    return agent


@router.get("/types")
async def list_agent_types(user: User = Depends(get_current_user)):
    """Available specialized agent types (each has a preset system prompt)."""
    return {"types": available_types()}


@router.get("/", response_model=list[AgentResponse])
async def list_agents(
    workspace_id: str = Query(...),
    tag: Optional[str] = Query(None),
    starred: Optional[bool] = Query(None),
    user: User = Depends(require_permission("agent:read")),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(workspace_id, user, db)
    svc = AgentService(db)
    agents = await svc.list_agents(workspace_id)
    result = []
    for a in agents:
        if tag and tag not in (a.tags or []):
            continue
        if starred is not None and bool(a.is_starred) != starred:
            continue
        result.append(_agent_response(a, await svc._get_tools(a.id)))
    return result


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    workspace_id: str = Query(...),
    body: AgentCreate = ...,
    user: User = Depends(require_permission("agent:*")),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(workspace_id, user, db)
    svc = AgentService(db)
    agent = await svc.create_agent(workspace_id, user.id, body.model_dump())
    await AuditService(db).log(user.id, workspace_id, "agent.create", "agent", agent.id, {"name": agent.name})
    return _agent_response(agent, [])


@router.post("/import", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def import_agent(
    body: AgentImport,
    workspace_id: str = Query(...),
    user: User = Depends(require_permission("agent:*")),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(workspace_id, user, db)
    svc = AgentService(db)
    agent = await svc.import_agent(workspace_id, user.id, body.model_dump())
    await AuditService(db).log(user.id, workspace_id, "agent.import", "agent", agent.id, {"name": agent.name})
    return _agent_response(agent, await svc._get_tools(agent.id))


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    user: User = Depends(require_permission("agent:read")),
    db: AsyncSession = Depends(get_db),
):
    svc = AgentService(db)
    agent = await _get_agent_or_404(svc, agent_id, user, db)
    return _agent_response(agent, await svc._get_tools(agent.id))


@router.get("/{agent_id}/export")
async def export_agent(
    agent_id: str,
    user: User = Depends(require_permission("agent:read")),
    db: AsyncSession = Depends(get_db),
):
    svc = AgentService(db)
    await _get_agent_or_404(svc, agent_id, user, db)
    data = await svc.export_agent(agent_id)
    return JSONResponse(content=data, headers={
        "Content-Disposition": f'attachment; filename="agent-{agent_id[:8]}.json"'
    })


@router.post("/{agent_id}/clone", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def clone_agent(
    agent_id: str,
    user: User = Depends(require_permission("agent:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = AgentService(db)
    src = await _get_agent_or_404(svc, agent_id, user, db)
    clone = await svc.clone_agent(agent_id, user.id)
    await AuditService(db).log(user.id, src.workspace_id, "agent.clone", "agent", clone.id, {"from": agent_id})
    return _agent_response(clone, await svc._get_tools(clone.id))


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    body: AgentUpdate,
    user: User = Depends(require_permission("agent:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = AgentService(db)
    await _get_agent_or_404(svc, agent_id, user, db)
    agent = await svc.update_agent(agent_id, body.model_dump(exclude_unset=True))
    return _agent_response(agent, await svc._get_tools(agent.id))


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: str,
    user: User = Depends(require_permission("agent:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = AgentService(db)
    agent = await _get_agent_or_404(svc, agent_id, user, db)
    await AuditService(db).log(user.id, agent.workspace_id, "agent.delete", "agent", agent_id, {"name": agent.name})
    await svc.delete_agent(agent_id)


@router.post("/{agent_id}/tools", response_model=ToolResponse, status_code=status.HTTP_201_CREATED)
async def add_tool(
    agent_id: str,
    body: ToolCreate,
    user: User = Depends(require_permission("agent:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = AgentService(db)
    await _get_agent_or_404(svc, agent_id, user, db)
    tool = await svc.add_tool(agent_id, body.model_dump())
    return ToolResponse(
        id=tool.id, name=tool.name, description=tool.description,
        tool_type=tool.tool_type.value if hasattr(tool.tool_type, "value") else tool.tool_type,
        source=tool.source, enabled=tool.enabled, created_at=tool.created_at,
    )


@router.delete("/{agent_id}/tools/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tool(
    agent_id: str, tool_id: str,
    user: User = Depends(require_permission("agent:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = AgentService(db)
    await _get_agent_or_404(svc, agent_id, user, db)
    if not await svc.remove_tool(tool_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")


@router.post("/{agent_id}/invoke", response_model=AgentInvokeResponse)
async def invoke_agent(
    agent_id: str,
    body: AgentInvokeRequest,
    user: User = Depends(require_permission("agent:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = AgentService(db)
    await _get_agent_or_404(svc, agent_id, user, db)
    try:
        output, session_id, thread_id = await svc.invoke_agent(
            agent_id, user.id, body.input, body.session_id
        )
        return AgentInvokeResponse(output=output, session_id=session_id, thread_id=thread_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{agent_id}/sessions", response_model=list[AgentSessionResponse])
async def list_sessions(
    agent_id: str,
    user: User = Depends(require_permission("agent:read")),
    db: AsyncSession = Depends(get_db),
):
    svc = AgentService(db)
    await _get_agent_or_404(svc, agent_id, user, db)
    sessions = await svc.get_sessions(agent_id)
    return [AgentSessionResponse(
        id=s.id, agent_id=s.agent_id,
        thread_id=s.thread_id, status=s.status,
        created_at=s.created_at,
    ) for s in sessions]


@router.post("/{agent_id}/sessions/{session_id}/clear")
async def clear_session(
    agent_id: str, session_id: str,
    user: User = Depends(require_permission("agent:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = AgentService(db)
    await _get_agent_or_404(svc, agent_id, user, db)
    if not await svc.clear_session(session_id, agent_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return {"status": "cleared"}
