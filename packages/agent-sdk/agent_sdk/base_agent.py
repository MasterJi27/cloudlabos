"""CloudLabOS Agent SDK - Base Agent Class"""

from __future__ import annotations

import asyncio
import time
import uuid
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional

import structlog
from pydantic import BaseModel


class AgentType(str, Enum):
    """All available agent types in CloudLabOS"""
    ORCHESTRATOR = "orchestrator"
    VISION = "vision"
    RESEARCH = "research"
    PLANNER = "planner"
    EXECUTION = "execution"
    VALIDATION = "validation"
    MEMORY = "memory"
    SECURITY = "security"


class AgentTask(BaseModel):
    """Input schema for agent tasks"""
    task_id: str = ""
    workflow_run_id: str = ""
    task_type: str = ""
    payload: Dict[str, Any] = {}
    priority: int = 5
    timeout_seconds: int = 300
    retry_count: int = 0
    max_retries: int = 3
    parent_task_id: Optional[str] = None
    context_window: Optional[List[Dict]] = None

    def __init__(self, **data):
        if not data.get("task_id"):
            data["task_id"] = str(uuid.uuid4())
        super().__init__(**data)


class AgentResult(BaseModel):
    """Output schema for agent results"""
    task_id: str
    agent_id: str
    status: str  # success | failed | timeout | needs_approval
    output: Dict[str, Any] = {}
    confidence: float = 0.0
    execution_time_ms: int = 0
    needs_human_review: bool = False
    rollback_data: Optional[Dict[str, Any]] = None
    memory_items: Optional[List[Dict[str, Any]]] = None


class BaseAgent(ABC):
    """
    Abstract base class for all CloudLabOS agents.
    Each agent implements the process() method to define its behavior.
    """

    def __init__(
        self,
        agent_id: str,
        agent_type: AgentType,
        message_bus,
        memory_client,
        llm_client,
        config: Dict[str, Any],
    ):
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.message_bus = message_bus
        self.memory_client = memory_client
        self.llm_client = llm_client
        self.config = config
        self.logger = structlog.get_logger().bind(
            agent_id=agent_id, agent_type=agent_type.value
        )
        self._running = False

    @abstractmethod
    async def process(self, task: AgentTask) -> AgentResult:
        """
        Core task processing logic - implement in each agent subclass.
        """
        pass

    async def start(self):
        """Start the agent - subscribe to its task queue"""
        self._running = True
        stream_name = f"agent.{self.agent_type.value}.tasks"
        await self.message_bus.subscribe(stream_name, self._handle_task)
        self.logger.info("agent.started", stream=stream_name)

    async def stop(self):
        """Stop the agent"""
        self._running = False
        self.logger.info("agent.stopped")

    async def _handle_task(self, raw: dict):
        """Internal task handler with timeout and retry logic"""
        task = AgentTask(**raw)
        self.logger.info(
            "task.received",
            task_id=task.task_id,
            workflow_run_id=task.workflow_run_id,
        )

        try:
            result = await asyncio.wait_for(
                self.process(task),
                timeout=task.timeout_seconds
            )
            result.agent_id = self.agent_id
            result.task_id = task.task_id

            # Publish result
            await self.message_bus.publish("agent.results", result.model_dump())

            # Emit completion event
            await self.emit_event("task.completed", {
                "task_id": task.task_id,
                "status": result.status,
                "confidence": result.confidence,
            })

            self.logger.info(
                "task.completed",
                task_id=task.task_id,
                status=result.status,
                execution_time_ms=result.execution_time_ms,
            )

        except asyncio.TimeoutError:
            await self._handle_failure(task, "timeout")
        except Exception as e:
            self.logger.error(
                "task.error",
                task_id=task.task_id,
                error=str(e),
                exc_info=True,
            )
            if task.retry_count < task.max_retries:
                retry_task = task.model_copy(
                    update={"retry_count": task.retry_count + 1}
                )
                await self.message_bus.publish(
                    f"agent.{self.agent_type.value}.tasks",
                    retry_task.model_dump()
                )
                self.logger.info("task.requeued", task_id=task.task_id)
            else:
                await self._handle_failure(task, str(e))

    async def _handle_failure(self, task: AgentTask, reason: str):
        """Handle task failure"""
        await self.message_bus.publish("agent.failures", {
            "task_id": task.task_id,
            "agent_id": self.agent_id,
            "reason": reason,
            "workflow_run_id": task.workflow_run_id,
        })
        await self.emit_event("task.failed", {
            "task_id": task.task_id,
            "reason": reason,
        })

    async def recall(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Search memory for relevant context"""
        if self.memory_client:
            return await self.memory_client.similarity_search(
                query=query, k=k
            )
        return []

    async def remember(self, content: str, metadata: Dict[str, Any]):
        """Store information in memory"""
        if self.memory_client:
            await self.memory_client.upsert(
                content=content,
                metadata=metadata,
            )

    async def emit_event(self, event_type: str, payload: Dict[str, Any]):
        """Emit an event to the event stream"""
        event = {
            "event_type": event_type,
            "agent_id": self.agent_id,
            "agent_type": self.agent_type.value,
            **payload,
        }
        await self.message_bus.publish(f"events.{self.agent_id}", event)

    def __repr__(self):
        return f"<{self.__class__.__name__}(id={self.agent_id}, type={self.agent_type})>"