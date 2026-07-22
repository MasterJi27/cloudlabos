"""CloudLabOS Artifact Storage Backend - local disk with S3 fallback"""

import hashlib
import json
import os
import uuid
from pathlib import Path
from typing import BinaryIO, Optional, Tuple


class ArtifactStorage:
    """Pluggable artifact storage backend.

    Uses local disk by default; set ARTIFACT_STORAGE_BACKEND=s3 and
    provide AWS_* env vars to use S3 instead.
    """

    def __init__(self):
        self._backend = os.environ.get("ARTIFACT_STORAGE_BACKEND", "local")
        self._base_path = Path(os.environ.get("ARTIFACT_STORAGE_PATH", "/data/artifacts"))
        if self._backend == "local":
            self._base_path.mkdir(parents=True, exist_ok=True)

    async def store(self, run_id: str, step_id: Optional[str], filename: str, content_type: str, data: bytes) -> dict:
        """Store an artifact and return metadata."""
        checksum = hashlib.sha256(data).hexdigest()
        key = f"{run_id}/{uuid.uuid4().hex}/{filename}"
        size = len(data)

        if self._backend == "s3":
            storage_url = await self._store_s3(key, data, content_type)
        else:
            storage_url = await self._store_local(key, data)

        return {
            "storage_url": storage_url,
            "checksum_sha256": checksum,
            "size_bytes": size,
        }

    async def retrieve(self, storage_url: str) -> Tuple[bytes, str]:
        """Retrieve artifact bytes and content type from a storage URL."""
        if self._backend == "s3":
            return await self._retrieve_s3(storage_url)
        else:
            return await self._retrieve_local(storage_url)

    async def delete(self, storage_url: str) -> None:
        if self._backend == "s3":
            await self._delete_s3(storage_url)
        else:
            await self._delete_local(storage_url)

    async def _store_local(self, key: str, data: bytes) -> str:
        full_path = self._base_path / key
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(data)
        return f"local://{key}"

    async def _retrieve_local(self, storage_url: str) -> Tuple[bytes, str]:
        key = storage_url.replace("local://", "", 1)
        full_path = self._base_path / key
        if not full_path.exists():
            raise FileNotFoundError(f"Artifact not found: {key}")
        data = full_path.read_bytes()
        content_type = _guess_content_type(key)
        return data, content_type

    async def _delete_local(self, storage_url: str) -> None:
        key = storage_url.replace("local://", "", 1)
        full_path = self._base_path / key
        if full_path.exists():
            full_path.unlink()

    async def _store_s3(self, key: str, data: bytes, content_type: str) -> str:
        import boto3
        bucket = os.environ["ARTIFACT_S3_BUCKET"]
        client = boto3.client("s3")
        client.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
        return f"s3://{bucket}/{key}"

    async def _retrieve_s3(self, storage_url: str) -> Tuple[bytes, str]:
        import boto3
        path = storage_url.replace("s3://", "", 1)
        bucket, key = path.split("/", 1)
        client = boto3.client("s3")
        obj = client.get_object(Bucket=bucket, Key=key)
        data = obj["Body"].read()
        content_type = obj.get("ContentType", "application/octet-stream")
        return data, content_type

    async def _delete_s3(self, storage_url: str) -> None:
        import boto3
        path = storage_url.replace("s3://", "", 1)
        bucket, key = path.split("/", 1)
        client = boto3.client("s3")
        client.delete_object(Bucket=bucket, Key=key)


def _guess_content_type(path: str) -> str:
    ext = Path(path).suffix.lower()
    return {
        ".json": "application/json",
        ".csv": "text/csv",
        ".txt": "text/plain",
        ".html": "text/html",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".pdf": "application/pdf",
        ".zip": "application/zip",
        ".yaml": "application/x-yaml",
        ".yml": "application/x-yaml",
        ".md": "text/markdown",
        ".log": "text/plain",
    }.get(ext, "application/octet-stream")


_storage: Optional[ArtifactStorage] = None


def get_storage() -> ArtifactStorage:
    global _storage
    if _storage is None:
        _storage = ArtifactStorage()
    return _storage
