from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.memory import MemoryCollection, MemoryItem


class MemoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_collections(self, workspace_id: str) -> list[MemoryCollection]:
        result = await self.db.execute(
            select(MemoryCollection).where(MemoryCollection.workspace_id == workspace_id)
            .order_by(MemoryCollection.created_at.desc())
        )
        collections = result.scalars().all()
        for c in collections:
            count_result = await self.db.execute(
                select(func.count()).select_from(MemoryItem).where(MemoryItem.collection_id == c.id)
            )
            c.item_count = count_result.scalar() or 0
        return collections

    async def get_collection(self, collection_id: str) -> Optional[MemoryCollection]:
        result = await self.db.execute(select(MemoryCollection).where(MemoryCollection.id == collection_id))
        return result.scalar_one_or_none()

    async def create_collection(self, workspace_id: str, created_by: str, data: dict) -> MemoryCollection:
        col = MemoryCollection(
            name=data["name"],
            description=data.get("description"),
            embedding_model=data.get("embedding_model", "text-embedding-ada-002"),
            content_type=data.get("content_type", "document"),
            workspace_id=workspace_id,
            created_by=created_by,
        )
        self.db.add(col)
        await self.db.commit()
        await self.db.refresh(col)
        return col

    async def update_collection(self, collection_id: str, data: dict) -> Optional[MemoryCollection]:
        col = await self.get_collection(collection_id)
        if not col:
            return None
        for key, val in data.items():
            if val is not None and hasattr(col, key):
                setattr(col, key, val)
        await self.db.commit()
        await self.db.refresh(col)
        return col

    async def delete_collection(self, collection_id: str) -> bool:
        col = await self.get_collection(collection_id)
        if not col:
            return False
        await self.db.delete(col)
        await self.db.commit()
        return True

    async def list_items(self, collection_id: str, limit: int = 50, offset: int = 0) -> list[MemoryItem]:
        result = await self.db.execute(
            select(MemoryItem).where(MemoryItem.collection_id == collection_id)
            .order_by(MemoryItem.created_at.desc()).offset(offset).limit(limit)
        )
        return result.scalars().all()

    async def create_item(self, collection_id: str, data: dict, created_by: Optional[str] = None) -> MemoryItem:
        item = MemoryItem(
            collection_id=collection_id,
            content=data["content"],
            meta=data.get("metadata", {}),
            source=data.get("source"),
            created_by=created_by,
            token_count=len(data["content"].split()),
        )
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def delete_item(self, item_id: str) -> bool:
        result = await self.db.execute(select(MemoryItem).where(MemoryItem.id == item_id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True

    async def search(self, collection_id: str, query: str, top_k: int = 10,
                     score_threshold: float = 0.0) -> list[dict]:
        result = await self.db.execute(
            select(MemoryItem).where(MemoryItem.collection_id == collection_id)
            .order_by(MemoryItem.created_at.desc()).limit(top_k)
        )
        items = result.scalars().all()
        return [{"id": i.id, "collection_id": i.collection_id, "content": i.content,
                 "metadata": i.meta, "token_count": i.token_count, "source": i.source,
                 "created_by": i.created_by,
                 "score": 1.0, "created_at": i.created_at.isoformat() if i.created_at else None}
                for i in items]
