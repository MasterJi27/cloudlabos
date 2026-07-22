from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.notification import Notification


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, type_: str, title: str, message: Optional[str] = None,
                      data: Optional[dict] = None) -> Notification:
        notif = Notification(user_id=user_id, type=type_, title=title, message=message, data=data or {})
        self.db.add(notif)
        await self.db.commit()
        await self.db.refresh(notif)
        return notif

    async def list_for_user(self, user_id: str, limit: int = 50) -> list[Notification]:
        result = await self.db.execute(
            select(Notification).where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc()).limit(limit)
        )
        return result.scalars().all()

    async def unread_count(self, user_id: str) -> int:
        result = await self.db.execute(
            select(Notification).where(Notification.user_id == user_id, Notification.is_read == False)
        )
        return len(result.scalars().all())

    async def mark_read(self, user_id: str, notification_id: str) -> bool:
        result = await self.db.execute(
            select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
        )
        notif = result.scalar_one_or_none()
        if not notif:
            return False
        notif.is_read = True
        await self.db.commit()
        return True

    async def mark_all_read(self, user_id: str) -> None:
        await self.db.execute(
            update(Notification).where(Notification.user_id == user_id, Notification.is_read == False)
            .values(is_read=True)
        )
        await self.db.commit()
