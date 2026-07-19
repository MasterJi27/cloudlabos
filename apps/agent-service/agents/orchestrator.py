"""Orchestrator Agent - Central workflow coordinator"""

import json
import time

from agent_sdk.base_agent import BaseAgent, AgentTask, AgentResult, AgentType
from agent_sdk.llm_client import Message


SYSTEM_PROMPT = """You are the Orchestrator Agent of CloudLabOS Enterprise.
You manage a state machine that drives an autonomous workflow loop:
OBSERVE → REASON → RESEARCH → PLAN → RISK_SCORE → [APPROVAL?] → EXECUTE → VALIDATE → STORE → repeat.

Given the current state, context, and previous step outputs, decide:
1. What the next step should be
2. Which agent to delegate to
3. What payload to send them
4. Whether to continue, pause for approval, or rollback

Respond ONLY with valid JSON. Schema:
{
  "decision": "delegate | pause_for_approval | rollback | complete",
  "next_agent": "vision|research|planner|execution|validation|memory|security|null",
  "task_type": "string",
  "payload": {},
  "reasoning": "string (max 200 chars)"
}"""


class OrchestratorAgent(BaseAgent):
    """Central workflow coordinator and state machine manager"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, agent_type=AgentType.ORCHESTRATOR, **kwargs)

    async def process(self, task: AgentTask) -> AgentResult:
        t0 = time.monotonic()

        # 1. Recall relevant memory
        memories = await self.recall(query=json.dumps(task.payload), k=5)

        # 2. Build context for LLM
        context = {
            "current_state": task.payload.get("state", "IDLE"),
            "workflow_intent": task.payload.get("intent", ""),
            "step_history": task.payload.get("step_history", []),
            "last_step_output": task.payload.get("last_output", {}),
            "relevant_memory": [m["content"] for m in memories],
            "run_id": task.workflow_run_id,
        }

        # 3. Get LLM decision
        response = await self.llm_client.chat(
            messages=[Message(role="user", content=json.dumps(context))],
            model="reasoning",
            system=SYSTEM_PROMPT,
            json_mode=True,
            temperature=0.1,
        )

        try:
            decision = json.loads(response.content)
        except json.JSONDecodeError:
            decision = {"decision": "delegate", "next_agent": "execution", "task_type": "continue", "payload": {}, "reasoning": "fallback"}

        self.logger.info(
            "orchestrator.decision",
            decision=decision["decision"],
            next_agent=decision.get("next_agent"),
            reasoning=decision.get("reasoning"),
        )

        # 4. Emit decision event
        await self.emit_event("orchestrator.decided", {
            "decision": decision["decision"],
            "next_agent": decision.get("next_agent"),
            "reasoning": decision.get("reasoning"),
        })

        # 5. Delegate to next agent
        if decision["decision"] == "delegate" and decision.get("next_agent"):
            await self.message_bus.publish(
                f"agent.{decision['next_agent']}.tasks",
                {
                    "task_id": f"{task.task_id}-{decision['next_agent']}",
                    "workflow_run_id": task.workflow_run_id,
                    "task_type": decision.get("task_type", "process"),
                    "payload": decision.get("payload", {}),
                    "parent_task_id": task.task_id,
                    "priority": task.priority,
                    "timeout_seconds": task.timeout_seconds,
                },
            )

        # 6. Store decision in memory
        await self.remember(
            content=f"Decision: {decision['decision']} → {decision.get('next_agent')}. Reason: {decision.get('reasoning', '')}",
            metadata={"source": self.agent_id, "run_id": task.workflow_run_id, "task_id": task.task_id},
        )

        return AgentResult(
            task_id=task.task_id,
            agent_id=self.agent_id,
            status="success",
            output=decision,
            confidence=0.9,
            execution_time_ms=int((time.monotonic() - t0) * 1000),
            needs_human_review=decision["decision"] == "pause_for_approval",
        )