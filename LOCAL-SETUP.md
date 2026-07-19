# CloudLabOS Enterprise - Local Setup Guide

## Quick Start (5 minutes)

### 1. Install Docker Desktop
```powershell
# Run PowerShell as Administrator, then:
choco install docker-desktop -y
```
Or download from: https://www.docker.com/products/docker-desktop/

### 2. Clone and Setup
```bash
cd cloudlabos
cp .env.example .env
```

### 3. Get YouTube API Key
1. Go to https://console.cloud.google.com/
2. Create project → Enable YouTube Data API v3
3. Create Credentials → API Key
4. Find Dr. Abhishek channel ID: https://www.youtube.com/@drabhishek channels (or use channel ID from video URLs)

### 4. Configure .env
```env
YOUTUBE_API_KEY=your_api_key_here
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxx
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

### 5. Start CloudLabOS
```bash
docker-compose up -d
```

### 6. Access
- Dashboard: http://localhost:3000
- API: http://localhost:8000
- Traefik: http://localhost:8080

---

## YouTube Integration (Dr. Abhishek Channel)

### How it works
The Research Service fetches curl commands from your YouTube video descriptions:
```
POST /research
{
  "source": "youtube",
  "channel_id": "UCxxxxxxxxxxxxx"
}
```

Returns:
```json
{
  "videos": [
    {
      "video_id": "xxxxxxxxxxx",
      "title": "Video Title",
      "commands": ["curl -X POST https://...", "curl -s ..."],
    }
  ]
}
```

### Getting Your Channel ID
1. Go to your YouTube channel page
2. Right-click → View Page Source
3. Search for "channelId" or "externalId"
4. Or use: https://commentpicker.com/youtube-channel-id.php

---

## Services

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | Next.js Dashboard |
| API Gateway | 8000 | REST + WebSocket |
| Agent Service | 8001 | AI Agent Orchestration |
| Workflow Engine | 8002 | DAG Execution |
| Memory Service | 8003 | Vector + SQL Memory |
| Browser Service | 8004 | Playwright Browser |
| Research Service | 8005 | YouTube + GitHub |

---

## Troubleshooting

### Docker not starting?
- Enable WSL2: `wsl --install`
- Restart Docker Desktop

### Ports already in use?
```bash
docker-compose down
# Check: netstat -ano | findstr "8000"
```

### YouTube API not working?
- Verify API key has YouTube Data API enabled
- Check quota at: https://console.cloud.google.com/apis/dashboard

---

## Stop CloudLabOS
```bash
docker-compose down -v  # Remove volumes
```