# CloudLabOS Enterprise

> Enterprise-grade autonomous AI workflow operating system

## Quick Start

For a production deployment, read [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) first. The default schema no longer creates an administrator account or sample workflows; register the first user through the application, then create the first workspace.

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start the full stack
docker compose up -d

# 3. Access the dashboard
# Frontend: http://localhost:3000
# API Gateway: http://localhost:8000
# Grafana: http://localhost:3001
# Prometheus: http://localhost:9090
# Qdrant: http://localhost:6333
```

## Architecture

### Backend Services
| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 8000 | REST API, Auth, WebSocket hub |
| Agent Service | 8001 | 8 AI agents orchestration |
| Workflow Engine | 8002 | DAG execution |
| Memory Service | 8003 | Vector + structured memory |
| Browser Service | 8004 | Playwright browser pool |
| Research Service | 8005 | External source adapters |

### AI Agents
1. **Orchestrator** - Central workflow coordinator
2. **Vision** - Screenshot and UI analysis
3. **Security** - Risk evaluation and approval gating
4. **Planner** - Execution DAG generation
5. **Execution** - Browser and terminal automation
6. **Validation** - Step completion verification
7. **Memory** - Vector storage operations
8. **Research** - External knowledge extraction

### Technology Stack
- **Frontend**: Next.js 15, React, TailwindCSS, Framer Motion, Zustand
- **Backend**: FastAPI, Python asyncio
- **AI**: OpenRouter (DeepSeek R1, Qwen Coder, Claude)
- **Database**: PostgreSQL, Redis, Qdrant
- **Browser**: Playwright
- **Monitoring**: Prometheus, Grafana, OpenTelemetry

## Project Structure

```
cloudlabos/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   ├── api-gateway/            # FastAPI gateway
│   ├── agent-service/         # Agent orchestration
│   ├── workflow-engine/        # DAG executor
│   ├── memory-service/         # Vector + SQL memory
│   ├── browser-service/       # Playwright pool
│   └── research-service/       # External sources
├── packages/
│   └── agent-sdk/              # Python SDK for agents
├── infrastructure/
│   ├── docker/                 # Dockerfiles
│   ├── kubernetes/             # K8s manifests
│   ├── terraform/              # IaC
│   └── monitoring/             # Prometheus, Grafana
└── docker-compose.yml          # Full local stack
```

## Environment Variables

```env
# Database
POSTGRES_PASSWORD=your_secure_password

# Redis
REDIS_PASSWORD=your_redis_password

# Security
ENCRYPTION_KEY=base64_32_byte_key
JWT_SECRET=base64_48_byte_secret

# AI
OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_KEY=sk-...

# Observability
GRAFANA_PASSWORD=admin123
```

## Development

```bash
# Run tests
make test

# Run linters
make lint

# View logs
make logs service=api-gateway

# Open container shell
make shell service=postgres
```

## License

Proprietary - CloudLabOS Enterprise
