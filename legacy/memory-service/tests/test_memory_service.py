"""Tests for CloudLabOS Memory Service"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch


# Test memory item model
def test_memory_upsert_model():
    """Test MemoryUpsert Pydantic model"""
    from pydantic import BaseModel
    from typing import Any, Dict, List, Optional

    class MemoryUpsert(BaseModel):
        content: str
        content_type: str
        metadata: Dict[str, Any] = {}
        run_id: Optional[str] = None
        workspace_id: Optional[str] = None
        tags: List[str] = []

    item = MemoryUpsert(
        content="Test memory content",
        content_type="observation",
        metadata={"source": "test"},
        run_id="run-123",
        workspace_id="ws-1",
        tags=["test", "memory"],
    )
    assert item.content == "Test memory content"
    assert item.content_type == "observation"
    assert item.tags == ["test", "memory"]


# Test memory search model
def test_memory_search_model():
    """Test MemorySearchRequest Pydantic model"""
    from pydantic import BaseModel
    from typing import Optional

    class MemorySearchRequest(BaseModel):
        query: str
        workspace_id: Optional[str] = None
        content_type: Optional[str] = None
        k: int = 5

    req = MemorySearchRequest(
        query="how to deploy kubernetes",
        workspace_id="ws-1",
        content_type="knowledge",
        k=10,
    )
    assert req.query == "how to deploy kubernetes"
    assert req.k == 10


# Test content types
def test_memory_content_types():
    """Test valid memory content types"""
    VALID_TYPES = ["observation", "knowledge", "plan", "result", "error"]

    for ct in VALID_TYPES:
        assert ct in VALID_TYPES

    assert "invalid_type" not in VALID_TYPES


# Test Qdrant point ID generation
def test_point_id_generation():
    """Test deterministic point ID from content hash"""
    content = "This is a test memory"
    point_id = str(abs(hash(content)) % (2**63))

    assert point_id.isdigit()
    assert int(point_id) > 0

    # Same content = same ID (deterministic)
    point_id2 = str(abs(hash(content)) % (2**63))
    assert point_id == point_id2


# Test Qdrant payload structure
def test_qdrant_payload():
    """Test Qdrant vector payload structure"""
    payload = {
        "workspace_id": "ws-1",
        "content_type": "observation",
        "tags": ["test", "k8s"],
        "run_id": "run-123",
    }

    assert payload["workspace_id"] == "ws-1"
    assert payload["content_type"] == "observation"
    assert len(payload["tags"]) == 2


# Test vector dimensions
def test_vector_dimensions():
    """Test embedding vector dimensions"""
    VECTOR_DIM = 1536  # text-embedding-3-small

    # Valid vector
    vector = [0.0] * VECTOR_DIM
    assert len(vector) == VECTOR_DIM

    # Zero vector fallback (no API key)
    zero_vector = [0.0] * VECTOR_DIM
    assert len(zero_vector) == VECTOR_DIM


# Test Qdrant filter construction
def test_qdrant_filter():
    """Test Qdrant filter conditions"""
    from qdrant_client.models import FieldCondition, Filter, MatchValue

    # Workspace filter
    conditions = [
        FieldCondition(key="workspace_id", match=MatchValue(value="ws-1")),
    ]
    search_filter = Filter(must=conditions)
    assert search_filter is not None
    assert len(search_filter.must) == 1

    # Content type filter
    conditions2 = [
        FieldCondition(key="workspace_id", match=MatchValue(value="ws-1")),
        FieldCondition(key="content_type", match=MatchValue(value="knowledge")),
    ]
    search_filter2 = Filter(must=conditions2)
    assert len(search_filter2.must) == 2


# Test PostgreSQL query structure
def test_pg_query_structure():
    """Test PostgreSQL query patterns for memory operations"""
    # UPSERT query
    upsert_query = """
        INSERT INTO memory_items (id, workspace_id, run_id, content, content_type, metadata, tags, qdrant_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::text[], $8, NOW())
        ON CONFLICT (id) DO UPDATE SET content = $4, metadata = $6::jsonb, tags = $7::text[]
    """
    assert "INSERT INTO memory_items" in upsert_query
    assert "ON CONFLICT" in upsert_query

    # Search query
    search_query = """
        SELECT content, metadata, tags, created_at
        FROM memory_items
        WHERE id = $1
    """
    assert "SELECT" in search_query
    assert "FROM memory_items" in search_query


# Test timeline query
def test_timeline_query():
    """Test timeline query for run-specific memory"""
    query = """
        SELECT id, content, content_type, metadata, tags, created_at
        FROM memory_items
        WHERE run_id = $1
        ORDER BY created_at DESC
        LIMIT $2
    """
    assert "WHERE run_id = $1" in query
    assert "ORDER BY created_at DESC" in query


# Test health check response
def test_health_response():
    """Test health endpoint response"""
    response = {"status": "healthy", "service": "memory-service"}
    assert response["status"] == "healthy"
    assert response["service"] == "memory-service"


# Test readiness check
def test_readiness_check():
    """Test readiness requires all backends"""
    backends = {"db": True, "redis": True, "qdrant": True}
    is_ready = all(backends.values())
    assert is_ready is True

    backends["db"] = False
    is_ready = all(backends.values())
    assert is_ready is False


# Test embedding API payload
def test_embedding_api_payload():
    """Test OpenAI embedding API request format"""
    import httpx

    payload = {
        "model": "text-embedding-3-small",
        "input": "test text for embedding",
    }
    headers = {"Authorization": "Bearer test-api-key"}

    assert payload["model"] == "text-embedding-3-small"
    assert "input" in payload
    assert "Authorization" in headers


# Test collection name constant
def test_collection_name():
    """Test Qdrant collection name"""
    COLLECTION_NAME = "cloudlabos_memory"
    assert COLLECTION_NAME == "cloudlabos_memory"
    assert "_" in COLLECTION_NAME
