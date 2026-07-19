"""OpenRouter LLM Client for AI agent operations"""

from __future__ import annotations

import asyncio
import time
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx
import structlog
from pydantic import BaseModel

logger = structlog.get_logger()

# Model aliases - using free models from OpenRouter
MODELS = {
    "reasoning": "meta-llama/llama-3.1-8b-instruct:free",
    "code": "meta-llama/llama-3.1-8b-instruct:free",
    "vision": "meta-llama/llama-3.2-11b-vision-instruct:free",
    "fast": "google/gemma-2-9b-it:free",
    "embedding": "openai/text-embedding-3-small",
}


class Message(BaseModel):
    """Chat message format"""
    role: str
    content: Any  # str or list of content parts for vision

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for API calls"""
        return {"role": self.role, "content": self.content}


class LLMResponse(BaseModel):
    """LLM response format"""
    content: str
    model: str
    prompt_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0


class OpenRouterClient:
    """Async LLM client with retry logic and streaming support"""

    BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(
        self,
        api_key: str,
        default_model: str = "reasoning",
        timeout: int = 120,
        max_retries: int = 3,
    ):
        self._api_key = api_key
        self._default_model = MODELS.get(default_model, default_model)
        self._timeout = timeout
        self._max_retries = max_retries
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://cloudlabos.ai",
                "X-Title": "CloudLabOS Enterprise",
            },
            timeout=timeout,
        )

    async def chat(
        self,
        messages: List[Message],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        json_mode: bool = False,
        system: Optional[str] = None,
    ) -> LLMResponse:
        """Send a chat completion request"""
        resolved_model = MODELS.get(model or "", model) or self._default_model

        if system:
            messages = [Message(role="system", content=system)] + messages

        payload: Dict[str, Any] = {
            "model": resolved_model,
            "messages": [m.model_dump() for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        for attempt in range(self._max_retries):
            try:
                t0 = time.monotonic()
                resp = await self._client.post("/chat/completions", json=payload)
                resp.raise_for_status()
                data = resp.json()
                latency_ms = int((time.monotonic() - t0) * 1000)

                choice = data["choices"][0]
                usage = data.get("usage", {})

                return LLMResponse(
                    content=choice["message"]["content"],
                    model=data.get("model", resolved_model),
                    prompt_tokens=usage.get("prompt_tokens", 0),
                    output_tokens=usage.get("completion_tokens", 0),
                    latency_ms=latency_ms,
                )

            except httpx.HTTPStatusError as e:
                if e.response.status_code in (429, 502, 503) and attempt < self._max_retries - 1:
                    wait = 2 ** attempt
                    logger.warning(
                        "llm.retry",
                        attempt=attempt,
                        wait=wait,
                        status=e.response.status_code,
                    )
                    await asyncio.sleep(wait)
                else:
                    raise

            except httpx.TimeoutException:
                if attempt < self._max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise

    async def stream(
        self,
        messages: List[Message],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> AsyncIterator[str]:
        """Stream chat completion response"""
        resolved_model = MODELS.get(model or "", model) or self._default_model

        payload = {
            "model": resolved_model,
            "messages": [m.model_dump() for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        async with self._client.stream("POST", "/chat/completions", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    chunk = line[6:]
                    if chunk == "[DONE]":
                        break
                    import json as json_module
                    data = json_module.loads(chunk)
                    delta = data["choices"][0].get("delta", {})
                    if content := delta.get("content"):
                        yield content

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate text embeddings"""
        resp = await self._client.post(
            "/embeddings",
            json={"model": MODELS["embedding"], "input": texts},
        )
        resp.raise_for_status()
        data = resp.json()
        return [item["embedding"] for item in sorted(data["data"], key=lambda x: x["index"])]

    async def close(self):
        """Close the HTTP client"""
        await self._client.aclose()

    def __repr__(self):
        return f"<OpenRouterClient(default_model={self._default_model})>"


# For backwards compatibility - alias model_dump to to_dict
Message.model_dump = lambda self, **kwargs: self.to_dict()