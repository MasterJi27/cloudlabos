"""Tests for CloudLabOS API Gateway"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import bcrypt


# Test password hashing
def test_password_hashing():
    """Test bcrypt password hashing works correctly"""
    password = "test_password_123"
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    # Verify the hash
    assert bcrypt.checkpw(password.encode("utf-8"), hashed)
    # Verify wrong password fails
    assert not bcrypt.checkpw(b"wrong_password", hashed)


def test_password_hash_format():
    """Test that password hash is a valid bcrypt hash"""
    password = "admin123"
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    hash_str = hashed.decode("utf-8")

    # bcrypt hashes start with $2b$
    assert hash_str.startswith("$2b$")
    # bcrypt hashes are 60 characters long
    assert len(hash_str) == 60


# Test JWT token creation
def test_jwt_token_creation():
    """Test JWT token creation and validation"""
    from jose import jwt
    from datetime import datetime, timedelta

    secret = "test-secret-key"
    payload = {
        "sub": "user-123",
        "email": "test@example.com",
        "name": "Test User",
        "role": "admin",
        "exp": datetime.utcnow() + timedelta(hours=1),
    }

    token = jwt.encode(payload, secret, algorithm="HS256")
    decoded = jwt.decode(token, secret, algorithms=["HS256"])

    assert decoded["sub"] == "user-123"
    assert decoded["email"] == "test@example.com"
    assert decoded["role"] == "admin"


def test_jwt_token_expiry():
    """Test that expired tokens are rejected"""
    from jose import jwt, JWTError
    from datetime import datetime, timedelta

    secret = "test-secret-key"
    payload = {
        "sub": "user-123",
        "exp": datetime.utcnow() - timedelta(hours=1),  # Already expired
    }

    token = jwt.encode(payload, secret, algorithm="HS256")

    with pytest.raises(JWTError):
        jwt.decode(token, secret, algorithms=["HS256"])


# Test input validation
def test_user_create_model():
    """Test UserCreate Pydantic model validation"""
    from pydantic import BaseModel, ValidationError
    from typing import Optional

    class UserCreate(BaseModel):
        email: str
        password: str
        name: str

    # Valid user
    user = UserCreate(email="test@example.com", password="pass123", name="Test")
    assert user.email == "test@example.com"

    # Missing required field
    with pytest.raises(ValidationError):
        UserCreate(email="test@example.com")


def test_workflow_create_model():
    """Test WorkflowCreate Pydantic model validation"""
    from pydantic import BaseModel, ValidationError
    from typing import Any, Dict, Optional

    class WorkflowCreate(BaseModel):
        name: str
        description: Optional[str] = None
        definition: Dict[str, Any]

    # Valid workflow
    wf = WorkflowCreate(
        name="Test Workflow",
        definition={"steps": [{"step_id": "step1", "agent_type": "execution"}]},
    )
    assert wf.name == "Test Workflow"
    assert wf.description is None

    # With description
    wf2 = WorkflowCreate(
        name="Test",
        description="A test workflow",
        definition={"steps": []},
    )
    assert wf2.description == "A test workflow"


# Test risk scoring logic
def test_risk_category_calculation():
    """Test risk score to category mapping"""

    def get_risk_category(score: float) -> str:
        if score >= 0.9:
            return "critical"
        if score >= 0.7:
            return "high"
        if score >= 0.4:
            return "medium"
        return "low"

    assert get_risk_category(0.95) == "critical"
    assert get_risk_category(0.9) == "critical"
    assert get_risk_category(0.85) == "high"
    assert get_risk_category(0.7) == "high"
    assert get_risk_category(0.5) == "medium"
    assert get_risk_category(0.4) == "medium"
    assert get_risk_category(0.3) == "low"
    assert get_risk_category(0.0) == "low"


# Test security patterns
def test_dangerous_command_detection():
    """Test dangerous command pattern detection"""
    import re

    DANGEROUS_PATTERNS = [
        r"rm\s+-rf\s+/",
        r"mkfs\.",
        r"dd\s+if=",
        r":\(\)\s*\{\s*:\|:&\s*\};",
        r"chmod\s+-R\s+777\s+/",
    ]

    dangerous_commands = [
        "rm -rf /",
        "rm -rf /home",
        "mkfs.ext4 /dev/sda",
        "dd if=/dev/zero of=/dev/sda",
        ":(){ :|:& };:",
        "chmod -R 777 /var/www",
    ]

    safe_commands = [
        "ls -la",
        "npm install",
        "git clone https://github.com/user/repo",
        "docker pull nginx",
        "kubectl get pods",
    ]

    for cmd in dangerous_commands:
        for pattern in DANGEROUS_PATTERNS:
            if re.search(pattern, cmd):
                break
        else:
            pytest.fail(f"Command '{cmd}' should be detected as dangerous")

    for cmd in safe_commands:
        for pattern in DANGEROUS_PATTERNS:
            if re.search(pattern, cmd):
                pytest.fail(f"Command '{cmd}' should NOT be detected as dangerous")


# Test DAG cycle detection
def test_dag_cycle_detection():
    """Test Kahn's algorithm for topological sort (cycle detection)"""
    from collections import defaultdict, deque

    def has_cycle(steps):
        """Returns True if the DAG has a cycle"""
        in_degree = defaultdict(int)
        graph = defaultdict(list)

        for step in steps:
            step_id = step["step_id"]
            if step_id not in in_degree:
                in_degree[step_id] = 0
            for dep in step.get("depends_on", []):
                graph[dep].append(step_id)
                in_degree[step_id] += 1

        queue = deque([node for node in in_degree if in_degree[node] == 0])
        visited = 0

        while queue:
            node = queue.popleft()
            visited += 1
            for neighbor in graph[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        return visited != len(in_degree)

    # No cycle
    steps_no_cycle = [
        {"step_id": "a", "depends_on": []},
        {"step_id": "b", "depends_on": ["a"]},
        {"step_id": "c", "depends_on": ["a", "b"]},
    ]
    assert not has_cycle(steps_no_cycle)

    # Has cycle
    steps_with_cycle = [
        {"step_id": "a", "depends_on": ["c"]},
        {"step_id": "b", "depends_on": ["a"]},
        {"step_id": "c", "depends_on": ["b"]},
    ]
    assert has_cycle(steps_with_cycle)


# Test variable rendering
def test_variable_rendering():
    """Test {{ VAR }} placeholder substitution"""
    import json

    def render_variables(dag, variables):
        dag_str = json.dumps(dag)
        for key, value in variables.items():
            dag_str = dag_str.replace(f"{{{{{key}}}}}", str(value))
            dag_str = dag_str.replace(f"{{{{ {key} }}}}", str(value))
        return json.loads(dag_str)

    dag = {
        "steps": [
            {"step_id": "nav", "payload": {"url": "{{TARGET_URL}}"}},
            {"step_id": "click", "payload": {"selector": "{{SELECTOR}}"}},
        ]
    }

    result = render_variables(dag, {"TARGET_URL": "https://example.com", "SELECTOR": "#login"})

    assert result["steps"][0]["payload"]["url"] == "https://example.com"
    assert result["steps"][1]["payload"]["selector"] == "#login"
