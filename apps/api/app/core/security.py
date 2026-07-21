from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.auth import decode_token
from app.core.roles import Role, PERMISSIONS, check_permission
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
    api_key: Optional[str] = Depends(api_key_header),
) -> User:
    if token:
        payload = decode_token(token)
        if payload and payload.get("type") == "access":
            result = await db.execute(select(User).where(User.id == payload["sub"]))
            user = result.scalar_one_or_none()
            if user and user.is_active:
                return user
    if api_key:
        result = await db.execute(select(User).where(User.api_key_hash == api_key))
        user = result.scalar_one_or_none()
        if user and user.is_active:
            return user
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


def require_permission(permission: str):
    async def checker(user: User = Depends(get_current_user)):
        if not check_permission(user.role, permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return checker
