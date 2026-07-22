import os
import json as json_lib
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.agent import Agent, AgentTool, AgentSession, AgentStatus
from app.config import settings
from app.core.agent_presets import preset_for


def _estimate_tokens(text: str) -> int:
    """Rough token estimate (~4 chars/token) — good enough for usage rollups
    without pulling in a tokenizer dependency."""
    return max(1, len(text or "") // 4)


class AgentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_agents(self, workspace_id: str) -> list[Agent]:
        result = await self.db.execute(
            select(Agent).where(Agent.workspace_id == workspace_id).order_by(Agent.created_at.desc())
        )
        return result.scalars().all()

    async def get_agent(self, agent_id: str) -> Optional[Agent]:
        result = await self.db.execute(select(Agent).where(Agent.id == agent_id))
        return result.scalar_one_or_none()

    async def create_agent(self, workspace_id: str, created_by: str, data: dict) -> Agent:
        agent_type = data.get("agent_type", "general")
        # Fall back to the specialization's preset prompt when the caller didn't
        # supply one, so a new agent behaves like its type out of the box.
        system_prompt = data.get("system_prompt") or preset_for(agent_type)
        agent = Agent(
            name=data["name"],
            description=data.get("description"),
            agent_type=agent_type,
            model=data.get("model", "gpt-4o"),
            system_prompt=system_prompt,
            tags=data.get("tags", []),
            config=data.get("config", {}),
            workspace_id=workspace_id,
            created_by=created_by,
        )
        self.db.add(agent)
        await self.db.commit()
        await self.db.refresh(agent)
        return agent

    async def clone_agent(self, agent_id: str, created_by: str) -> Optional[Agent]:
        src = await self.get_agent(agent_id)
        if not src:
            return None
        clone = Agent(
            name=f"{src.name} (copy)",
            description=src.description,
            agent_type=src.agent_type,
            model=src.model,
            system_prompt=src.system_prompt,
            tags=list(src.tags or []),
            config=dict(src.config or {}),
            workspace_id=src.workspace_id,
            created_by=created_by,
        )
        self.db.add(clone)
        await self.db.flush()
        # Copy tools too, so a clone is a true duplicate.
        for t in await self._get_tools(src.id):
            self.db.add(AgentTool(
                agent_id=clone.id, name=t["name"], description=t.get("description"),
                tool_type=t.get("tool_type", "builtin"),
            ))
        await self.db.commit()
        await self.db.refresh(clone)
        return clone

    async def export_agent(self, agent_id: str) -> Optional[dict]:
        agent = await self.get_agent(agent_id)
        if not agent:
            return None
        tools = await self._get_tools(agent_id)
        return {
            "name": agent.name,
            "description": agent.description,
            "agent_type": agent.agent_type,
            "model": agent.model,
            "system_prompt": agent.system_prompt,
            "tags": list(agent.tags or []),
            "config": dict(agent.config or {}),
            "tools": [{"name": t["name"], "description": t.get("description"),
                       "tool_type": t.get("tool_type", "builtin")} for t in tools],
            "_cloudlabos_export": "agent/v1",
        }

    async def import_agent(self, workspace_id: str, created_by: str, data: dict) -> Agent:
        agent = await self.create_agent(workspace_id, created_by, {
            "name": data.get("name", "Imported Agent"),
            "description": data.get("description"),
            "agent_type": data.get("agent_type", "general"),
            "model": data.get("model", "gpt-4o"),
            "system_prompt": data.get("system_prompt"),
            "tags": data.get("tags", []),
            "config": data.get("config", {}),
        })
        for t in (data.get("tools") or []):
            if isinstance(t, dict) and t.get("name"):
                self.db.add(AgentTool(
                    agent_id=agent.id, name=t["name"], description=t.get("description"),
                    tool_type=t.get("tool_type", "builtin"),
                ))
        await self.db.commit()
        await self.db.refresh(agent)
        return agent

    async def update_agent(self, agent_id: str, data: dict) -> Optional[Agent]:
        agent = await self.get_agent(agent_id)
        if not agent:
            return None
        for key, val in data.items():
            if val is not None and hasattr(agent, key):
                if key == "status":
                    setattr(agent, key, AgentStatus(val))
                else:
                    setattr(agent, key, val)
        await self.db.commit()
        await self.db.refresh(agent)
        return agent

    async def delete_agent(self, agent_id: str) -> bool:
        agent = await self.get_agent(agent_id)
        if not agent:
            return False
        await self.db.delete(agent)
        await self.db.commit()
        return True

    async def add_tool(self, agent_id: str, data: dict) -> AgentTool:
        tool = AgentTool(
            agent_id=agent_id,
            name=data["name"],
            description=data.get("description"),
            tool_type=data.get("tool_type", "builtin"),
            source=data.get("source"),
            config=data.get("config", {}),
        )
        self.db.add(tool)
        await self.db.commit()
        await self.db.refresh(tool)
        return tool

    async def remove_tool(self, tool_id: str) -> bool:
        result = await self.db.execute(select(AgentTool).where(AgentTool.id == tool_id))
        tool = result.scalar_one_or_none()
        if not tool:
            return False
        await self.db.delete(tool)
        await self.db.commit()
        return True

    async def create_session(self, agent_id: str, user_id: str, thread_id: Optional[str] = None) -> AgentSession:
        session = AgentSession(agent_id=agent_id, user_id=user_id, thread_id=thread_id, meta={"messages": []})
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def _get_session(self, session_id: str, agent_id: str) -> Optional[AgentSession]:
        result = await self.db.execute(
            select(AgentSession).where(AgentSession.id == session_id, AgentSession.agent_id == agent_id)
        )
        return result.scalar_one_or_none()

    MAX_HISTORY_MESSAGES = 20  # cap context sent per turn so long chats don't blow past the model's token limit

    async def _call_llm(self, agent: Agent, messages: list[dict]) -> str:
        api_key = settings.openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")
        if not api_key:
            return f"[{agent.name}] No API key configured. Configure OPENROUTER_API_KEY in .env"

        model = getattr(agent, "config", {}).get("model", settings.default_model) or settings.default_model
        system_prompt = agent.system_prompt or f"You are {agent.name}, a {agent.agent_type} agent."

        try:
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{settings.openrouter_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "system", "content": system_prompt}] + messages,
                        "max_tokens": 1024,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
                return f"[{agent.name}] API error: HTTP {resp.status_code}"
        except Exception as e:
            return f"[{agent.name}] Error: {str(e)}"

    async def invoke_agent(self, agent_id: str, user_id: str, input_text: str,
                           session_id: Optional[str] = None) -> tuple[str, str, Optional[str]]:
        agent = await self.get_agent(agent_id)
        if not agent:
            raise ValueError("Agent not found")

        session = await self._get_session(session_id, agent_id) if session_id else None
        if not session:
            session = await self.create_session(agent_id, user_id)

        history = list((session.meta or {}).get("messages", []))
        history.append({"role": "user", "content": input_text})

        agent.tasks_total += 1
        await self.db.commit()

        output = await self._call_llm(agent, history[-self.MAX_HISTORY_MESSAGES:])

        history.append({"role": "assistant", "content": output})
        session.meta = {**(session.meta or {}), "messages": history[-self.MAX_HISTORY_MESSAGES:]}
        # Track approximate token usage for cost/usage rollups.
        agent.tokens_used = (agent.tokens_used or 0) + _estimate_tokens(input_text) + _estimate_tokens(output)
        await self.db.commit()

        return output, session.id, None

    async def clear_session(self, session_id: str, agent_id: str) -> bool:
        session = await self._get_session(session_id, agent_id)
        if not session:
            return False
        session.meta = {**(session.meta or {}), "messages": []}
        await self.db.commit()
        return True

    async def _get_tools(self, agent_id: str) -> list[dict]:
        result = await self.db.execute(
            select(AgentTool).where(AgentTool.agent_id == agent_id, AgentTool.enabled == True)
        )
        tools = result.scalars().all()
        return [{"id": t.id, "name": t.name, "description": t.description,
                 "tool_type": t.tool_type.value if hasattr(t.tool_type, 'value') else t.tool_type,
                 "enabled": t.enabled} for t in tools]

    async def get_sessions(self, agent_id: str) -> list[AgentSession]:
        result = await self.db.execute(
            select(AgentSession).where(AgentSession.agent_id == agent_id).order_by(AgentSession.created_at.desc()).limit(50)
        )
        return result.scalars().all()
