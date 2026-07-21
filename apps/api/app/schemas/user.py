from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.core.security import Role


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: Role
    is_active: bool
    mfa_enabled: bool
    avatar_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None


class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str


class APIKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    created_at: datetime
    last_used_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class APIKeyCreate(BaseModel):
    name: str


class APIKeyCreated(BaseModel):
    id: str
    name: str
    raw_key: str
    key_prefix: str


class SessionResponse(BaseModel):
    id: str
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    last_active_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
