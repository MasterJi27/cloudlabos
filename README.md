# CloudLabOS

> An AI workflow operating system — agents, workflows, memory, and approvals in one dashboard.

## Architecture

CloudLabOS runs as **two apps**:

| App | Stack | Port | Role |
|-----|-------|------|------|
| `apps/api` | FastAPI + SQLAlchemy (SQLite dev / Postgres prod) | 8000 | Consolidated backend: auth, workspaces, agents, workflows, memory, approvals, webhooks, billing, notifications, search, dashboard, audit, research |
| `apps/web` | Next.js 16 + React 19 + Tailwind + Zustand | 3000 | Dashboard UI |

> The original multi-service design (`agent-service`, `workflow-engine`,
> `memory-service`, `browser-service`, `research-service`, `api-gateway`) has been
> archived under [`legacy/`](legacy/README.md). It is not used by the running app.
> Its best pieces (the specialized agent prompts and the research adapters) were
> salvaged into `apps/api`.

## Quick start (local, no Docker)

```bash
# 1. Backend
cd apps/api
python -m venv .venv && . .venv/Scripts/activate   # or source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# 2. Frontend (new terminal)
cd apps/web
npm install
npm run dev

# 3. Open http://localhost:3000 and register an account
```

The dev backend uses SQLite (`apps/api/cloudlabos.db`, auto-created) and seeds a
demo admin (`admin@cloudlabos.ai` / `admin123`) plus sample data. Registering a
new account auto-provisions a personal workspace.

### AI configuration

Agent chat and agent-powered workflow steps call an LLM via OpenRouter. Set the
key in `apps/api/.env` (note the `CLOUDLABOS_` prefix that `pydantic-settings`
requires):

```env
CLOUDLABOS_OPENROUTER_API_KEY=sk-or-v1-...
```

Without a key, agents return a clear "no API key configured" message instead of
failing.

## Feature highlights

- **Agents** — specialized presets (security, analyst, coding, research, …),
  chat with conversation memory, clone / export / import, tags, starring, token
  usage tracking, per-agent tools.
- **Workflows** — a prebuilt template gallery, real step execution (agent steps
  invoke the LLM), clone / export / import, scheduling with cron, run history,
  retry, and cancel.
- **Memory** — collections, items, tags, semantic search, bulk import.
- **Search** — global command-palette search across agents, workflows, memory,
  and runs.
- **Governance** — human-in-the-loop approvals, an audit log, notifications,
  API keys (hashed), and revocable login sessions.

## Project structure

```
cloudlabos/
├── apps/
│   ├── api/        # FastAPI backend (the real backend)
│   └── web/        # Next.js dashboard
├── legacy/         # Archived original microservices (reference only)
├── infrastructure/ # Docker / k8s / terraform / monitoring
└── docker-compose.yml  # Describes the LEGACY multi-service topology
```

> Note: the root `docker-compose.yml` still describes the archived multi-service
> topology and is **not** the supported way to run the app today. Use the local
> quick start above.

## Production

See [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) before exposing this to the
internet. SSO and Stripe billing are intentionally left disabled until verified
adapters are implemented.

## License

Proprietary - CloudLabOS
