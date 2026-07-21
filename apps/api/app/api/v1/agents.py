from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.agent import (
    AgentCreate, AgentUpdate, AgentResponse,
    ToolCreate, ToolResponse, AgentSessionResponse,
    AgentInvokeRequest, AgentInvokeResponse,
)
from app.services.agent import AgentService
from app.core.security import get_current_user, require_permission
from app.api.deps import require_workspace_member
from app.models.user import User
from typing import Optional

router = APIRouter()


async def _get_agent_or_404(svc: AgentService, agent_id: str, user: User, db: AsyncSession):
    agent = await svc.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    await require_workspace_member(agent.workspace_id, user, db)
    return agent


@router.get("/", response_model=list[AgentResponse])
async def list_agents(
    workspace_id: str = Query(...),
    user: User = Depends(require_permission("agent:read")),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(workspace_id, user, db)
    svc = AgentService(db)
    agents = await svc.list_agents(workspace_id)
    result = []
    for a in agents:
        tools = await svc._get_tools(a.id)
        result.append(AgentResponse(
            id=a.id, name=a.name, description=a.description,
            status=a.status.value if hasattr(a.status, 'value') else a.status,
            agent_type=a.agent_type, model=a.model,
            system_prompt=a.system_prompt,
            memory_usage=a.memory_usage, uptime=a.uptime,
            tasks_total=a.tasks_total, tools=tools,
            workspace_id=a.workspace_id, created_by=a.created_by,
            created_at=a.created_at,
        ))
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
    return AgentResponse(
        id=agent.id, name=agent.name, description=agent.description,
        status=agent.status.value if hasattr(agent.status, 'value') else agent.status,
        agent_type=agent.agent_type, model=agent.model,
        system_prompt=agent.system_prompt,
        memory_usage=agent.memory_usage, uptime=agent.uptime,
        tasks_total=agent.tasks_total, tools=[],
        workspace_id=agent.workspace_id, created_by=agent.created_by,
        created_at=agent.created_at,
    )


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    user: User = Depends(require_permission("agent:read")),
    db: AsyncSession = Depends(get_db),
):
    svc = AgentService(db)
    agent = await _get_agent_or_404(svc, agent_id, user, db)
    tools = await svc._get_tools(agent.id)
    return AgentResponse(
        id=agent.id, name=agent.name, description=agent.description,
        status=agent.status.value if hasattr(agent.status, 'value') else agent.status,
        agent_type=agent.agent_type, model=agent.model,
        system_prompt=agent.system_prompt,
        memory_usage=agent.memory_usage, uptime=agent.uptime,
        tasks_total=agent.tasks_total, tools=tools,
        workspace_id=agent.workspace_id, created_by=agent.created_by,
        created_at=agent.created_at,
    )


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
    tools = await svc._get_tools(agent.id)
    return AgentResponse(
        id=agent.id, name=agent.name, description=agent.description,
        status=agent.status.value if hasattr(agent.status, 'value') else agent.status,
        agent_type=agent.agent_type, model=agent.model,
        system_prompt=agent.system_prompt,
        memory_usage=agent.memory_usage, uptime=agent.uptime,
        tasks_total=agent.tasks_total, tools=tools,
        workspace_id=agent.workspace_id, created_by=agent.created_by,
        created_at=agent.created_at,
    )


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: str,
    user: User = Depends(require_permission("agent:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = AgentService(db)
    await _get_agent_or_404(svc, agent_id, user, db)
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
        tool_type=tool.tool_type.value if hasattr(tool.tool_type, 'value') else tool.tool_type,
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
