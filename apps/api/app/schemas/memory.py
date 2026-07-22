from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    embedding_model: str = "text-embedding-ada-002"
    content_type: str = "document"


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CollectionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    embedding_model: str
    content_type: str
    item_count: int = 0
    workspace_id: str
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MemoryCreate(BaseModel):
    content: str
    metadata: dict[str, Any] = {}
    source: Optional[str] = None


class MemoryResponse(BaseModel):
    id: str
    collection_id: str
    content: str
    metadata: dict[str, Any] = {}
    token_count: int = 0
    source: Optional[str] = None
    score: Optional[float] = None
    created_by: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}

class MemorySearch(BaseModel):
    query: str
    top_k: int = 10
    score_threshold: float = 0.0
    filter: dict[str, Any] = {}


class MemoryBulkCreate(BaseModel):
    items: list[MemoryCreate]
