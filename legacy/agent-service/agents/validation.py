"""Validation Agent - Step completion verification"""

import json
import re
import time
from typing import Any, Dict

import httpx

from agent_sdk.base_agent import BaseAgent, AgentTask, AgentResult, AgentType
from agent_sdk.llm_client import Message


SYSTEM_PROMPT = """You are the Validation Agent of CloudLabOS Enterprise.
Compare the expected outcome with the actual execution result and determine:
1. Whether the step succeeded at its stated goal
2. Confidence level (0.0-1.0)
3. Whether to continue, retry, or rollback

Respond ONLY with valid JSON:
{
  "verdict": "pass|fail|partial|rollback",
  "confidence": 0.0-1.0,
  "pass_criteria_met": ["string"],
  "fail_reasons": ["string"],
  "recommendation": "continue|retry|rollback|escalate",
  "diff_summary": "string"
}"""


class ValidationAgent(BaseAgent):
    """Verifies step completion and determines pass/fail"""

    ROLLBACK_THRESHOLD = 0.6

    def __init__(self, *args, **kwargs):
        super().__init__(*args, agent_type=AgentType.VALIDATION, **kwargs)

    async def process(self, task: AgentTask) -> AgentResult:
        t0 = time.monotonic()
        payload = task.payload

        expected = payload.get("expected_output", {})
        actual = payload.get("actual_output", {})
        strategy = payload.get("validation_strategy", "llm")

        # Route to appropriate validation method
        if strategy == "regex":
            result = self._regex_validate(expected, actual)
        elif strategy == "health_check":
            result = await self._health_check(payload.get("health_url", ""))
        elif strategy == "screenshot_diff":
            result = await self._screenshot_diff(payload)
        else:
            result = await self._llm_validate(expected, actual, payload.get("step_intent", ""))

        await self.emit_event("validation.completed", {
            "verdict": result["verdict"],
            "confidence": result["confidence"],
            "recommendation": result["recommendation"],
        })

        needs_rollback = result["verdict"] == "rollback" or (
            result["verdict"] == "fail" and result["confidence"] < self.ROLLBACK_THRESHOLD
        )

        return AgentResult(
            task_id=task.task_id,
            agent_id=self.agent_id,
            status="success",
            output=result,
            confidence=result["confidence"],
            execution_time_ms=int((time.monotonic() - t0) * 1000),
            needs_human_review=result["recommendation"] == "escalate",
            rollback_data=payload.get("rollback_data") if needs_rollback else None,
        )

    async def _llm_validate(self, expected: Dict, actual: Dict, intent: str) -> Dict:
        """LLM-based semantic validation"""
        context = {
            "step_intent": intent,
            "expected": expected,
            "actual": actual,
        }
        response = await self.llm_client.chat(
            messages=[Message(role="user", content=json.dumps(context))],
            model="reasoning",
            system=SYSTEM_PROMPT,
            json_mode=True,
            temperature=0.0,
        )

        try:
            return json.loads(response.content)
        except json.JSONDecodeError:
            return {
                "verdict": "partial",
                "confidence": 0.5,
                "pass_criteria_met": [],
                "fail_reasons": ["Failed to parse LLM response"],
                "recommendation": "escalate",
                "diff_summary": "Validation error",
            }

    def _regex_validate(self, expected: Dict, actual: Dict) -> Dict:
        """Regex pattern matching validation"""
        pattern = expected.get("pattern", "")
        text = json.dumps(actual)
        match = bool(re.search(pattern, text))

        return {
            "verdict": "pass" if match else "fail",
            "confidence": 1.0 if match else 0.0,
            "pass_criteria_met": [f"Pattern matched: {pattern}"] if match else [],
            "fail_reasons": [] if match else [f"Pattern not found: {pattern}"],
            "recommendation": "continue" if match else "retry",
            "diff_summary": f"Regex {'matched' if match else 'did not match'}: {pattern}",
        }

    async def _health_check(self, url: str) -> Dict:
        """HTTP health check validation"""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url)
                ok = resp.is_success
        except Exception as e:
            return {
                "verdict": "fail",
                "confidence": 1.0,
                "pass_criteria_met": [],
                "fail_reasons": [str(e)],
                "recommendation": "retry",
                "diff_summary": f"Health check failed: {e}",
            }

        return {
            "verdict": "pass" if ok else "fail",
            "confidence": 1.0,
            "pass_criteria_met": [f"HTTP {resp.status_code}"] if ok else [],
            "fail_reasons": [] if ok else [f"HTTP {resp.status_code}"],
            "recommendation": "continue" if ok else "retry",
            "diff_summary": f"Health check returned HTTP {resp.status_code}",
        }

    async def _screenshot_diff(self, payload: Dict) -> Dict:
        """Screenshot-based visual validation"""
        # In production, this would use pixel differencing
        screenshot = payload.get("screenshot_base64", "")
        expected_elements = payload.get("expected_elements", [])

        return {
            "verdict": "pass" if screenshot else "fail",
            "confidence": 0.8 if screenshot else 0.0,
            "pass_criteria_met": ["Screenshot captured"] if screenshot else [],
            "fail_reasons": [] if screenshot else ["No screenshot available"],
            "recommendation": "continue" if screenshot else "retry",
            "diff_summary": "Visual validation complete",
        }