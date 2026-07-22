"""CloudLabOS Agent Service - Hosts all 8 AI agents"""

import os
import time
import asyncio
from typing import Dict, Any

from dotenv import load_dotenv
load_dotenv()

import asyncpg
import redis.asyncio as aioredis
import structlog
from agent_sdk import (
    RedisStreamBus,
    OpenRouterClient,
    MemoryClient,
    AgentType,
)

# Import agents
from agents.orchestrator import OrchestratorAgent
from agents.vision import VisionAgent
from agents.security import SecurityAgent
from agents.planner import PlannerAgent
from agents.execution import ExecutionAgent
from agents.validation import ValidationAgent

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()

# Health server state
_health_db: asyncpg.Pool = None
_health_bus: RedisStreamBus = None
_agents: Dict[str, Any] = {}
_agent_start_times: Dict[str, float] = {}


class AgentService:
    """Manages all CloudLabOS agents"""

    def __init__(self):
        self.agents: Dict[str, Any] = {}
        self.bus = None
        self.db = None
        self.llm = None

    async def initialize(self):
        """Initialize all dependencies"""
        global _health_db, _health_bus

        # Redis
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        self.bus = RedisStreamBus(redis_url)
        await self.bus.connect()
        _health_bus = self.bus

        # Database
        db_url = os.environ.get("DATABASE_URL", "postgresql://cloudlabos:@localhost:5432/cloudlabos")
        self.db = await asyncpg.create_pool(db_url)
        _health_db = self.db

        # LLM Client
        openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
        self.llm = OpenRouterClient(api_key=openrouter_key)

        # Memory client (workspace will be set per-request)
        qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")
        workspace_id = os.environ.get("DEFAULT_WORKSPACE_ID", "default")
        self.memory = MemoryClient(qdrant_url, self.db, self.llm, workspace_id)
        await self.memory.ensure_collection()

        logger.info("agent_service.initialized")

    async def start_agents(self):
        """Start all 8 agents"""
        global _agents
        browser_url = os.environ.get("BROWSER_SERVICE_URL", "http://localhost:8004")

        # Create all agents
        self.agents = {
            "orchestrator": OrchestratorAgent(
                agent_id="orchestrator-1",
                message_bus=self.bus,
                memory_client=self.memory,
                llm_client=self.llm,
                config={},
            ),
            "vision": VisionAgent(
                agent_id="vision-1",
                message_bus=self.bus,
                memory_client=self.memory,
                llm_client=self.llm,
                config={},
            ),
            "security": SecurityAgent(
                agent_id="security-1",
                message_bus=self.bus,
                memory_client=self.memory,
                llm_client=self.llm,
                config={"approval_threshold": 0.7},
            ),
            "planner": PlannerAgent(
                agent_id="planner-1",
                message_bus=self.bus,
                memory_client=self.memory,
                llm_client=self.llm,
                config={},
            ),
            "execution": ExecutionAgent(
                agent_id="execution-1",
                message_bus=self.bus,
                memory_client=self.memory,
                llm_client=self.llm,
                config={"browser_service_url": browser_url},
            ),
            "validation": ValidationAgent(
                agent_id="validation-1",
                message_bus=self.bus,
                memory_client=self.memory,
                llm_client=self.llm,
                config={},
            ),
        }
        _agents = self.agents

        # Record start times for uptime tracking
        now = time.time()
        for agent_type in self.agents:
            _agent_start_times[agent_type] = now

        # Initialize Redis metrics for each agent
        for agent_type in self.agents:
            redis_key = f"agent:stats:{agent_type}"
            if _health_bus and hasattr(_health_bus, '_redis') and _health_bus._redis:
                try:
                    await _health_bus._redis.hset(redis_key, mapping={
                        "status": "active",
                        "tasks_total": "0",
                        "tasks_success": "0",
                        "tasks_failed": "0",
                        "avg_latency": "0s",
                        "current_task": "Idle",
                        "memory_usage": "0MB",
                        "uptime": "0m",
                        "started_at": str(int(now)),
                    })
                except Exception:
                    pass

        # Start all agents
        tasks = [agent.start() for agent in self.agents.values()]
        await asyncio.gather(*tasks)

        logger.info("agents.started", count=len(self.agents))

    async def run(self):
        """Main entry point"""
        await self.initialize()
        await self.start_agents()

        # Keep running
        try:
            while True:
                await asyncio.sleep(3600)
        except asyncio.CancelledError:
            logger.info("agent_service.stopping")
        finally:
            await self.cleanup()

    async def cleanup(self):
        """Cleanup resources"""
        for agent in self.agents.values():
            await agent.stop()
        await self.db.close()
        await self.bus.disconnect()
        await self.llm.close()


async def health_server():
    """Simple HTTP health server on port 8001"""
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    import uvicorn

    health_app = FastAPI()

    @health_app.get("/health")
    async def health():
        return {"status": "healthy", "agents": list(_agents.keys())}

    @health_app.get("/ready")
    async def ready():
        try:
            if _health_db:
                await _health_db.fetchval("SELECT 1")
            return {"status": "ready"}
        except Exception as e:
            return JSONResponse(status_code=503, content={"status": "not ready", "error": str(e)})

    @health_app.get("/metrics")
    async def metrics():
        from prometheus_client import CONTENT_TYPE_LATEST, generate_latest, Counter, Gauge
        import time as _time

        tasks_total = Counter("cloudlabos_agent_tasks_total", "Total agent tasks", ["agent_type"])
        tasks_success = Counter("cloudlabos_agent_tasks_success", "Successful agent tasks", ["agent_type"])
        tasks_failed = Counter("cloudlabos_agent_tasks_failed", "Failed agent tasks", ["agent_type"])
        agents_active = Gauge("cloudlabos_agents_active", "Number of active agents")

        agents_active.set(len(_agents))

        for agent_type, agent in _agents.items():
            if hasattr(agent, '_metrics'):
                m = agent._metrics
                tasks_total.labels(agent_type=agent_type).inc(m.get("tasks_total", 0))
                tasks_success.labels(agent_type=agent_type).inc(m.get("tasks_success", 0))
                tasks_failed.labels(agent_type=agent_type).inc(m.get("tasks_failed", 0))

        return JSONResponse(
            content=generate_latest().decode("utf-8"),
            media_type=CONTENT_TYPE_LATEST,
        )

    config = uvicorn.Config(health_app, host="0.0.0.0", port=8001, log_level="warning")
    server = uvicorn.Server(config)
    await server.serve()


async def main():
    service = AgentService()

    # Start health server and agents concurrently
    await service.initialize()

    # Start health server in background
    asyncio.create_task(health_server())

    await service.start_agents()

    # Keep running
    try:
        while True:
            await asyncio.sleep(3600)
    except asyncio.CancelledError:
        logger.info("agent_service.stopping")
    finally:
        await service.cleanup()


if __name__ == "__main__":
    asyncio.run(main())