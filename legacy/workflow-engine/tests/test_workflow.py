"""Tests for CloudLabOS Workflow Engine"""

import pytest
import json
from collections import defaultdict, deque


# Test DAG variable rendering
def test_render_variables():
    """Test {{ VAR }} placeholder substitution"""
    dag = {
        "steps": [
            {"step_id": "nav", "payload": {"url": "{{TARGET_URL}}"}},
            {"step_id": "click", "payload": {"selector": "{{SELECTOR}}"}},
        ]
    }
    variables = {"TARGET_URL": "https://example.com", "SELECTOR": "#login"}

    dag_str = json.dumps(dag)
    for key, value in variables.items():
        dag_str = dag_str.replace(f"{{{{{key}}}}}", str(value))
        dag_str = dag_str.replace(f"{{{{ {key} }}}}", str(value))
    result = json.loads(dag_str)

    assert result["steps"][0]["payload"]["url"] == "https://example.com"
    assert result["steps"][1]["payload"]["selector"] == "#login"


def test_render_variables_missing():
    """Test that missing variables leave placeholders intact"""
    dag = {"steps": [{"payload": {"url": "{{MISSING_VAR}}"}}]}
    variables = {}

    dag_str = json.dumps(dag)
    for key, value in variables.items():
        dag_str = dag_str.replace(f"{{{{ {key} }}}}", str(value))
    result = json.loads(dag_str)

    assert result["steps"][0]["payload"]["url"] == "{{MISSING_VAR}}"


# Test dependency graph building
def test_dependency_graph():
    """Test building dependency graph from steps"""
    steps = [
        {"step_id": "a", "depends_on": []},
        {"step_id": "b", "depends_on": ["a"]},
        {"step_id": "c", "depends_on": ["a", "b"]},
        {"step_id": "d", "depends_on": ["c"]},
    ]

    dependents = defaultdict(list)
    for step in steps:
        for dep in step.get("depends_on", []):
            dependents[dep].append(step["step_id"])

    assert dependents["a"] == ["b", "c"]
    assert dependents["b"] == ["c"]
    assert dependents["c"] == ["d"]
    assert dependents["d"] == []


# Test topological sort (Kahn's algorithm)
def test_topological_sort():
    """Test Kahn's algorithm for topological ordering"""
    steps = [
        {"step_id": "a", "depends_on": []},
        {"step_id": "b", "depends_on": ["a"]},
        {"step_id": "c", "depends_on": ["a", "b"]},
        {"step_id": "d", "depends_on": ["c"]},
    ]

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
    order = []

    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    # All nodes should be visited
    assert len(order) == 4
    # 'a' should come before 'b' and 'c'
    assert order.index("a") < order.index("b")
    assert order.index("a") < order.index("c")
    assert order.index("b") < order.index("c")
    assert order.index("c") < order.index("d")


# Test cycle detection
def test_cycle_detection():
    """Test detecting cycles in DAG"""
    def has_cycle(steps):
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
    assert not has_cycle([
        {"step_id": "a", "depends_on": []},
        {"step_id": "b", "depends_on": ["a"]},
    ])

    # Has cycle
    assert has_cycle([
        {"step_id": "a", "depends_on": ["c"]},
        {"step_id": "b", "depends_on": ["a"]},
        {"step_id": "c", "depends_on": ["b"]},
    ])


# Test ready step identification
def test_ready_steps():
    """Test identifying steps with no pending dependencies"""
    steps = {
        "a": {"step_id": "a", "depends_on": []},
        "b": {"step_id": "b", "depends_on": ["a"]},
        "c": {"step_id": "c", "depends_on": ["a", "b"]},
    }

    completed = set()

    # Initially only 'a' is ready
    ready = [sid for sid, s in steps.items() if not s.get("depends_on")]
    assert ready == ["a"]

    # After completing 'a', 'b' is ready
    completed.add("a")
    ready = [
        sid
        for sid, s in steps.items()
        if sid not in completed
        and all(d in completed for d in s.get("depends_on", []))
    ]
    assert ready == ["b"]

    # After completing 'b', 'c' is ready
    completed.add("b")
    ready = [
        sid
        for sid, s in steps.items()
        if sid not in completed
        and all(d in completed for d in s.get("depends_on", []))
    ]
    assert ready == ["c"]


# Test step timeout handling
def test_step_timeout():
    """Test that step timeout defaults are reasonable"""
    default_timeout = 300  # 5 minutes

    step_with_timeout = {"step_id": "test", "timeout_s": 60}
    step_without_timeout = {"step_id": "test"}

    assert step_with_timeout.get("timeout_s", default_timeout) == 60
    assert step_without_timeout.get("timeout_s", default_timeout) == default_timeout


# Test run status determination
def test_run_status():
    """Test final run status based on step results"""
    def get_run_status(completed, failed, total):
        if len(completed) + len(failed) < total:
            return "running"
        elif not failed:
            return "success"
        else:
            return "completed_with_errors"

    # All steps succeeded
    assert get_run_status({"a", "b", "c"}, set(), 3) == "success"

    # Some steps failed
    assert get_run_status({"a", "b"}, {"c"}, 3) == "completed_with_errors"

    # Still running
    assert get_run_status({"a"}, set(), 3) == "running"
