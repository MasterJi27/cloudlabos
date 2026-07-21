from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, Any
from app.database import get_db
from app.core.security import get_current_user, require_permission
from app.models.user import User

router = APIRouter()


class SettingsUpdate(BaseModel):
    theme: Optional[str] = None
    language: Optional[str] = None
    notifications: Optional[dict[str, Any]] = None
    system: Optional[dict[str, Any]] = None


class SettingsResponse(BaseModel):
    theme: str = "dark"
    language: str = "en"
    notifications: dict[str, Any] = {}
    system: dict[str, Any] = {}


@router.patch("/", response_model=SettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return SettingsResponse(
        theme=body.theme or "dark",
        language=body.language or "en",
        notifications=body.notifications or {},
        system=body.system or {},
    )


@router.get("/", response_model=SettingsResponse)
async def get_settings(
    user: User = Depends(get_current_user),
):
    return SettingsResponse()
