"""Execution Agent - Browser and terminal automation"""

import asyncio
import json
import time
from typing import Any, Dict

import httpx

from agent_sdk.base_agent import BaseAgent, AgentTask, AgentResult, AgentType

SANDBOX_TIMEOUT = 30


class ExecutionAgent(BaseAgent):
    """Executes browser, terminal, and API actions"""

    def __init__(self, *args, browser_service_url: str = "", **kwargs):
        super().__init__(*args, agent_type=AgentType.EXECUTION, **kwargs)
        self._browser_url = browser_service_url
        self._http = httpx.AsyncClient(timeout=60)

    async def process(self, task: AgentTask) -> AgentResult:
        t0 = time.monotonic()
        payload = task.payload
        task_type = task.task_type

        try:
            if task_type == "browser_action":
                output = await self._browser_action(payload, task.workflow_run_id)
            elif task_type == "terminal_command":
                output = await self._terminal_exec(payload, task.workflow_run_id)
            elif task_type == "api_call":
                output = await self._api_call(payload)
            else:
                output = {"success": False, "error": f"Unknown task_type: {task_type}"}

            await self.emit_event("execution.completed", {
                "task_type": task_type,
                "success": output.get("success", False),
            })

            return AgentResult(
                task_id=task.task_id,
                agent_id=self.agent_id,
                status="success" if output.get("success") else "failed",
                output=output,
                confidence=0.9,
                execution_time_ms=int((time.monotonic() - t0) * 1000),
                rollback_data=output.get("rollback_data"),
            )

        except Exception as e:
            return AgentResult(
                task_id=task.task_id,
                agent_id=self.agent_id,
                status="failed",
                output={"error": str(e)},
                confidence=0.0,
                execution_time_ms=int((time.monotonic() - t0) * 1000),
            )

    async def _browser_action(self, payload: Dict, run_id: str) -> Dict:
        """Execute browser action via Browser Service"""
        session_id = payload.get("session_id") or await self._create_browser_session(run_id)
        action = payload.get("action", "screenshot")
        params = payload.get("params", {})

        if not self._browser_url:
            return {"success": False, "error": "Browser service not configured", "session_id": session_id}

        try:
            resp = await self._http.post(
                f"{self._browser_url}/sessions/{session_id}/action",
                json={"action": action, "params": params},
            )
            resp.raise_for_status()
            result = resp.json()

            return {
                "success": result.get("success", False),
                "session_id": session_id,
                "screenshot": result.get("screenshot_base64"),
                "dom_state": result.get("result"),
                "error": result.get("error"),
                "rollback_data": {"action": "browser_close", "session_id": session_id},
            }
        except Exception as e:
            return {"success": False, "error": str(e), "session_id": session_id}

    async def _terminal_exec(self, payload: Dict, run_id: str) -> Dict:
        """Execute terminal command in sandbox"""
        command = payload.get("command", "")
        env = payload.get("env", {})
        allow_network = payload.get("allow_network", False)

        if not self._browser_url:
            return {"success": False, "error": "Browser service not configured"}

        try:
            resp = await self._http.post(
                f"{self._browser_url}/sandbox/exec",
                json={
                    "command": command,
                    "env": env,
                    "timeout_seconds": SANDBOX_TIMEOUT,
                    "network": "enabled" if allow_network else "none",
                },
            )
            resp.raise_for_status()
            result = resp.json()

            return {
                "success": result.get("exit_code", 1) == 0,
                "stdout": result.get("stdout", ""),
                "stderr": result.get("stderr", ""),
                "exit_code": result.get("exit_code"),
                "rollback_data": payload.get("rollback_command"),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _api_call(self, payload: Dict) -> Dict:
        """Make HTTP API call"""
        method = payload.get("method", "GET").upper()
        url = payload.get("url", "")
        headers = payload.get("headers", {})
        body = payload.get("body")

        try:
            resp = await self._http.request(method, url, headers=headers, json=body)
            return {
                "success": resp.is_success,
                "status_code": resp.status_code,
                "body": resp.text[:10000],
                "headers": dict(resp.headers),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _create_browser_session(self, run_id: str) -> str:
        """Create new browser session"""
        if not self._browser_url:
            return ""

        resp = await self._http.post(
            f"{self._browser_url}/sessions",
            json={"run_id": run_id, "browser": "chromium"},
        )
        resp.raise_for_status()
        return resp.json().get("session_id", "")