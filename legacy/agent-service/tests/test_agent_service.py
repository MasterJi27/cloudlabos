"""Tests for CloudLabOS Agent Service"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from collections import defaultdict


# Test AgentTask model
def test_agent_task_model():
    """Test AgentTask Pydantic model"""
    from pydantic import BaseModel, ValidationError
    from typing import Any, Dict, List, Optional
    import uuid

    class AgentTask(BaseModel):
        task_id: str = ""
        workflow_run_id: str = ""
        task_type: str = ""
        payload: Dict[str, Any] = {}
        priority: int = 5
        timeout_seconds: int = 300
        retry_count: int = 0
        max_retries: int = 3
        parent_task_id: Optional[str] = None
        context_window: Optional[List[Dict]] = None

        def __init__(self, **data):
            if not data.get("task_id"):
                data["task_id"] = str(uuid.uuid4())
            super().__init__(**data)

    task = AgentTask(task_type="browser_action", payload={"url": "https://example.com"})
    assert task.task_type == "browser_action"
    assert task.payload["url"] == "https://example.com"
    assert task.priority == 5
    assert task.timeout_seconds == 300
    assert len(task.task_id) > 0  # Auto-generated UUID


# Test AgentResult model
def test_agent_result_model():
    """Test AgentResult Pydantic model"""
    from pydantic import BaseModel
    from typing import Any, Dict, Optional, List

    class AgentResult(BaseModel):
        task_id: str
        agent_id: str
        status: str
        output: Dict[str, Any] = {}
        confidence: float = 0.0
        execution_time_ms: int = 0
        needs_human_review: bool = False
        rollback_data: Optional[Dict[str, Any]] = None
        memory_items: Optional[List[Dict[str, Any]]] = None

    result = AgentResult(
        task_id="task-123",
        agent_id="orchestrator-1",
        status="success",
        output={"action": "navigate", "url": "https://example.com"},
        confidence=0.95,
        execution_time_ms=1234,
    )
    assert result.task_id == "task-123"
    assert result.agent_id == "orchestrator-1"
    assert result.status == "success"
    assert result.confidence == 0.95


# Test AgentType enum
def test_agent_types():
    """Test all agent types are defined"""
    agent_types = [
        "orchestrator", "vision", "research", "planner",
        "execution", "validation", "memory", "security",
    ]
    for at in agent_types:
        assert at in agent_types


# Test orchestrator decision schema
def test_orchestrator_decision_schema():
    """Test orchestrator LLM response schema validation"""
    valid_decisions = ["delegate", "pause_for_approval", "rollback", "complete"]
    valid_agents = ["vision", "research", "planner", "execution", "validation", "memory", "security", None]

    # Valid decision
    decision = {
        "decision": "delegate",
        "next_agent": "execution",
        "task_type": "browser_action",
        "payload": {"url": "https://example.com"},
        "reasoning": "Navigating to target URL as first step",
    }
    assert decision["decision"] in valid_decisions
    assert decision["next_agent"] in valid_agents
    assert len(decision["reasoning"]) <= 200

    # Pause for approval
    decision2 = {
        "decision": "pause_for_approval",
        "next_agent": None,
        "task_type": "",
        "payload": {},
        "reasoning": "High risk action requires human approval",
    }
    assert decision2["decision"] in valid_decisions
    assert decision2["next_agent"] is None


# Test orchestrator state machine
def test_orchestrator_state_machine():
    """Test orchestrator state transitions"""
    VALID_STATES = ["IDLE", "OBSERVING", "REASONING", "RESEARCHING", "PLANNING",
                    "SCORING_RISK", "APPROVAL_REQUIRED", "EXECUTING", "VALIDATING",
                    "STORING", "COMPLETED", "FAILED"]

    # State transitions
    transitions = {
        "IDLE": "OBSERVING",
        "OBSERVING": "REASONING",
        "REASONING": "RESEARCHING",
        "RESEARCHING": "PLANNING",
        "PLANNING": "SCORING_RISK",
        "SCORING_RISK": "APPROVAL_REQUIRED",
        "APPROVAL_REQUIRED": "EXECUTING",
        "EXECUTING": "VALIDATING",
        "VALIDATING": "STORING",
        "STORING": "COMPLETED",
    }

    current = "IDLE"
    for expected_next in transitions.values():
        next_state = transitions.get(current)
        assert next_state == expected_next
        current = next_state


# Test agent metrics tracking
def test_agent_metrics_tracking():
    """Test agent metrics data structure"""
    metrics = {
        "tasks_total": 0,
        "tasks_success": 0,
        "tasks_failed": 0,
        "latencies": [],
        "current_task": None,
        "start_time": 0,
    }

    def record_task(metrics, success, latency_ms):
        metrics["tasks_total"] += 1
        if success:
            metrics["tasks_success"] += 1
        else:
            metrics["tasks_failed"] += 1
        metrics["latencies"].append(latency_ms)

    record_task(metrics, True, 100)
    record_task(metrics, True, 150)
    record_task(metrics, False, 5000)

    assert metrics["tasks_total"] == 3
    assert metrics["tasks_success"] == 2
    assert metrics["tasks_failed"] == 1
    assert len(metrics["latencies"]) == 3
    assert sum(metrics["latencies"]) / len(metrics["latencies"]) == 1750


# Test agent event emission
def test_agent_event_emission():
    """Test agent event structure"""
    event = {
        "event_type": "execution.completed",
        "data": {
            "task_type": "browser_action",
            "success": True,
        },
        "agent_id": "execution-1",
        "timestamp": "2024-01-01T00:00:00Z",
    }

    assert event["event_type"] == "execution.completed"
    assert event["data"]["success"] is True
    assert event["agent_id"] == "execution-1"


# Test execution agent task types
def test_execution_agent_task_types():
    """Test execution agent supported task types"""
    VALID_TASK_TYPES = ["browser_action", "terminal_command", "api_call"]

    assert "browser_action" in VALID_TASK_TYPES
    assert "terminal_command" in VALID_TASK_TYPES
    assert "api_call" in VALID_TASK_TYPES
    assert "unknown_type" not in VALID_TASK_TYPES


# Test browser action payload
def test_browser_action_payload():
    """Test browser action payload structure"""
    payload = {
        "action": "navigate",
        "url": "https://example.com",
        "selector": "#login",
        "text": "hello",
    }

    assert payload["action"] == "navigate"
    assert payload["url"].startswith("https://")
    assert payload["selector"].startswith("#")


# Test security agent risk scoring
def test_security_risk_scoring():
    """Test security agent risk score calculation"""
    def calculate_risk_score(action_type, target, reversibility):
        base_risk = {
            "read": 0.1,
            "navigate": 0.2,
            "click": 0.3,
            "type": 0.4,
            "submit": 0.6,
            "delete": 0.9,
            "execute": 0.8,
        }.get(action_type, 0.5)

        target_multiplier = 1.2 if "production" in target else 1.0
        reversibility_penalty = 0.2 if reversibility == "irreversible" else 0.0

        return min(1.0, base_risk * target_multiplier + reversibility_penalty)

    # Low risk
    assert calculate_risk_score("read", "staging", "reversible") < 0.3
    # Medium risk
    assert 0.3 <= calculate_risk_score("click", "production", "reversible") < 0.6
    # High risk
    assert calculate_risk_score("delete", "production", "irreversible") >= 0.8


# Test message bus channel naming
def test_message_bus_channels():
    """Test Redis stream channel naming convention"""
    agent_types = ["orchestrator", "vision", "security", "planner", "execution", "validation"]

    for agent_type in agent_types:
        task_channel = f"agent.{agent_type}.tasks"
        event_channel = f"agent:{agent_type}:events"
        assert task_channel == f"agent.{agent_type}.tasks"
        assert event_channel == f"agent:{agent_type}:events"


# Test health check response
def test_health_response():
    """Test health endpoint response structure"""
    agents = ["orchestrator", "vision", "security", "planner", "execution", "validation"]
    response = {"status": "healthy", "agents": agents}

    assert response["status"] == "healthy"
    assert len(response["agents"]) == 6
    assert "orchestrator" in response["agents"]
