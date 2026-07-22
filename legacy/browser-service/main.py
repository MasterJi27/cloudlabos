"""CloudLabOS Browser Service - Playwright browser pool"""

import asyncio
import base64
import os
import subprocess
import uuid
import time
from typing import Dict, Optional

import structlog
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()

app = FastAPI(title="CloudLabOS Browser Service")

# Internal API key for service-to-service auth
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")


class SessionStore:
    def __init__(self):
        self._sessions: Dict[str, Dict] = {}
        self._playwright = None

    async def startup(self):
        self._playwright = await async_playwright().start()

    async def shutdown(self):
        for session in self._sessions.values():
            await session["browser"].close()
        if self._playwright:
            await self._playwright.stop()

    async def create_session(self, run_id: str, browser_type: str = "chromium") -> str:
        session_id = str(uuid.uuid4())
        pw_browser = getattr(self._playwright, browser_type)

        browser = await pw_browser.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        )
        page = await context.new_page()

        self._sessions[session_id] = {
            "browser": browser,
            "context": context,
            "page": page,
            "run_id": run_id,
            "created_at": time.time(),
        }
        logger.info("session.created", session_id=session_id, run_id=run_id)
        return session_id

    def get_page(self, session_id: str) -> Optional[Page]:
        return self._sessions.get(session_id, {}).get("page")

    async def close_session(self, session_id: str):
        session = self._sessions.pop(session_id, None)
        if session:
            await session["browser"].close()
            logger.info("session.closed", session_id=session_id)


store = SessionStore()


@app.on_event("startup")
async def startup():
    await store.startup()
    asyncio.create_task(_reap_expired_sessions())


@app.on_event("shutdown")
async def shutdown():
    await store.shutdown()


class CreateSessionRequest(BaseModel):
    run_id: str
    browser: str = "chromium"


class ActionRequest(BaseModel):
    action: str
    params: Dict = {}


class SandboxExecRequest(BaseModel):
    command: str
    env: Dict[str, str] = {}
    timeout_seconds: int = 30
    network: str = "none"


async def verify_internal_auth(request: Request):
    """Verify internal service-to-service authentication"""
    if not INTERNAL_API_KEY:
        return  # No key configured - skip auth (dev mode)
    auth_header = request.headers.get("X-Internal-API-Key", "")
    if auth_header != INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid internal API key")


@app.post("/sessions")
async def create_session(req: CreateSessionRequest, request: Request):
    await verify_internal_auth(request)
    sid = await store.create_session(req.run_id, req.browser)
    return {"session_id": sid}


@app.post("/sessions/{session_id}/action")
async def perform_action(session_id: str, req: ActionRequest, request: Request):
    await verify_internal_auth(request)
    page = store.get_page(session_id)
    if not page:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        result = await _dispatch_action(page, req.action, req.params)
        screenshot = await page.screenshot(type="jpeg", quality=75)
        return {
            "success": True,
            "screenshot_base64": base64.b64encode(screenshot).decode(),
            "result": result,
        }
    except Exception as e:
        return {"success": False, "error": str(e), "screenshot_base64": None}


async def _dispatch_action(page: Page, action: str, params: Dict):
    if action == "navigate":
        resp = await page.goto(params.get("url", "about:blank"), wait_until="domcontentloaded", timeout=30000)
        return {"url": page.url, "status": resp.status if resp else None}

    elif action == "click":
        selector = params.get("selector") or f"text={params.get('text', '')}"
        await page.click(selector, timeout=10000)
        return {"clicked": selector}

    elif action == "type":
        await page.fill(params["selector"], params["text"])
        return {"typed": params["text"]}

    elif action == "screenshot":
        data = await page.screenshot(type="jpeg", quality=80)
        return {"screenshot_base64": base64.b64encode(data).decode()}

    elif action == "scroll":
        await page.evaluate(f"window.scrollBy({params.get('x', 0)}, {params.get('y', 500)})")
        return {"scrolled": True}

    elif action == "wait":
        await page.wait_for_selector(params["selector"], timeout=params.get("timeout_ms", 5000))
        return {"found": params["selector"]}

    elif action == "evaluate":
        result = await page.evaluate(params["expression"])
        return {"result": result}

    else:
        return {"error": f"Unknown action: {action}"}


@app.delete("/sessions/{session_id}")
async def close_session(session_id: str, request: Request):
    await verify_internal_auth(request)
    await store.close_session(session_id)
    return {"closed": True}


@app.post("/sandbox/exec")
async def sandbox_exec(req: SandboxExecRequest, request: Request):
    """Execute a command in a sandboxed subprocess"""
    await verify_internal_auth(request)

    # Dangerous command patterns
    DANGEROUS_PATTERNS = [
        r"rm\s+-rf\s+/",
        r"mkfs\.",
        r"dd\s+if=",
        r":()\s*\{\s*:\|:&\s*\};",
        r"chmod\s+-R\s+777\s+/",
    ]
    import re
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, req.command):
            raise HTTPException(status_code=400, detail="Dangerous command rejected")

    env = {**os.environ, **req.env}

    try:
        proc = await asyncio.create_subprocess_shell(
            req.command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=req.timeout_seconds
        )
        return {
            "exit_code": proc.returncode,
            "stdout": stdout.decode("utf-8", errors="replace")[:50000],
            "stderr": stderr.decode("utf-8", errors="replace")[:50000],
        }
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        return {"exit_code": -1, "stdout": "", "stderr": "Command timed out"}
    except Exception as e:
        return {"exit_code": -1, "stdout": "", "stderr": str(e)}


@app.get("/health")
async def health():
    return {"status": "healthy", "sessions": len(store._sessions)}


@app.get("/ready")
async def ready():
    if store._playwright and store._playwright.is_connected():
        return {"status": "ready"}
    return {"status": "not ready"}


@app.get("/metrics")
async def metrics():
    from fastapi.responses import Response
    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest, Counter, Gauge

    sessions_total = Counter("cloudlabos_browser_sessions_total", "Total browser sessions created")
    actions_total = Counter("cloudlabos_browser_actions_total", "Total browser actions performed", ["action"])
    active_sessions = Gauge("cloudlabos_browser_active_sessions", "Currently active browser sessions")
    sandbox_execs = Counter("cloudlabos_browser_sandbox_execs_total", "Total sandbox commands executed")

    active_sessions.set(len(store._sessions))

    return Response(
        content=generate_latest().decode("utf-8"),
        media_type=CONTENT_TYPE_LATEST,
    )


async def _reap_expired_sessions():
    """Close sessions idle for > 30 minutes"""
    while True:
        await asyncio.sleep(60)
        now = time.time()
        expired = [sid for sid, s in store._sessions.items() if now - s["created_at"] > 1800]
        for sid in expired:
            await store.close_session(sid)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)