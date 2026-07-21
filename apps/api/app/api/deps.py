from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.core.security import get_current_user, oauth2_scheme, api_key_header
from app.core.roles import check_permission


async def get_optional_user(
    db: AsyncSession = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
    api_key: Optional[str] = Depends(api_key_header),
) -> Optional[User]:
    try:
        return await get_current_user(db, token, api_key)
    except HTTPException:
        return None


async def require_workspace_member(workspace_id: str, user: User, db: AsyncSession) -> WorkspaceMember:
    """Verify the user belongs to the workspace. Every route that reads or
    mutates a workspace-scoped resource must call this — role-based
    permission checks alone (require_permission) only check the caller's
    global role, not which workspace they actually belong to."""
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this workspace")
    return member


async def require_workspace_permission(workspace_id: str, permission: str, user: User, db: AsyncSession) -> WorkspaceMember:
    """Verify membership AND that the caller's role WITHIN THIS WORKSPACE grants
    `permission`. Workspace-scoped actions (inviting/removing members, etc.)
    must check the member's per-workspace role, not the user's global role —
    a workspace owner's global role is often just MEMBER."""
    member = await require_workspace_member(workspace_id, user, db)
    if not check_permission(member.role, permission):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return member
