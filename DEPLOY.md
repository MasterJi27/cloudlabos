# Deploying CloudLabOS

Two services + one database:

| Piece | What it is | Needs |
|-------|-----------|-------|
| `apps/api` | FastAPI backend (Dockerfile included) | Postgres, secrets |
| `apps/web` | Next.js dashboard (Dockerfile included, `output: standalone`) | the API's public URL |
| Database | PostgreSQL | — |

---

## Before you deploy: generate a secret

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

The API **refuses to start** in production without a strong, non-placeholder
`CLOUDLABOS_SECRET_KEY`. This is deliberate: the repo is public, so any
committed/example key is effectively known to everyone.

---

## Option A — Azure (fits the Student pack)

Azure for Students gives $100 credit and no credit card requirement.

### 1. Database — Azure Database for PostgreSQL (Flexible Server)

Create a Burstable **B1ms** server. Then note the connection string; the app
needs the **asyncpg** driver prefix:

```
postgresql+asyncpg://USER:PASSWORD@YOURSERVER.postgres.database.azure.com:5432/postgres
```

Enable *"Allow public access from Azure services"* so your containers can reach it.

### 2. Backend — Azure Container Apps

```bash
az login
az group create --name cloudlabos --location eastus

az containerapp up \
  --name cloudlabos-api \
  --resource-group cloudlabos \
  --location eastus \
  --source apps/api \
  --ingress external \
  --target-port 8000
```

Then set the configuration:

```bash
az containerapp update --name cloudlabos-api --resource-group cloudlabos \
  --set-env-vars \
    CLOUDLABOS_ENVIRONMENT=production \
    CLOUDLABOS_DEBUG=false \
    CLOUDLABOS_SECRET_KEY="<the secret you generated>" \
    CLOUDLABOS_DATABASE_URL="postgresql+asyncpg://..." \
    CLOUDLABOS_CORS_ORIGINS='["https://<your-frontend-domain>"]' \
    CLOUDLABOS_OPENROUTER_API_KEY="<your OpenRouter key>"
```

Verify: `curl https://<api-url>/health` → `{"status":"healthy",...}`

> Tables are created automatically on first boot. No demo/admin account is
> seeded in production — register your own account through the UI.

### 3. Frontend — Azure Container Apps (or Vercel)

```bash
az containerapp up \
  --name cloudlabos-web \
  --resource-group cloudlabos \
  --source apps/web \
  --ingress external \
  --target-port 3000 \
  --env-vars NEXT_PUBLIC_API_URL="https://<your-api-url>"
```

`NEXT_PUBLIC_API_URL` is baked in at **build** time and is called from the
user's **browser** — it must be the API's public URL, not an internal hostname.

### 4. Close the loop

Set `CLOUDLABOS_CORS_ORIGINS` on the API to the frontend's real origin, then
redeploy the API. Open the frontend, register, and you're live.

---

## Option B — Vercel (frontend) + Azure/Render (backend)

Vercel's free tier is the smoothest host for Next.js:

- Import the repo, set **Root Directory** to `apps/web`
- Add env var `NEXT_PUBLIC_API_URL=https://<your-api-url>`
- Deploy the API separately (Azure Container Apps above, or Render/Fly.io)
- Add the Vercel domain to `CLOUDLABOS_CORS_ORIGINS`

---

## Also in the Student pack

- **Namecheap** — a free `.me` domain for a year; point it at either host.
- **GitHub Actions** — already available for CI/CD on this repo.

---

## Environment variable reference

**Backend** (`CLOUDLABOS_` prefix is mandatory — unprefixed vars are ignored):

| Variable | Required | Notes |
|---|---|---|
| `CLOUDLABOS_ENVIRONMENT` | yes | `production` for anything public |
| `CLOUDLABOS_SECRET_KEY` | yes | 32+ chars, random; startup fails otherwise |
| `CLOUDLABOS_DATABASE_URL` | yes | `postgresql+asyncpg://...` |
| `CLOUDLABOS_CORS_ORIGINS` | yes | JSON array of exact frontend origins |
| `CLOUDLABOS_OPENROUTER_API_KEY` | for AI | only key needed for agent chat |
| `CLOUDLABOS_DEBUG` | no | keep `false` in production |
| `CLOUDLABOS_GITHUB_TOKEN` | no | raises GitHub research rate limit |

**Frontend:**

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | public API URL, baked in at build time |

---

## Known limitations before real users

- **Schema changes**: tables are created with `create_all`. Alembic is wired up
  but has no migration versions yet, so altering a column later needs a
  migration written by hand.
- **Workflow execution is synchronous** — a run executes inside the HTTP
  request. Long workflows will hit request timeouts; a job queue is the fix.
- **Scheduled workflows need an external trigger.** There is no in-process
  scheduler. Call `POST /api/v1/workflows/schedules/run-due?workspace_id=...`
  on a timer (GitHub Actions cron, Azure Logic App, or `cron`).
- **Approvals and webhooks are in-memory** — they reset when the API restarts.
- **SSO and Stripe billing are intentionally disabled** (see LAUNCH_CHECKLIST.md).
