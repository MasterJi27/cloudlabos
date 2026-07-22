"""CloudLabOS Connector Client - fetch credentials from the vault via the API gateway"""

import json
import os
from typing import Any, Dict, Optional

import httpx


class ConnectorClient:
    """Fetches connector credentials from the vault for use by agents and services."""

    def __init__(self, api_gateway_url: Optional[str] = None, api_key: Optional[str] = None):
        self._gateway = api_gateway_url or os.environ.get("API_GATEWAY_URL", "http://api-gateway:8000")
        self._api_key = api_key or os.environ.get("INTERNAL_API_KEY", "")

    async def get_credential(self, workspace_id: str, credential_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a decrypted credential for use by a service. Requires admin-level internal key."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self._gateway}/api/v1/workspaces/{workspace_id}/connectors/{credential_id}",
                headers={"Authorization": f"Bearer {self._api_key}"},
            )
            if resp.status_code == 200:
                return resp.json()
            return None

    async def list_credentials(self, workspace_id: str, provider: Optional[str] = None) -> list:
        """List available credentials for a workspace."""
        params = {}
        if provider:
            params["provider"] = provider
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self._gateway}/api/v1/workspaces/{workspace_id}/connectors",
                params=params,
                headers={"Authorization": f"Bearer {self._api_key}"},
            )
            if resp.status_code == 200:
                return resp.json()
            return []


class GitHubConnector:
    """GitHub API connector using vault-stored credentials."""

    def __init__(self, token: str):
        self._token = token
        self._client = httpx.AsyncClient(
            base_url="https://api.github.com",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "CloudLabOS/1.0",
            },
            timeout=30.0,
        )

    async def get_repo(self, owner: str, repo: str) -> dict:
        resp = await self._client.get(f"/repos/{owner}/{repo}")
        resp.raise_for_status()
        return resp.json()

    async def create_issue(self, owner: str, repo: str, title: str, body: str = "", labels: list = None) -> dict:
        payload = {"title": title, "body": body}
        if labels:
            payload["labels"] = labels
        resp = await self._client.post(f"/repos/{owner}/{repo}/issues", json=payload)
        resp.raise_for_status()
        return resp.json()

    async def list_pull_requests(self, owner: str, repo: str, state: str = "open") -> list:
        resp = await self._client.get(f"/repos/{owner}/{repo}/pulls", params={"state": state})
        resp.raise_for_status()
        return resp.json()

    async def close(self):
        await self._client.aclose()


class SlackConnector:
    """Slack API connector using vault-stored bot token."""

    def __init__(self, bot_token: str):
        self._token = bot_token
        self._client = httpx.AsyncClient(
            base_url="https://slack.com/api",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=30.0,
        )

    async def post_message(self, channel: str, text: str) -> dict:
        resp = await self._client.post("/chat.postMessage", json={"channel": channel, "text": text})
        resp.raise_for_status()
        return resp.json()

    async def close(self):
        await self._client.aclose()
