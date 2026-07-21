from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.memory import (
    CollectionCreate, CollectionUpdate, CollectionResponse,
    MemoryCreate, MemoryResponse, MemorySearch,
)
from app.services.memory import MemoryService
from app.core.security import get_current_user, require_permission
from app.api.deps import require_workspace_member
from app.models.user import User

router = APIRouter()


async def _get_collection_or_404(svc: MemoryService, collection_id: str, user: User, db: AsyncSession):
    col = await svc.get_collection(collection_id)
    if not col:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    await require_workspace_member(col.workspace_id, user, db)
    return col


@router.get("/collections", response_model=list[CollectionResponse])
async def list_collections(
    workspace_id: str = Query(...),
    user: User = Depends(require_permission("memory:read")),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(workspace_id, user, db)
    svc = MemoryService(db)
    collections = await svc.list_collections(workspace_id)
    return [CollectionResponse(
        id=c.id, name=c.name, description=c.description,
        embedding_model=c.embedding_model,
        content_type=c.content_type.value if hasattr(c.content_type, 'value') else c.content_type,
        item_count=getattr(c, 'item_count', 0),
        workspace_id=c.workspace_id, created_by=c.created_by,
        created_at=c.created_at,
    ) for c in collections]


@router.post("/collections", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    workspace_id: str = Query(...),
    body: CollectionCreate = ...,
    user: User = Depends(require_permission("memory:*")),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(workspace_id, user, db)
    svc = MemoryService(db)
    col = await svc.create_collection(workspace_id, user.id, body.model_dump())
    return CollectionResponse(
        id=col.id, name=col.name, description=col.description,
        embedding_model=col.embedding_model,
        content_type=col.content_type.value if hasattr(col.content_type, 'value') else col.content_type,
        item_count=0, workspace_id=col.workspace_id,
        created_by=col.created_by, created_at=col.created_at,
    )


@router.get("/collections/{collection_id}", response_model=CollectionResponse)
async def get_collection(
    collection_id: str,
    user: User = Depends(require_permission("memory:read")),
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService(db)
    col = await _get_collection_or_404(svc, collection_id, user, db)
    return CollectionResponse(
        id=col.id, name=col.name, description=col.description,
        embedding_model=col.embedding_model,
        content_type=col.content_type.value if hasattr(col.content_type, 'value') else col.content_type,
        item_count=0, workspace_id=col.workspace_id,
        created_by=col.created_by, created_at=col.created_at,
    )


@router.patch("/collections/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: str,
    body: CollectionUpdate,
    user: User = Depends(require_permission("memory:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService(db)
    await _get_collection_or_404(svc, collection_id, user, db)
    col = await svc.update_collection(collection_id, body.model_dump(exclude_unset=True))
    return CollectionResponse(
        id=col.id, name=col.name, description=col.description,
        embedding_model=col.embedding_model,
        content_type=col.content_type.value if hasattr(col.content_type, 'value') else col.content_type,
        item_count=0, workspace_id=col.workspace_id,
        created_by=col.created_by, created_at=col.created_at,
    )


@router.delete("/collections/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: str,
    user: User = Depends(require_permission("memory:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService(db)
    await _get_collection_or_404(svc, collection_id, user, db)
    await svc.delete_collection(collection_id)


@router.get("/collections/{collection_id}/items", response_model=list[MemoryResponse])
async def list_items(
    collection_id: str,
    limit: int = Query(50),
    offset: int = Query(0),
    user: User = Depends(require_permission("memory:read")),
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService(db)
    await _get_collection_or_404(svc, collection_id, user, db)
    items = await svc.list_items(collection_id, limit, offset)
    return [MemoryResponse(
        id=i.id, collection_id=i.collection_id,
        content=i.content, metadata=i.response_meta,
        token_count=i.token_count, source=i.source,
        created_by=i.created_by, created_at=i.created_at,
    ) for i in items]


@router.post("/collections/{collection_id}/items", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    collection_id: str,
    body: MemoryCreate,
    user: User = Depends(require_permission("memory:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService(db)
    await _get_collection_or_404(svc, collection_id, user, db)
    item = await svc.create_item(collection_id, body.model_dump(), user.id)
    return MemoryResponse(
        id=item.id, collection_id=item.collection_id,
        content=item.content, metadata=item.response_meta,
        token_count=item.token_count, source=item.source,
        created_by=item.created_by, created_at=item.created_at,
    )


@router.delete("/collections/{collection_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    collection_id: str, item_id: str,
    user: User = Depends(require_permission("memory:*")),
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService(db)
    await _get_collection_or_404(svc, collection_id, user, db)
    if not await svc.delete_item(item_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")


@router.post("/collections/{collection_id}/search", response_model=list[MemoryResponse])
async def search_memory(
    collection_id: str,
    body: MemorySearch,
    user: User = Depends(require_permission("memory:read")),
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService(db)
    await _get_collection_or_404(svc, collection_id, user, db)
    results = await svc.search(collection_id, body.query, body.top_k, body.score_threshold)
    return [MemoryResponse(**r) for r in results]
