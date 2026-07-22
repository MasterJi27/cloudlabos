"""CloudLabOS Memory Service - Vector + structured memory"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

import asyncpg
import httpx
import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pydantic_settings import BaseSettings
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointIdsList,
    VectorParams,
    VectorStruct,
)

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()

COLLECTION_NAME = "cloudlabos_memory"
VECTOR_DIM = 1536


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://cloudlabos:cloudlabos@localhost:5432/cloudlabos"
    REDIS_URL: str = "redis://localhost:6379"
    QDRANT_URL: str = "http://localhost:6333"
    OPENAI_API_KEY: str = ""
    MEMORY_PORT: int = 8003

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

db_pool: Optional[asyncpg.Pool] = None
redis_client: Optional[aioredis.Redis] = None
qdrant_client: Optional[AsyncQdrantClient] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool, redis_client, qdrant_client

    logger.info("memory_service.starting")
    db_pool = await asyncpg.create_pool(settings.DATABASE_URL)
    redis_client = await aioredis.from_url(settings.REDIS_URL, decode_responses=True, protocol=2)
    qdrant_client = AsyncQdrantClient(url=settings.QDRANT_URL)

    await _ensure_collection()
    logger.info("memory_service.ready", port=settings.MEMORY_PORT)
    yield
    logger.info("memory_service.stopping")
    await db_pool.close()
    await redis_client.close()


app = FastAPI(
    title="CloudLabOS Memory Service",
    description="Vector + structured memory for AI agents",
    version="1.0.0",
    lifespan=lifespan,
)


class MemoryUpsert(BaseModel):
    content: str
    content_type: str
    metadata: Dict[str, Any] = {}
    run_id: Optional[str] = None
    workspace_id: Optional[str] = None
    tags: List[str] = []


class MemorySearchRequest(BaseModel):
    query: str
    workspace_id: Optional[str] = None
    content_type: Optional[str] = None
    k: int = 5


# ============ Helpers ============


async def _get_embedding(text: str) -> List[float]:
    """Get embedding via OpenAI API"""
    if not settings.OPENAI_API_KEY:
        # Return a zero vector when no API key - not ideal but avoids crash
        logger.warning("memory.no_api_key")
        return [0.0] * VECTOR_DIM

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            json={"model": "text-embedding-3-small", "input": text},
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]


async def _ensure_collection():
    """Create Qdrant collection if it doesn't exist"""
    collections = await qdrant_client.get_collections()
    collection_names = [c.name for c in collections.collections]
    if COLLECTION_NAME not in collection_names:
        await qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
        )
        logger.info("memory.collection_created")


# ============ Routes ============


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "memory-service"}


@app.get("/ready")
async def readiness():
    try:
        await db_pool.fetchval("SELECT 1")
        await redis_client.ping()
        await qdrant_client.get_collections()
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/metrics")
async def metrics():
    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest, Counter, Gauge

    memory_stored = Counter("cloudlabos_memory_items_stored", "Total memory items stored")
    memory_searches = Counter("cloudlabos_memory_searches_total", "Total memory searches")
    memory_errors = Counter("cloudlabos_memory_errors_total", "Total memory errors", ["operation"])

    return JSONResponse(
        content=generate_latest().decode("utf-8"),
        media_type=CONTENT_TYPE_LATEST,
    )


@app.post("/api/v1/memory")
async def upsert_memory(item: MemoryUpsert):
    """Store a memory item (vector + metadata)"""
    embedding = await _get_embedding(item.content)

    point_id = str(abs(hash(item.content)) % (2**63))
    payload = {
        "workspace_id": item.workspace_id or "default",
        "content_type": item.content_type,
        "tags": item.tags,
        "run_id": item.run_id or "",
    }

    await qdrant_client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            {
                "id": point_id,
                "vector": embedding,
                "payload": payload,
            }
        ],
    )

    # Store full content in PostgreSQL
    await db_pool.execute(
        """
        INSERT INTO memory_items (id, workspace_id, run_id, content, content_type, metadata, tags, qdrant_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::text[], $8, NOW())
        ON CONFLICT (id) DO UPDATE SET content = $4, metadata = $6::jsonb, tags = $7::text[]
        """,
        point_id,
        item.workspace_id or "default",
        item.run_id,
        item.content,
        item.content_type,
        item.metadata,
        item.tags,
        point_id,
    )

    return {"id": point_id, "stored": True}


@app.post("/api/v1/memory/search")
async def search_memory(req: MemorySearchRequest):
    """Semantic similarity search"""
    embedding = await _get_embedding(req.query)

    must_conditions = []
    if req.workspace_id:
        must_conditions.append(
            FieldCondition(key="workspace_id", match=MatchValue(value=req.workspace_id))
        )
    if req.content_type:
        must_conditions.append(
            FieldCondition(key="content_type", match=MatchValue(value=req.content_type))
        )

    search_filter = Filter(must=must_conditions) if must_conditions else None

    results = await qdrant_client.search(
        collection_name=COLLECTION_NAME,
        query_vector=embedding,
        limit=req.k,
        query_filter=search_filter,
    )

    items = []
    for hit in results:
        point_id = hit.id
        # Enrich from PostgreSQL
        row = await db_pool.fetchrow(
            "SELECT content, metadata, tags, created_at FROM memory_items WHERE id = $1",
            point_id,
        )
        items.append(
            {
                "id": point_id,
                "score": hit.score,
                "content": row["content"] if row else hit.payload.get("content", ""),
                "content_type": hit.payload.get("content_type", ""),
                "metadata": dict(row["metadata"]) if row else {},
                "tags": row["tags"] if row else hit.payload.get("tags", []),
                "created_at": row["created_at"].isoformat() if row else None,
            }
        )

    return {"items": items, "query": req.query, "count": len(items)}


@app.get("/api/v1/memory/timeline")
async def get_timeline(run_id: str, limit: int = 50):
    """Get chronological memory items for a run"""
    rows = await db_pool.fetch(
        """
        SELECT id, content, content_type, metadata, tags, created_at
        FROM memory_items
        WHERE run_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        run_id,
        limit,
    )
    return [
        {
            "id": r["id"],
            "content": r["content"],
            "content_type": r["content_type"],
            "metadata": dict(r["metadata"]) if r["metadata"] else {},
            "tags": r["tags"] or [],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@app.get("/api/v1/memory/{workspace_id}")
async def list_memory(workspace_id: str, content_type: Optional[str] = None, limit: int = 50):
    """List memory items for a workspace"""
    query = """
        SELECT id, content, content_type, metadata, tags, run_id, created_at
        FROM memory_items
        WHERE workspace_id = $1
    """
    params: list = [workspace_id]

    if content_type:
        query += " AND content_type = $2"
        params.append(content_type)

    query += " ORDER BY created_at DESC LIMIT $3"
    params.append(limit)

    rows = await db_pool.fetch(query, *params)
    return [
        {
            "id": r["id"],
            "content": r["content"],
            "content_type": r["content_type"],
            "metadata": dict(r["metadata"]) if r["metadata"] else {},
            "tags": r["tags"] or [],
            "run_id": r["run_id"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@app.delete("/api/v1/memory/{memory_id}")
async def delete_memory(memory_id: int):
    """Delete a memory item"""
    await db_pool.execute("DELETE FROM memory_items WHERE id = $1", memory_id)
    try:
        await qdrant_client.delete(collection_name=COLLECTION_NAME, points=[memory_id])
    except Exception:
        pass
    return {"deleted": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.MEMORY_PORT)
