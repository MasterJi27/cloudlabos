from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse, MemberResponse, MemberInvite, MemberUpdate
from app.models.workspace import Workspace, WorkspaceMember
from app.models.user import User
from app.core.security import get_current_user, require_permission, check_permission, Role
from app.api.deps import require_workspace_member, require_workspace_permission

router = APIRouter()


@router.get("/", response_model=list[WorkspaceResponse])
async def list_workspaces(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user.id)
    )
    rows = result.all()
    # Bootstrap: every user must belong to at least one workspace or the entire
    # dashboard is unusable (all resource queries are scoped by workspace_id).
    # This is the single choke point the frontend always calls after auth, so
    # auto-provisioning here fixes both freshly registered and legacy accounts.
    if not rows:
        ws = Workspace(name=f"{user.name}'s Workspace", description="Personal workspace")
        db.add(ws)
        await db.flush()
        member = WorkspaceMember(workspace_id=ws.id, user_id=user.id, role=Role.ADMIN)
        db.add(member)
        await db.commit()
        await db.refresh(ws)
        return [WorkspaceResponse(id=ws.id, name=ws.name, description=ws.description, role=Role.ADMIN.value, created_at=ws.created_at)]
    return [WorkspaceResponse(id=ws.id, name=ws.name, description=ws.description, role=role, created_at=ws.created_at) for ws, role in rows]


@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(body: WorkspaceCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ws = Workspace(name=body.name, description=body.description)
    db.add(ws)
    await db.flush()
    member = WorkspaceMember(workspace_id=ws.id, user_id=user.id, role=Role.ADMIN)
    db.add(member)
    await db.commit()
    await db.refresh(ws)
    return WorkspaceResponse(id=ws.id, name=ws.name, description=ws.description, role=Role.ADMIN, created_at=ws.created_at)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(workspace_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(Workspace.id == workspace_id, WorkspaceMember.user_id == user.id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    ws, role = row
    return WorkspaceResponse(id=ws.id, name=ws.name, description=ws.description, role=role, created_at=ws.created_at)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(workspace_id: str, body: WorkspaceUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    member = await require_workspace_member(workspace_id, user, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    if body.name is not None:
        ws.name = body.name
    if body.description is not None:
        ws.description = body.description
    await db.commit()
    await db.refresh(ws)
    return WorkspaceResponse(id=ws.id, name=ws.name, description=ws.description, role=member.role, created_at=ws.created_at)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(workspace_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_workspace_permission(workspace_id, "workspace:delete", user, db)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if ws:
        await db.delete(ws)
        await db.commit()


@router.get("/{workspace_id}/members", response_model=list[MemberResponse])
async def list_members(workspace_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_workspace_member(workspace_id, user, db)
    result = await db.execute(
        select(WorkspaceMember, User.email, User.name)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace_id)
    )
    return [MemberResponse(id=wm.id, user_id=wm.user_id, email=email, name=name, role=wm.role, created_at=wm.created_at) for wm, email, name in result.all()]


@router.post("/{workspace_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(workspace_id: str, body: MemberInvite, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_workspace_permission(workspace_id, "members:write", user, db)
    result = await db.execute(select(User).where(User.email == body.email))
    invited_user = result.scalar_one_or_none()
    if not invited_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    existing = await db.execute(
        select(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == invited_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already a member")
    member = WorkspaceMember(workspace_id=workspace_id, user_id=invited_user.id, role=body.role)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return MemberResponse(id=member.id, user_id=member.user_id, email=invited_user.email, name=invited_user.name, role=member.role, created_at=member.created_at)


@router.patch("/{workspace_id}/members/{member_id}", response_model=MemberResponse)
async def update_member(workspace_id: str, member_id: str, body: MemberUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_workspace_permission(workspace_id, "members:write", user, db)
    result = await db.execute(
        select(WorkspaceMember, User.email, User.name)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.id == member_id, WorkspaceMember.workspace_id == workspace_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    member, email, name = row
    member.role = body.role
    await db.commit()
    await db.refresh(member)
    return MemberResponse(id=member.id, user_id=member.user_id, email=email, name=name, role=member.role, created_at=member.created_at)


@router.delete("/{workspace_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(workspace_id: str, member_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_workspace_permission(workspace_id, "members:write", user, db)
    result = await db.execute(
        select(WorkspaceMember).where(WorkspaceMember.id == member_id, WorkspaceMember.workspace_id == workspace_id)
    )
    member = result.scalar_one_or_none()
    if member:
        await db.delete(member)
        await db.commit()
