from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.audit import AuditLog


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(self, user_id: str, workspace_id: Optional[str], action: str,
                  resource_type: Optional[str] = None, resource_id: Optional[str] = None,
                  details: Optional[dict] = None, ip_address: Optional[str] = None) -> AuditLog:
        entry = AuditLog(
            user_id=user_id, workspace_id=workspace_id, action=action,
            resource_type=resource_type, resource_id=resource_id,
            details=details or {}, ip_address=ip_address,
        )
        self.db.add(entry)
        await self.db.commit()
        return entry

    async def list_for_workspace(self, workspace_id: str, limit: int = 100,
                                 action: Optional[str] = None) -> list[AuditLog]:
        query = select(AuditLog).where(AuditLog.workspace_id == workspace_id)
        if action:
            query = query.where(AuditLog.action == action)
        query = query.order_by(desc(AuditLog.created_at)).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()
