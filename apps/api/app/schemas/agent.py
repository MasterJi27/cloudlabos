from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
from app.models.agent import AgentStatus


class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    agent_type: str = "general"
    model: str = "gpt-4o"
    system_prompt: Optional[str] = None
    config: dict[str, Any] = {}


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[AgentStatus] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    config: Optional[dict[str, Any]] = None


class AgentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    agent_type: str
    model: str
    system_prompt: Optional[str] = None
    memory_usage: str
    uptime: str
    tasks_total: int
    tools: list[dict[str, Any]] = []
    workspace_id: str
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ToolCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tool_type: str = "builtin"
    source: Optional[str] = None
    config: dict[str, Any] = {}


class ToolResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    tool_type: str
    source: Optional[str] = None
    enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentSessionResponse(BaseModel):
    id: str
    agent_id: str
    thread_id: Optional[str] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentInvokeRequest(BaseModel):
    input: str
    session_id: Optional[str] = None
    thread_id: Optional[str] = None


class AgentInvokeResponse(BaseModel):
    output: str
    session_id: str
    thread_id: Optional[str] = None
