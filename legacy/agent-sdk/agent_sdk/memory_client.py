"""Hybrid Memory Client - Qdrant + PostgreSQL"""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import asyncpg
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
import structlog

logger = structlog.get_logger()

COLLECTION = "cloudlabos_memory"
VECTOR_DIM = 1536


class MemoryClient:
    """
    Unified memory API over PostgreSQL (structured) + Qdrant (semantic vector)
    """

    def __init__(
        self,
        qdrant_url: str,
        db_pool: asyncpg.Pool,
        llm_client,
        workspace_id: str,
    ):
        self._qdrant = AsyncQdrantClient(url=qdrant_url)
        self._db = db_pool
        self._llm = llm_client
        self._workspace = workspace_id

    async def ensure_collection(self):
        """Create Qdrant collection if it doesn't exist"""
        collections = await self._qdrant.get_collections()
        names = [c.name for c in collections.collections]

        if COLLECTION not in names:
            await self._qdrant.create_collection(
                COLLECTION,
                vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
            )
            # Create payload indexes for filtering
            for field in ["workspace_id", "content_type", "run_id"]:
                await self._qdrant.create_payload_index(COLLECTION, field, "keyword")
            logger.info("qdrant.collection_created", collection=COLLECTION)

    async def upsert(
        self,
        content: str,
        content_type: str,
        metadata: Dict[str, Any],
        run_id: Optional[str] = None,
        workflow_id: Optional[str] = None,
        ttl_days: int = 0,
    ) -> str:
        """Store content in both Qdrant and PostgreSQL"""
        # Generate embedding
        embeddings = await self._llm.embed([content])
        vector = embeddings[0]

        memory_id = str(uuid.uuid4())
        qdrant_id = str(uuid.uuid4())
        expires_at = (datetime.utcnow() + timedelta(days=ttl_days)) if ttl_days else None

        # Write to Qdrant
        await self._qdrant.upsert(
            COLLECTION,
            points=[
                PointStruct(
                    id=qdrant_id,
                    vector=vector,
                    payload={
                        "workspace_id": self._workspace,
                        "memory_id": memory_id,
                        "content_type": content_type,
                        "run_id": run_id,
                        "workflow_id": workflow_id,
                        "source": metadata.get("source", "unknown"),
                        "created_at": int(time.time()),
                    },
                )
            ],
        )

        # Write metadata to PostgreSQL
        await self._db.execute(
            """
            INSERT INTO memory_items
              (id, workspace_id, workflow_id, run_id, content, content_type,
               metadata, qdrant_id, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
            """,
            memory_id,
            self._workspace,
            workflow_id,
            run_id,
            content,
            content_type,
            json.dumps(metadata),
            qdrant_id,
            expires_at,
        )

        logger.debug(
            "memory.upserted",
            memory_id=memory_id,
            content_type=content_type,
            workspace=self._workspace,
        )
        return memory_id

    async def similarity_search(
        self,
        query: str,
        k: int = 5,
        content_types: Optional[List[str]] = None,
        run_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Semantic search over memory"""
        # Generate query embedding
        embeddings = await self._llm.embed([query])
        vector = embeddings[0]

        # Build filter
        conditions = [
            FieldCondition(
                key="workspace_id", match=MatchValue(value=self._workspace)
            )
        ]
        if content_types:
            conditions.append(
                FieldCondition(
                    key="content_type", match=MatchValue(value=content_types[0])
                )
            )
        if run_id:
            conditions.append(
                FieldCondition(key="run_id", match=MatchValue(value=run_id))
            )

        # Search Qdrant
        results = await self._qdrant.search(
            COLLECTION,
            query_vector=vector,
            limit=k,
            query_filter=Filter(must=conditions),
            with_payload=True,
        )

        if not results:
            return []

        # Get full content from PostgreSQL
        memory_ids = [r.payload["memory_id"] for r in results]
        rows = await self._db.fetch(
            """
            SELECT id, content, content_type, metadata, created_at
            FROM memory_items
            WHERE id = ANY($1)
            """,
            memory_ids,
        )
        row_map = {str(r["id"]): r for r in rows}

        # Combine results
        output = []
        for result in results:
            mid = result.payload["memory_id"]
            if mid in row_map:
                row = row_map[mid]
                output.append({
                    "memory_id": mid,
                    "content": row["content"],
                    "content_type": row["content_type"],
                    "metadata": json.loads(row["metadata"]),
                    "score": result.score,
                    "created_at": row["created_at"].isoformat(),
                })

        return output

    async def get_timeline(
        self, run_id: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get chronological memory items for a run"""
        rows = await self._db.fetch(
            """
            SELECT id, content, content_type, metadata, created_at
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
                "memory_id": str(r["id"]),
                "content": r["content"],
                "content_type": r["content_type"],
                "metadata": json.loads(r["metadata"]),
                "created_at": r["created_at"].isoformat(),
            }
            for r in rows
        ]

    async def delete(self, memory_id: str) -> bool:
        """Delete a memory item"""
        # Get qdrant_id first
        row = await self._db.fetchrow(
            "SELECT qdrant_id FROM memory_items WHERE id = $1", memory_id
        )
        if row and row["qdrant_id"]:
            await self._qdrant.delete(
                COLLECTION, points_selector=[row["qdrant_id"]]
            )

        await self._db.execute(
            "DELETE FROM memory_items WHERE id = $1", memory_id
        )
        return True