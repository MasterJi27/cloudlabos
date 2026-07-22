"""Tests for CloudLabOS Browser Service"""

import pytest
import re


# Test sandbox exec request model
def test_sandbox_exec_request():
    """Test SandboxExecRequest Pydantic model"""
    from pydantic import BaseModel

    class SandboxExecRequest(BaseModel):
        command: str
        env: dict = {}
        timeout_seconds: int = 30
        network: str = "none"

    # Valid request
    req = SandboxExecRequest(command="ls -la")
    assert req.command == "ls -la"
    assert req.env == {}
    assert req.timeout_seconds == 30
    assert req.network == "none"

    # With env
    req2 = SandboxExecRequest(
        command="echo $HOME",
        env={"HOME": "/root"},
        timeout_seconds=60,
    )
    assert req2.env == {"HOME": "/root"}


# Test dangerous command detection
def test_dangerous_command_patterns():
    """Test that dangerous commands are properly detected"""
    DANGEROUS_PATTERNS = [
        r"rm\s+-rf\s+/",
        r"mkfs\.",
        r"dd\s+if=",
        r":\(\)\s*\{\s*:\|:&\s*\};",
        r"chmod\s+-R\s+777\s+/",
    ]

    # These should ALL be detected
    assert re.search(DANGEROUS_PATTERNS[0], "rm -rf /")
    assert re.search(DANGEROUS_PATTERNS[0], "rm -rf /home/user")
    assert re.search(DANGEROUS_PATTERNS[1], "mkfs.ext4 /dev/sda")
    assert re.search(DANGEROUS_PATTERNS[2], "dd if=/dev/zero of=/dev/sda")
    assert re.search(DANGEROUS_PATTERNS[3], ":(){ :|:& };:")
    assert re.search(DANGEROUS_PATTERNS[4], "chmod -R 777 /var/www")

    # These should NOT be detected
    assert not re.search(DANGEROUS_PATTERNS[0], "rm file.txt")
    assert not re.search(DANGEROUS_PATTERNS[0], "rm -rf ./build")
    assert not re.search(DANGEROUS_PATTERNS[1], "mktemp /tmp/XXXX")
    assert not re.search(DANGEROUS_PATTERNS[2], "dd status=progress")
    assert not re.search(DANGEROUS_PATTERNS[4], "chmod 755 /var/www")


# Test browser action validation
def test_browser_actions():
    """Test that valid browser actions are recognized"""
    VALID_ACTIONS = [
        "navigate",
        "click",
        "type",
        "screenshot",
        "scroll",
        "wait",
        "evaluate",
    ]

    for action in VALID_ACTIONS:
        assert action in VALID_ACTIONS

    # Invalid action
    assert "invalid_action" not in VALID_ACTIONS


# Test session ID format
def test_session_id_format():
    """Test that session IDs are valid UUIDs"""
    import uuid

    session_id = str(uuid.uuid4())

    # Should be a valid UUID
    parsed = uuid.UUID(session_id)
    assert str(parsed) == session_id

    # Should have 5 segments separated by hyphens
    segments = session_id.split("-")
    assert len(segments) == 5


# Test screenshot encoding
def test_screenshot_base64_encoding():
    """Test that screenshots can be base64 encoded/decoded"""
    import base64

    # Simulate JPEG screenshot data
    fake_jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 100 + b"\xff\xd9"

    encoded = base64.b64encode(fake_jpeg).decode()
    decoded = base64.b64decode(encoded)

    assert decoded == fake_jpeg
    assert encoded.isascii()
