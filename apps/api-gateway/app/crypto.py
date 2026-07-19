"""CloudLabOS Secrets Vault - Fernet-based symmetric encryption for connector credentials"""

import base64
import os
import hashlib

from cryptography.fernet import Fernet


def _derive_key(raw_key: str) -> bytes:
    """Derive a valid 32-byte Fernet key from an arbitrary-length string."""
    digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def get_fernet() -> Fernet:
    """Return a Fernet instance using the ENCRYPTION_KEY env var."""
    raw = os.environ.get("ENCRYPTION_KEY", "")
    if not raw or len(raw) < 32:
        raise RuntimeError("ENCRYPTION_KEY must be at least 32 characters")
    return Fernet(_derive_key(raw))


def encrypt_secret(plaintext: str) -> bytes:
    """Encrypt a plaintext secret (API key, token, etc.) for storage."""
    f = get_fernet()
    return f.encrypt(plaintext.encode("utf-8"))


def decrypt_secret(ciphertext: bytes) -> str:
    """Decrypt a previously encrypted secret."""
    f = get_fernet()
    return f.decrypt(ciphertext).decode("utf-8")
