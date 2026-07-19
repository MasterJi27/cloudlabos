"""CloudLabOS Research Service - External source adapters"""

import os
import re
import hashlib
from typing import Any, Dict, List, Optional

import httpx
import structlog
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()

app = FastAPI(title="CloudLabOS Research Service")

GITHUB_API = "https://api.github.com"


class GitHubAdapter:
    """GitHub README and code extraction"""

    def __init__(self, token: Optional[str] = None):
        headers = {"Accept": "application/vnd.github.v3+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._client = httpx.AsyncClient(headers=headers, timeout=30)

    async def get_readme(self, repo: str) -> Dict[str, Any]:
        """Fetch and parse GitHub repo README"""
        resp = await self._client.get(
            f"{GITHUB_API}/repos/{repo}/readme",
            headers={"Accept": "application/vnd.github.raw+json"},
        )
        if resp.status_code == 404:
            return {"content": "", "commands": [], "steps": []}
        resp.raise_for_status()
        content = resp.text[:8000]

        return {
            "content": content,
            "commands": self._extract_commands(content),
            "steps": self._extract_steps(content),
        }

    async def search_code(self, query: str, repo: Optional[str] = None) -> List[Dict]:
        """Search code in GitHub"""
        q = f"{query}{f' repo:{repo}' if repo else ''}"
        resp = await self._client.get(f"{GITHUB_API}/search/code", params={"q": q, "per_page": 5})
        if resp.status_code == 403:
            return []
        resp.raise_for_status()
        items = resp.json().get("items", [])
        return [{"path": i["path"], "url": i["html_url"]} for i in items]

    @staticmethod
    def _extract_commands(text: str) -> List[str]:
        pattern = r"```(?:bash|sh|shell)?\n(.*?)```"
        blocks = re.findall(pattern, text, re.DOTALL)
        commands = []
        for block in blocks:
            for line in block.strip().splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    commands.append(line)
        return commands[:20]

    @staticmethod
    def _extract_steps(text: str) -> List[str]:
        steps = []
        pattern = r"^\s*(?:\d+\.|[-*])\s+(.+)$"
        for line in text.splitlines():
            m = re.match(pattern, line)
            if m:
                steps.append(m.group(1).strip())
        return steps[:15]


class YouTubeAdapter:
    """YouTube video and curl command extraction from Dr. Abhishek channel"""

    YOUTUBE_API = "https://www.googleapis.com/youtube/v3"

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or os.environ.get("YOUTUBE_API_KEY")
        self._client = httpx.AsyncClient(timeout=30)

    async def get_channel_videos(self, channel_id: str, max_results: int = 10) -> List[Dict]:
        """Fetch recent videos from a YouTube channel"""
        if not self._api_key:
            return await self._get_videos_without_api(channel_id)

        resp = await self._client.get(
            f"{self.YOUTUBE_API}/search",
            params={
                "key": self._api_key,
                "channelId": channel_id,
                "part": "snippet",
                "order": "date",
                "maxResults": max_results,
                "type": "video",
            },
        )
        if resp.status_code != 200:
            return []
        items = resp.json().get("items", [])
        return [
            {
                "videoId": i["id"]["videoId"],
                "title": i["snippet"]["title"],
                "publishedAt": i["snippet"]["publishedAt"],
                "description": i["snippet"]["description"],
            }
            for i in items
        ]

    async def get_video_details(self, video_id: str) -> Dict[str, Any]:
        """Get video details including description with curl commands"""
        if not self._api_key:
            return {"description": "", "commands": [], "error": "No API key"}

        resp = await self._client.get(
            f"{self.YOUTUBE_API}/videos",
            params={"key": self._api_key, "part": "snippet", "id": video_id},
        )
        if resp.status_code != 200:
            return {"description": "", "commands": [], "steps": []}

        items = resp.json().get("items", [])
        if not items:
            return {"description": "", "commands": [], "steps": []}

        snippet = items[0]["snippet"]
        description = snippet.get("description", "")

        return {
            "title": snippet["title"],
            "description": description,
            "commands": self._extract_curl_commands(description),
            "steps": self._extract_steps(description),
        }

    async def get_latest_curl_commands(self, channel_id: str, max_videos: int = 5) -> List[Dict]:
        """Get curl commands from latest videos on the channel"""
        videos = await self.get_channel_videos(channel_id, max_videos)
        results = []

        for video in videos:
            video_id = video.get("videoId")
            details = await self.get_video_details(video_id)
            if details.get("commands"):
                results.append(
                    {
                        "video_id": video_id,
                        "title": video.get("title", ""),
                        "published_at": video.get("publishedAt", ""),
                        "commands": details["commands"],
                    }
                )

        return results

    @staticmethod
    def _extract_curl_commands(text: str) -> List[str]:
        """Extract curl commands from YouTube video description"""
        commands = []
        # Match curl commands - various patterns
        patterns = [
            r"curl\s+['\"][^\"']+['\"]",  # curl 'url'
            r"curl\s+[^\n&;]+",  # curl with flags
            r"(?:wget|curl)\s+(?:-[a-zA-Z]\s*)*['\"]?https?://[^\s'\"&;]+",  # wget or curl http://
        ]

        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            commands.extend(matches)

        # Clean up commands
        cleaned = []
        for cmd in commands:
            cmd = cmd.strip()
            # Remove trailing characters that might be part of markdown
            if cmd.endswith(("`", "'", '"')):
                cmd = cmd[:-1].strip()
            if cmd and len(cmd) > 10:
                cleaned.append(cmd)

        return cleaned[:15]

    async def _get_videos_without_api(self, channel_id: str) -> List[Dict]:
        """Fallback: scrape channel page if no API key"""
        try:
            # YouTube channel page HTML scraping fallback
            resp = await self._client.get(
                f"https://www.youtube.com/{channel_id}/videos",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if resp.status_code != 200:
                return []

            # Extract video IDs from HTML - basic parsing
            video_ids = re.findall(r'videoId":"([a-zA-Z0-9_-]{11})"', resp.text)
            return [{"videoId": vid, "title": "Video", "description": ""} for vid in video_ids[:10]]
        except Exception:
            return []


class ResearchRequest(BaseModel):
    source: str  # github|youtube|web|arxiv
    query: str
    repo: Optional[str] = None
    channel_id: Optional[str] = None  # For YouTube


@app.post("/research")
async def research(request: ResearchRequest):
    """Execute research query"""
    if request.source == "github":
        adapter = GitHubAdapter(os.environ.get("GITHUB_TOKEN"))
        if request.repo:
            result = await adapter.get_readme(request.repo)
        else:
            result = await adapter.search_code(request.query)
        return result

    elif request.source == "youtube":
        youtube = YouTubeAdapter(os.environ.get("YOUTUBE_API_KEY"))
        if request.channel_id:
            # Get curl commands from a specific channel
            result = await youtube.get_latest_curl_commands(request.channel_id)
            return {"videos": result, "source": "dr_abhishek_channel"}
        elif request.query:
            # Search videos by query (requires API key)
            videos = await youtube.get_channel_videos(request.query)
            return {"videos": videos, "source": "youtube_search"}
        else:
            return {"content": "YouTube research needs channel_id or query", "commands": [], "steps": []}

    elif request.source == "web":
        # Web research using httpx to fetch and parse web pages
        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                resp = await client.get(
                    request.query,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; CloudLabOS/1.0)"},
                )
                if resp.status_code != 200:
                    return {"content": f"HTTP {resp.status_code}", "commands": [], "steps": []}

                content = resp.text[:10000]

                # Extract useful information
                commands = []
                steps = []

                # Find code blocks
                code_blocks = re.findall(r"<code[^>]*>(.*?)</code>", content, re.DOTALL)
                for block in code_blocks[:10]:
                    cleaned = re.sub(r"<[^>]+>", "", block).strip()
                    if cleaned and len(cleaned) > 5:
                        commands.append(cleaned)

                # Find list items
                list_items = re.findall(r"<li[^>]*>(.*?)</li>", content, re.DOTALL)
                for item in list_items[:15]:
                    cleaned = re.sub(r"<[^>]+>", "", item).strip()
                    if cleaned and len(cleaned) > 5:
                        steps.append(cleaned)

                # Extract text content
                text = re.sub(r"<[^>]+>", " ", content)
                text = re.sub(r"\s+", " ", text).strip()[:5000]

                return {
                    "content": text,
                    "commands": commands[:20],
                    "steps": steps[:15],
                    "url": request.query,
                    "status_code": resp.status_code,
                }
        except Exception as e:
            return {"content": f"Web research error: {str(e)}", "commands": [], "steps": []}

    else:
        raise HTTPException(status_code=400, detail="Unknown source")


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/metrics")
async def metrics():
    from fastapi.responses import Response
    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest, Counter

    research_queries = Counter("cloudlabos_research_queries_total", "Total research queries", ["source"])
    research_errors = Counter("cloudlabos_research_errors_total", "Total research errors", ["source"])

    return Response(
        content=generate_latest().decode("utf-8"),
        media_type=CONTENT_TYPE_LATEST,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)