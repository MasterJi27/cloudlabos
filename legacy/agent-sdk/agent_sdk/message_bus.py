"""Redis Streams Message Bus for inter-agent communication"""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any, Callable, Dict, Optional

import redis.asyncio as aioredis
import structlog

logger = structlog.get_logger()


class RedisStreamBus:
    """
    Message bus backed by Redis Streams.
    Each agent type has its own stream with consumer groups.
    """

    def __init__(self, redis_url: str, consumer_name: Optional[str] = None):
        self._redis_url = redis_url
        self._consumer = consumer_name or f"consumer-{uuid.uuid4().hex[:8]}"
        self._redis: Optional[aioredis.Redis] = None
        self._subscribers: Dict[str, Callable] = {}
        self._running = False

    async def connect(self):
        """Establish connection to Redis"""
        self._redis = await aioredis.from_url(
            self._redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_keepalive=True,
            protocol=2,
        )
        logger.info("message_bus.connected", consumer=self._consumer)

    async def disconnect(self):
        """Close Redis connection"""
        self._running = False
        if self._redis:
            await self._redis.aclose()
        logger.info("message_bus.disconnected")

    async def publish(self, stream: str, message: Dict[str, Any]) -> str:
        """Publish a message to a stream"""
        payload = json.dumps(message)
        entry_id = await self._redis.xadd(
            stream,
            {"data": payload},
            maxlen=50000,  # Trim to bound memory
            approximate=True,
        )
        logger.debug("message.published", stream=stream, entry_id=entry_id)
        return entry_id

    async def subscribe(self, stream: str, handler: Callable, group: str = "workers"):
        """
        Subscribe to a stream via consumer group.
        Creates group if it doesn't exist.
        """
        try:
            await self._redis.xgroup_create(stream, group, id="0", mkstream=True)
        except aioredis.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise

        self._subscribers[stream] = handler
        asyncio.create_task(self._consume_loop(stream, group))
        logger.info("message_bus.subscribed", stream=stream, group=group)

    async def _consume_loop(self, stream: str, group: str):
        """Main consumption loop for a stream"""
        self._running = True
        handler = self._subscribers[stream]

        while self._running:
            try:
                entries = await self._redis.xreadgroup(
                    group,
                    self._consumer,
                    {stream: ">"},  # Only new messages
                    count=10,
                    block=2000,
                )

                if not entries:
                    continue

                for _stream, messages in entries:
                    for entry_id, fields in messages:
                        try:
                            payload = json.loads(fields["data"])
                            await handler(payload)
                            await self._redis.xack(stream, group, entry_id)
                        except json.JSONDecodeError as e:
                            logger.error(
                                "message_bus.parse_error",
                                stream=stream,
                                entry_id=entry_id,
                                error=str(e),
                            )
                        except Exception as e:
                            logger.error(
                                "message_bus.handler_error",
                                stream=stream,
                                entry_id=entry_id,
                                error=str(e),
                            )

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(
                    "message_bus.consume_error",
                    stream=stream,
                    error=str(e),
                )
                await asyncio.sleep(1)

    async def get_stream_messages(
        self, stream: str, count: int = 100
    ) -> list[Dict[str, Any]]:
        """Read recent messages from a stream"""
        messages = await self._redis.xrange(stream, count=count)
        return [
            {"id": msg_id, "data": json.loads(fields["data"])}
            for msg_id, fields in messages
        ]

    async def create_consumer_group(
        self, stream: str, group: str, start_id: str = "0"
    ):
        """Create a new consumer group on a stream"""
        try:
            await self._redis.xgroup_create(stream, group, start_id, mkstream=True)
        except aioredis.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise
        logger.info("consumer_group.created", stream=stream, group=group)