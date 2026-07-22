"""Research tools — port of the legacy research-service adapters, exposed as
authenticated endpoints agents (and users) can call to pull in external context."""
import re
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.security import get_current_user
from app.config import settings
from app.models.user import User

router = APIRouter()

GITHUB_API = "https://api.github.com"


class GitHubRequest(BaseModel):
    repo: str  # "owner/name"


class UrlRequest(BaseModel):
    url: str


def _extract_commands(markdown: str) -> list[str]:
    """Pull fenced shell commands out of a README — useful research signal."""
    blocks = re.findall(r"```(?:bash|sh|shell|console)?\n(.*?)```", markdown, re.S)
    cmds: list[str] = []
    for b in blocks:
        for line in b.splitlines():
            line = line.strip().lstrip("$ ").strip()
            if line and not line.startswith("#"):
                cmds.append(line)
    return cmds[:50]


@router.post("/github")
async def github_readme(body: GitHubRequest, user: User = Depends(get_current_user)):
    if not re.match(r"^[\w.-]+/[\w.-]+$", body.repo):
        raise HTTPException(status_code=400, detail="repo must be in 'owner/name' form")
    headers = {"Accept": "application/vnd.github.raw+json"}
    token = settings.github_token if hasattr(settings, "github_token") else ""
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{GITHUB_API}/repos/{body.repo}/readme", headers=headers)
        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail="Repo or README not found")
        if resp.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"GitHub error: HTTP {resp.status_code}")
        content = resp.text[:16000]
        return {"repo": body.repo, "content": content, "commands": _extract_commands(content),
                "length": len(content)}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Fetch failed: {e}")


@router.post("/url")
async def fetch_url(body: UrlRequest, user: User = Depends(get_current_user)):
    if not body.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="url must start with http:// or https://")
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(body.url, headers={"User-Agent": "CloudLabOS-Research/1.0"})
        text = resp.text
        # Strip tags for a plain-text excerpt.
        stripped = re.sub(r"<script.*?</script>|<style.*?</style>", " ", text, flags=re.S | re.I)
        stripped = re.sub(r"<[^>]+>", " ", stripped)
        stripped = re.sub(r"\s+", " ", stripped).strip()
        title_m = re.search(r"<title[^>]*>(.*?)</title>", text, re.S | re.I)
        return {
            "url": body.url, "status": resp.status_code,
            "title": (title_m.group(1).strip() if title_m else None),
            "text": stripped[:8000], "length": len(stripped),
        }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Fetch failed: {e}")
