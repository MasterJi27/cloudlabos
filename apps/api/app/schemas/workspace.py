from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.security import Role


class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    role: Optional[Role] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberResponse(BaseModel):
    id: str
    user_id: str
    email: str
    name: str
    role: Role
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberInvite(BaseModel):
    email: str
    role: Role = Role.MEMBER


class MemberUpdate(BaseModel):
    role: Role
