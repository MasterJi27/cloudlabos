"""Vision Agent - Screenshot and UI understanding"""

import base64
import json
import time
from typing import Any, Dict, List

from agent_sdk.base_agent import BaseAgent, AgentTask, AgentResult, AgentType
from agent_sdk.llm_client import Message


SYSTEM_PROMPT = """You are the Vision Agent of CloudLabOS Enterprise.
Analyze browser screenshots and DOM snapshots. Extract:
1. All interactive UI elements (buttons, inputs, links, dropdowns) with bounding boxes
2. Current page state (URL, title, loading state, error messages)
3. Recommended next actions based on the workflow goal
4. Any warnings or anomalies visible on screen

Respond ONLY with valid JSON matching this schema:
{
  "page_summary": "string",
  "page_state": "loading|ready|error|captcha|auth_required",
  "url_observed": "string|null",
  "elements": [
    {
      "type": "button|input|link|select|text|image",
      "label": "string",
      "selector": "css_selector_or_null",
      "bbox": [x, y, width, height],
      "actionable": true|false,
      "value": "string|null"
    }
  ],
  "action_recommendations": ["string"],
  "anomalies": ["string"],
  "confidence": 0.0-1.0
}"""


class VisionAgent(BaseAgent):
    """Browser screenshot and UI element analysis"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, agent_type=AgentType.VISION, **kwargs)

    async def process(self, task: AgentTask) -> AgentResult:
        t0 = time.monotonic()
        payload = task.payload

        screenshot_b64 = payload.get("screenshot_base64", "")
        goal = payload.get("goal", "")
        dom_snapshot = payload.get("dom_snapshot", "")

        # Build multimodal message
        content_parts: List[Dict[str, Any]] = [
            {"type": "text", "text": f"Workflow goal: {goal}\n\nAnalyze this screenshot:"},
        ]

        if screenshot_b64:
            content_parts.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{screenshot_b64}",
                    "detail": "high",
                },
            })

        if dom_snapshot:
            content_parts.append({
                "type": "text",
                "text": f"DOM snapshot (truncated):\n{dom_snapshot[:3000]}",
            })

        # Get LLM analysis
        response = await self.llm_client.chat(
            messages=[Message(role="user", content=content_parts)],
            model="vision",
            system=SYSTEM_PROMPT,
            json_mode=True,
            temperature=0.1,
        )

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            result = {
                "page_summary": "Failed to parse response",
                "page_state": "error",
                "elements": [],
                "action_recommendations": [],
                "anomalies": [],
                "confidence": 0.0,
            }

        # Store observation in memory
        await self.remember(
            content=f"Screen state: {result.get('page_summary', '')}. Elements: {len(result.get('elements', []))}.",
            metadata={
                "source": self.agent_id,
                "page_state": result.get("page_state"),
                "run_id": task.workflow_run_id,
            },
        )

        await self.emit_event("vision.observed", {
            "page_state": result.get("page_state"),
            "elements_count": len(result.get("elements", [])),
            "anomalies": result.get("anomalies", []),
        })

        return AgentResult(
            task_id=task.task_id,
            agent_id=self.agent_id,
            status="success",
            output=result,
            confidence=result.get("confidence", 0.8),
            execution_time_ms=int((time.monotonic() - t0) * 1000),
        )