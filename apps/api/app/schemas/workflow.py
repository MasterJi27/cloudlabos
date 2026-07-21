from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    definition: dict[str, Any] = {}


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    definition: Optional[dict[str, Any]] = None


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    version: str
    steps: int
    last_run: Optional[str] = None
    workspace_id: str
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkflowRunResponse(BaseModel):
    id: str
    workflow_id: str
    workflow_name: Optional[str] = None
    status: str
    trigger: str
    progress: int
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkflowRunStepResponse(BaseModel):
    id: str
    run_id: str
    name: str
    status: str
    input: dict[str, Any] = {}
    output: dict[str, Any] = {}
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class WorkflowRunDetailResponse(BaseModel):
    id: str
    workflow_id: str
    workflow_name: Optional[str] = None
    status: str
    trigger: str
    progress: int
    steps: list[WorkflowRunStepResponse] = []
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    cron: str


class ScheduleResponse(BaseModel):
    id: str
    workflow_id: str
    cron: str
    enabled: bool
    last_run_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
