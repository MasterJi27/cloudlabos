"""Regression tests for launch-critical API guards."""

import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, "apps/api-gateway")
from main import validate_workflow_definition


def test_workflow_definition_accepts_a_valid_dag():
    validate_workflow_definition({
        "steps": [
            {"step_id": "collect", "agent_type": "research", "task_type": "search", "depends_on": []},
            {"step_id": "summarize", "agent_type": "planner", "task_type": "llm", "depends_on": ["collect"]},
        ]
    })


@pytest.mark.parametrize("definition", [
    {"steps": []},
    {"steps": [{"step_id": "a", "agent_type": "execution", "task_type": "shell", "depends_on": ["a"]}]},
    {"steps": [
        {"step_id": "a", "agent_type": "execution", "task_type": "shell", "depends_on": ["b"]},
        {"step_id": "b", "agent_type": "execution", "task_type": "shell", "depends_on": ["a"]},
    ]},
])
def test_workflow_definition_rejects_invalid_graphs(definition):
    with pytest.raises(HTTPException) as error:
        validate_workflow_definition(definition)
    assert error.value.status_code == 422
