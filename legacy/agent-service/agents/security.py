"""Security Agent - Risk evaluation and approval gating"""

import json
import re
import time
from typing import Any, Dict, List, Tuple

from agent_sdk.base_agent import BaseAgent, AgentTask, AgentResult, AgentType
from agent_sdk.llm_client import Message


# Hard-reject patterns - never auto-approve
REJECT_PATTERNS = [
    r"rm\s+-rf\s+/",
    r":\(\)\{.*\}",
    r"dd\s+if=/dev/zero",
    r"mkfs\.",
    r"chmod\s+-R\s+777\s+/",
    r"wget.*\|\s*bash",
    r"curl.*\|\s*sh",
]

# Risk bump patterns
RISK_BUMPS: List[Tuple[str, float]] = [
    (r"\bsudo\b", 0.3),
    (r"\bdrop\s+table\b", 0.5),
    (r"\bdelete\s+from\b", 0.3),
    (r"\bpassword\b", 0.2),
    (r"\bsecret\b", 0.2),
    (r"\bproduction\b", 0.3),
    (r"\bprod\b", 0.25),
    (r"\btruncate\b", 0.4),
    (r"\bkubectl\s+delete\b", 0.4),
    (r"\.env\b", 0.2),
]

SYSTEM_PROMPT = """You are the Security Agent of CloudLabOS Enterprise.
Evaluate the proposed action for risk. Consider:
- Irreversibility (can this be undone?)
- Blast radius (how many systems/data could be affected?)
- Credential exposure (does this involve secrets or auth tokens?)
- Policy violations (does this bypass controls or access prohibited resources?)

Respond ONLY with valid JSON:
{
  "risk_score": 0.0-1.0,
  "risk_category": "low|medium|high|critical",
  "risk_reasons": ["string"],
  "recommendation": "allow|allow_with_logging|require_approval|reject",
  "safe_alternative": "string|null",
  "audit_notes": "string"
}"""


class SecurityAgent(BaseAgent):
    """Security evaluation and approval gating"""

    def __init__(self, *args, approval_threshold: float = 0.7, **kwargs):
        super().__init__(*args, agent_type=AgentType.SECURITY, **kwargs)
        self._approval_threshold = approval_threshold

    async def process(self, task: AgentTask) -> AgentResult:
        t0 = time.monotonic()
        payload = task.payload

        action = payload.get("action", "")
        command = payload.get("command", "")
        intent = payload.get("workflow_intent", "")
        text = f"{action} {command}".strip()

        # 1. Hard reject check
        for pattern in REJECT_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                result = {
                    "risk_score": 1.0,
                    "risk_category": "critical",
                    "risk_reasons": [f"Matched hard-reject pattern: {pattern}"],
                    "recommendation": "reject",
                    "safe_alternative": None,
                    "audit_notes": f"Auto-rejected by rule engine: {pattern}",
                }
                await self._write_audit(task, result)
                return AgentResult(
                    task_id=task.task_id,
                    agent_id=self.agent_id,
                    status="success",
                    output=result,
                    confidence=1.0,
                    execution_time_ms=int((time.monotonic() - t0) * 1000),
                    needs_human_review=False,
                )

        # 2. Rule-based risk bumps
        base_risk = 0.1
        for pattern, bump in RISK_BUMPS:
            if re.search(pattern, text, re.IGNORECASE):
                base_risk = min(1.0, base_risk + bump)

        # 3. LLM semantic evaluation
        context = {
            "proposed_action": action,
            "command": command,
            "workflow_intent": intent,
            "pre_computed_risk": round(base_risk, 2),
        }
        response = await self.llm_client.chat(
            messages=[Message(role="user", content=json.dumps(context))],
            model="reasoning",
            system=SYSTEM_PROMPT,
            json_mode=True,
            temperature=0.0,
        )

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            result = {"risk_score": base_risk, "risk_category": "medium", "risk_reasons": ["fallback"], "recommendation": "allow"}

        # 4. Override recommendation based on threshold
        final_score = max(base_risk, result.get("risk_score", 0.0))
        result["risk_score"] = round(final_score, 3)
        if final_score >= self._approval_threshold:
            result["recommendation"] = "require_approval"

        await self._write_audit(task, result)
        await self.emit_event("security.evaluated", {
            "risk_score": result["risk_score"],
            "recommendation": result["recommendation"],
        })

        needs_review = result["recommendation"] in ("require_approval", "reject")

        return AgentResult(
            task_id=task.task_id,
            agent_id=self.agent_id,
            status="success",
            output=result,
            confidence=0.9,
            execution_time_ms=int((time.monotonic() - t0) * 1000),
            needs_human_review=needs_review,
        )

    async def _write_audit(self, task: AgentTask, result: Dict[str, Any]):
        await self.message_bus.publish("audit.events", {
            "agent_id": self.agent_id,
            "run_id": task.workflow_run_id,
            "task_id": task.task_id,
            "action": task.payload.get("action", ""),
            "risk_score": result.get("risk_score"),
            "recommendation": result.get("recommendation"),
            "audit_notes": result.get("audit_notes", ""),
        })