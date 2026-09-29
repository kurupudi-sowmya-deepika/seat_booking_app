# Deployment Guide

Production runbook for the Seat Booking App: Docker builds, environment
variables, migrations, and the MCP server. For feature docs and local dev
setup, see the root [`README.md`](README.md); for MCP tool details, see
[`mcp_server/README.md`](mcp_server/README.md).

## 1. Prerequisites

- Docker Engine + Docker Compose v2 (`docker compose version`)
- A copy of [`​.env.example`](.env.example) filled in as a real `.env` in the repo root (never commit it - it's git-ignored)

## 2. Environment variables

All services read the one root `.env` (see `.env.example`). Grouped reference:

| Group | Variables | Notes |
| --- | --- | --- |
| Database | `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME` | `docker-compose.yml` overrides `DB_HOST=postgres` for the `backend`/`mcp_server` containers - the `.env` value is used as-is for a local/bare-metal run. |
| Security | `JWT_SECRET`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` | Rotate `JWT_SECRET` per environment; rotating it invalidates all issued tokens. |
| Environment | `ENVIRONMENT` | `development` (default) or `production`. Only gates whether `backend/app/main.py` auto-adds `localhost` CORS origins - set `production` for any real deployment. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY` | Use `sk_live_*`/`whsec_*` in production, obtained from the Stripe dashboard. |
| Wallet demo mode | `DEMO_WALLET_MODE`, `DEMO_INITIAL_CREDIT_EMAIL`, `DEMO_INITIAL_CREDIT_AMOUNT` | `DEMO_WALLET_MODE` **must be `false`** outside local demos - when true it lets any logged-in user top up their own wallet with no real payment. |
| Entra ID (SSO) | `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_AUTHORITY`, `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID`, `VITE_ENTRA_REDIRECT_URI` | `ENTRA_TENANT_ID`/`ENTRA_CLIENT_ID` must be set for `POST /auth/login/entra` to work at all - it now cryptographically verifies the incoming Microsoft token against these and refuses (503) if unconfigured. |
| AI Chatbot | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL` | See `backend/app/chatbot/` docs in the codebase for model-choice notes. |
| Frontend/CORS | `FRONTEND_URL`, `VITE_API_URL` | `VITE_API_URL` is baked into the frontend at **build** time (Docker build-arg), not read at container start - see the frontend Dockerfile note. |
| MCP server | `MCP_TRANSPORT`, `MCP_HOST`, `MCP_PORT`, `MCP_ALLOW_DEFAULT_IDENTITY`, `SEAT_BOOKING_API_URL`, `SEAT_BOOKING_USER_EMAIL`, `SEAT_BOOKING_USER_PASSWORD`, `SEAT_BOOKING_AUTH_TOKEN`, `MCP_REQUEST_TIMEOUT` | See [`mcp_server/README.md`](mcp_server/README.md) for the full authentication model. Leave `MCP_ALLOW_DEFAULT_IDENTITY=false` in any shared environment. |

### Secrets rotation

This audit found real (non-placeholder) values already sitting in the local
`.env` on disk (never committed - `.gitignore` correctly excludes it) that
should be rotated before/while going to production, since anything that
touched a shared machine or was ever logged should be treated as exposed:

- `OPENROUTER_API_KEY` - generate a fresh key at https://openrouter.ai/settings/api-keys and revoke the old one.
- `DB_PASSWORD` - change the Postgres user's password and update `.env` to match.
- The seeded demo accounts (`admin@example.com` / `user@example.com`, weak passwords from `backend/scripts/seed.py`) - fine for a local dev database, but never run `seed.py` against a real production database, and change these passwords immediately if it ever was.

## 3. Build and run with Docker Compose

```bash
# from the repo root, with .env filled in
docker compose up --build
```

This builds and starts, in dependency order: `postgres` -> `backend` (runs
`alembic upgrade head` automatically via `backend/entrypoint.sh`, then starts
gunicorn) -> `frontend` (nginx serving the Vite build) -> `mcp_server`
(streamable-http, for external applications).

- Frontend: http://localhost:3000
- Backend API + docs: http://localhost:8000/docs, health check http://localhost:8000/health
- MCP server (streamable-http): http://localhost:8100/mcp

To re-run migrations manually (already automatic on every backend start):
```bash
docker compose exec backend alembic upgrade head
```

To seed sample data into a fresh database (development/demo only - never against production):
```bash
docker compose exec backend python scripts/seed.py
```

### Rebuilding after a frontend env change

Because Vite bakes `VITE_*` values into the build, changing one of them
requires rebuilding the frontend image, not just restarting the container:
```bash
docker compose build frontend && docker compose up -d frontend
```

### Rollback

Each service is a separate image; roll back by redeploying the previous image
tag for just the affected service (`docker compose up -d <service>` after
retagging/pulling the prior image). Database migrations are additive and
hand-written (see `backend/alembic/versions/`) - check the specific migration
before assuming a rollback is safe if a schema change shipped with it.

## 4. Running without Docker

See the root [`README.md`](README.md#-getting-started) for the local
(non-container) setup - useful for active development.

## 5. MCP server - connecting an external application

See [`mcp_server/README.md`](mcp_server/README.md) for the full tool list and
authentication model. Summary: run the `mcp_server` container (or
`MCP_TRANSPORT=streamable-http python -m mcp_server.server` directly), then
have the external application's MCP client connect to
`http://<host>:8100/mcp`, call `authenticate_employee(email, password)` to get
a real employee token, and pass that token on every subsequent tool call.
