# Legacy services (archived)

These directories are the project's **original multi-service architecture**. They
are **not used by the running application** and are kept here only for reference.

## What actually runs today

CloudLabOS now runs as **two apps**:

- `apps/api` — a single consolidated FastAPI backend (auth, workspaces, agents,
  workflows, memory, billing, webhooks, approvals, notifications, search,
  dashboard, audit, research). SQLite in dev, Postgres-ready.
- `apps/web` — the Next.js dashboard.

Start them directly:

```bash
# backend
cd apps/api && python -m uvicorn app.main:app --reload --port 8000
# frontend
cd apps/web && npm run dev
```

## Why these were archived

The services below were designed to run as independent processes wired together
over Redis Streams, each deployed separately (see the root `docker-compose.yml`,
which still describes this older topology). Nothing in `apps/api` imports them,
they require infrastructure that isn't provisioned in the dev setup, and keeping
them under `apps/` made it ambiguous which backend was real.

| Directory | Original role |
|-----------|---------------|
| `agent-service` | Hosted the 8 specialized agents over a message bus |
| `workflow-engine` | Standalone DAG executor |
| `memory-service` | Vector + structured memory service |
| `browser-service` | Playwright browser pool |
| `research-service` | External source adapters (GitHub, web) |
| `api-gateway` | Separate REST/auth/WebSocket gateway |
| `agent-sdk` | Shared Python SDK the services depended on |

## What was salvaged into `apps/api`

- The specialized agent **system prompts** now live in
  `apps/api/app/core/agent_presets.py` and are applied automatically when you
  create an agent of a given type.
- The research adapters (GitHub README fetch, URL fetch) were reimplemented as
  authenticated endpoints under `apps/api/app/api/v1/research.py`.

If you want to pursue the distributed architecture again, this code is the
starting point — but treat it as a separate track from the shipping app.
