"""Planner Agent - Execution graph generation"""

import json
import time
from collections import deque
from typing import Any, Dict, List

from agent_sdk.base_agent import BaseAgent, AgentTask, AgentResult, AgentType
from agent_sdk.llm_client import Message


SYSTEM_PROMPT = """You are the Planner Agent of CloudLabOS Enterprise.
Given a workflow intent, research context, and available tools, generate a
validated execution DAG as a JSON workflow definition.

Rules:
1. Each step must have a unique step_id, an agent_type, a task_type, and a payload.
2. Dependencies are expressed as a list of step_ids that must complete first.
3. Every step that modifies state MUST define a rollback_action.
4. Risk flags should be raised for steps involving credentials, production systems,
   irreversible mutations, or external API calls.
5. Estimate duration in seconds for each step.

Respond ONLY with valid JSON matching the CloudLabOS Workflow DAG schema."""


class PlannerAgent(BaseAgent):
    """Generates validated execution DAGs"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, agent_type=AgentType.PLANNER, **kwargs)

    async def process(self, task: AgentTask) -> AgentResult:
        t0 = time.monotonic()
        payload = task.payload

        intent = payload.get("intent", "")
        research_context = payload.get("research_context", {})
        available_tools = payload.get("available_tools", [])
        constraints = payload.get("constraints", {})

        # Recall similar past workflow plans
        memories = await self.recall(query=f"workflow plan for: {intent}", k=3)

        # Build context
        context = {
            "intent": intent,
            "research_context": research_context,
            "available_tools": available_tools,
            "constraints": constraints,
            "similar_plans": [m["content"] for m in memories],
        }

        # Get LLM to generate DAG
        response = await self.llm_client.chat(
            messages=[Message(role="user", content=json.dumps(context))],
            model="reasoning",
            system=SYSTEM_PROMPT,
            json_mode=True,
            temperature=0.2,
            max_tokens=8192,
        )

        try:
            dag = json.loads(response.content)
        except json.JSONDecodeError:
            dag = {"steps": [], "errors": ["Failed to parse DAG"]}

        # Validate DAG
        errors = self._validate_dag(dag)
        if errors:
            return AgentResult(
                task_id=task.task_id,
                agent_id=self.agent_id,
                status="failed",
                output={"errors": errors, "partial_dag": dag},
                confidence=0.0,
                execution_time_ms=int((time.monotonic() - t0) * 1000),
            )

        # Store the plan in memory
        await self.remember(
            content=f"Plan for '{intent}': {len(dag.get('steps', []))} steps. Risk flags: {dag.get('risk_flags', [])}",
            metadata={"source": self.agent_id, "intent": intent},
        )

        await self.emit_event("planner.dag_ready", {
            "step_count": len(dag.get("steps", [])),
            "risk_flags": dag.get("risk_flags", []),
            "est_duration": dag.get("estimated_duration_s", 0),
        })

        return AgentResult(
            task_id=task.task_id,
            agent_id=self.agent_id,
            status="success",
            output=dag,
            confidence=dag.get("confidence", 0.8),
            execution_time_ms=int((time.monotonic() - t0) * 1000),
        )

    def _validate_dag(self, dag: Dict[str, Any]) -> List[str]:
        """Cycle detection and structural validation"""
        errors = []
        steps = dag.get("steps", [])
        if not steps:
            errors.append("DAG has no steps")
            return errors

        step_ids = {s["step_id"] for s in steps}
        for step in steps:
            if "step_id" not in step:
                errors.append(f"Step missing step_id: {step}")
            if "agent_type" not in step:
                errors.append(f"Step {step.get('step_id')} missing agent_type")
            if "task_type" not in step:
                errors.append(f"Step {step.get('step_id')} missing task_type")
            for dep in step.get("depends_on", []):
                if dep not in step_ids:
                    errors.append(f"Step {step['step_id']} depends on unknown step: {dep}")

        # Cycle check (Kahn's algorithm)
        in_degree = {s["step_id"]: 0 for s in steps}
        adj = {s["step_id"]: [] for s in steps}
        for step in steps:
            for dep in step.get("depends_on", []):
                adj[dep].append(step["step_id"])
                in_degree[step["step_id"]] += 1

        queue = deque([sid for sid, deg in in_degree.items() if deg == 0])
        visited = 0
        while queue:
            node = queue.popleft()
            visited += 1
            for neighbor in adj[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if visited != len(steps):
            errors.append("Cycle detected in DAG")

        return errors