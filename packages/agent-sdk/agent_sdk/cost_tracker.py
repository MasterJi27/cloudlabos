"""CloudLabOS Cost Tracking - tracks LLM and compute usage for billing/analytics"""

import json
import os
import time
from typing import Optional

import redis.asyncio as aioredis


# Approximate cost per 1K tokens for common OpenRouter models (USD)
MODEL_COST_MAP = {
    "meta-llama/llama-3.1-8b-instruct": {"input": 0.00007, "output": 0.00028},
    "meta-llama/llama-3.2-11b-vision-instruct": {"input": 0.00008, "output": 0.00032},
    "google/gemma-2-9b-it": {"input": 0.00006, "output": 0.00024},
    "openai/gpt-4o": {"input": 0.005, "output": 0.015},
    "openai/gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "anthropic/claude-3.5-sonnet": {"input": 0.003, "output": 0.015},
}

DEFAULT_COST = {"input": 0.0001, "output": 0.0004}


class CostTracker:
    """Tracks usage costs in Redis for real-time billing dashboards."""

    def __init__(self, redis: aioredis.Redis):
        self._r = redis

    async def track_llm_call(
        self,
        workspace_id: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        agent_type: str = "",
        run_id: str = "",
    ):
        pricing = MODEL_COST_MAP.get(model, DEFAULT_COST)
        cost = (input_tokens / 1000) * pricing["input"] + (output_tokens / 1000) * pricing["output"]
        cost_cents = round(cost * 100, 2)

        now = time.time()
        day_key = f"cost:daily:{workspace_id}:{time.strftime('%Y-%m-%d')}"
        hour_key = f"cost:hourly:{workspace_id}:{time.strftime('%Y-%m-%d-%H')}"

        pipe = self._r.pipeline()
        pipe.hincrbyfloat(day_key, "total_cents", cost_cents)
        pipe.hincrby(day_key, "total_requests", 1)
        pipe.hincrbyfloat(day_key, f"model:{model}:cents", cost_cents)
        pipe.expire(day_key, 86400 * 90)

        pipe.hincrbyfloat(hour_key, "total_cents", cost_cents)
        pipe.hincrby(hour_key, "total_requests", 1)
        pipe.expire(hour_key, 86400 * 7)

        pipe.sadd(f"cost:models:{workspace_id}", model)
        pipe.lpush(
            f"cost:recent:{workspace_id}",
            json.dumps({
                "model": model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_cents": cost_cents,
                "agent_type": agent_type,
                "run_id": run_id,
                "timestamp": now,
            }),
        )
        pipe.ltrim(f"cost:recent:{workspace_id}", 0, 999)
        pipe.expire(f"cost:recent:{workspace_id}", 86400 * 30)
        await pipe.execute()

    async def get_daily_costs(self, workspace_id: str, days: int = 30) -> list:
        costs = []
        for i in range(days):
            day = time.strftime("%Y-%m-%d", time.gmtime(time.time() - i * 86400))
            data = await self._r.hgetall(f"cost:daily:{workspace_id}:{day}")
            if data:
                costs.append({
                    "date": day,
                    "total_cents": float(data.get("total_cents", 0)),
                    "total_requests": int(data.get("total_requests", 0)),
                })
        return costs

    async def get_total_costs(self, workspace_id: str) -> dict:
        total = 0.0
        requests = 0
        keys = await self._r.keys(f"cost:daily:{workspace_id}:*")
        for key in keys or []:
            data = await self._r.hgetall(key)
            total += float(data.get("total_cents", 0))
            requests += int(data.get("total_requests", 0))
        return {"total_cents": round(total, 2), "total_requests": requests}
