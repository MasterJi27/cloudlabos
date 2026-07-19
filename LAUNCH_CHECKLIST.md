# CloudLabOS launch checklist

CloudLabOS is designed to run as an authenticated, multi-service system. Complete every item below before exposing it to the internet or onboarding customers.

## Required configuration

- Generate unique production values for `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`, and `GRAFANA_PASSWORD`. Do not reuse `.env.example` values.
- Set `ENVIRONMENT=production`; the API gateway will refuse to start with missing or short JWT/encryption secrets.
- Set `CORS_ORIGINS` to your exact HTTPS dashboard origin. Do not use a wildcard origin with credentials.
- Keep `NEXT_PUBLIC_DEMO_MODE=false`. Demo fallbacks are deliberately opt-in and must never ship in a customer-facing build.
- Store provider keys in a managed secret store and inject them at deployment time. Do not commit `.env` files.

## Edge and infrastructure

- Terminate TLS at a managed load balancer or Traefik with real certificates; redirect HTTP to HTTPS and enable HSTS.
- Put PostgreSQL, Redis, Qdrant, Prometheus, Grafana, and internal service ports on private networks. Only the public dashboard/API entrypoint should be internet reachable.
- Configure managed backups and a restore exercise for PostgreSQL and Qdrant. Set retention and test recovery before launch.
- Configure liveness/readiness probes, resource limits, autoscaling, and centralized structured-log retention.

## Product safety

- Keep the SSO endpoints disabled until a verified SAML or OIDC adapter is implemented; do not accept identity claims directly from a browser request.
- Define workspace roles, approval thresholds, browser allowlists, command allowlists, and provider spending limits before enabling autonomous execution.
- Review every workflow definition and require approvals for external side effects (deployments, terminal mutation, purchases, data exports, and outbound messages).
- Wire Stripe checkout and signed webhook verification before accepting payments; the current billing surface should remain internal until then.

## Release gate

- Run `python -m pytest apps/api-gateway/tests apps/workflow-engine/tests -q` from the project virtual environment.
- Run `npm run type-check` and `npm run build` in `apps/web`.
- Exercise a real workflow in staging: create -> publish -> run -> approve/reject -> cancel -> inspect logs and artifacts.
- Perform a least-privilege review with a non-admin account and verify it cannot view or operate another workspace.
