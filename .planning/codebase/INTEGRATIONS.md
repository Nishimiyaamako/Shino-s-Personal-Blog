# External Integrations

**Analysis Date:** 2026-04-27

## APIs & External Services

**No external API integrations detected.**

This project is fully self-contained. It does not call any third-party HTTP APIs (no Stripe, Supabase, AWS, Firebase, Sentry, Datadog, etc.). All content and data is managed locally through the admin panel and served directly.

The only outbound network requests the frontend makes are to the backend API at either the same origin (production) or the Vite dev proxy target (development), configured via `VITE_API_BASE_URL` and `VITE_DEV_API_PROXY_TARGET` in `frontend/.env`.

## Data Storage

**Databases:**
- SQLite (local file-based) via Bun's built-in `bun:sqlite` module
  - Client: `bun:sqlite` + Drizzle ORM (`drizzle-orm/bun-sqlite`)
  - Connection: `DATABASE_PATH` env var (default: `backend/data/blog.sqlite`)
  - Production path: `/opt/shino-blog/data/blog.sqlite`
  - ORM schema defined at `backend/src/db/schema.ts`
  - Migrations run at startup via `backend/src/db/migrate.ts` (idempotent CREATE TABLE IF NOT EXISTS)
  - FTS5 virtual table for full-text search at `backend/src/db/search-index.ts`
  - WAL journal mode enabled

**File Storage:**
- Local filesystem only
  - Upload directory: `UPLOADS_ROOT` env var (default: `backend/uploads/images`), production: `/opt/shino-blog/uploads/images`
  - Uploaded images stored as files on disk, metadata tracked in `media_assets` SQLite table
  - File uploads handled at `backend/src/services/media.ts`
  - Static file serving via Bun's `Bun.file()` at `backend/src/app.ts` (`GET /uploads/images/:fileName`)
  - Frontend build artifacts: `frontend/dist/` served as static files by Nginx (deployment) or Vite dev server (development)

**Caching:**
- None (no Redis, Memcached, or in-memory cache layer)
- Nginx provides static asset caching in production via `expires 30d` and `Cache-Control: immutable` headers for hashed assets (`deploy/nginx/` templates)

## Authentication & Identity

**Auth Provider:**
- Custom username/password authentication (no external identity provider)
  - Implementation: `backend/src/auth/admin.ts` - password hashing via `Bun.password.hash()` / `Bun.password.verify()`
  - JWT signing/verification via `jose` library at `backend/src/auth/jwt.ts` (alg: HS256)
  - JWT config: `ADMIN_JWT_SECRET` and `ADMIN_JWT_EXPIRES_HOURS` env vars
  - Token stored in browser `localStorage` under key `shino.admin.token` at `frontend/src/data/api.ts`
  - Bearer token header used for all admin API requests
  - Admin user auto-created on startup via `ensureDefaultAdminUser()` if no user exists

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, or similar error tracking service)

**Logs:**
- Console-based logging (`console.info`, `console.error`) in backend at `backend/src/index.ts`, `backend/src/services/search.ts`
- PM2 handles log file output in production:
  - Combined log: `/opt/shino-blog/logs/combined.log`
  - Stdout: `/opt/shino-blog/logs/out.log`
  - Stderr: `/opt/shino-blog/logs/error.log`
- PM2 config at `backend/ecosystem.config.js` (prod) and `backend/ecosystem.config.local.cjs` (local dev)

## CI/CD & Deployment

**Hosting:**
- Self-hosted on a Linux server managed via 1Panel (open-source server management panel)
- Nginx as reverse proxy with SSL termination (templates at `deploy/nginx/`)
- Two deployment topologies supported:
  - Single-domain: one server block serving both SPA and `/api` proxy (`deploy/nginx/1panel-single-domain-template.conf`)
  - Dual-domain: separate domains for blog and admin (template at `deploy/nginx/1panel-dual-domain-template.conf`, deprecated in favor of single-domain)
- Backend runs as PM2-managed process (`shino-blog-backend`)
- Frontend deployed as static files mounted at `/opt/shino-blog/frontend-dist`

**CI Pipeline:**
- None automated. Local verification via shell scripts:
  - `deploy/scripts/local-verify.sh` - Local end-to-end verification
  - `deploy/scripts/online-smoke.sh` - Production smoke testing
  - `deploy/scripts/build-frontend-dist.sh` - Build and package frontend
  - `deploy/scripts/check-backend-prod-env.sh` - Production env safety checks
- Manual deployment follow checklist at `deploy/post-release-checklist.md`

**Release Artifacts:**
- Frontend dist tarballs stored in `deploy/artifacts/` (latest symlink at `frontend-dist-latest.tar.gz`)

## Environment Configuration

**Required env vars (backend):**
- `NODE_ENV` - Runtime environment (`development` or `production`)
- `PORT` - Server port
- `DATABASE_PATH` - SQLite database file path
- `UPLOADS_ROOT` - Upload directory path
- `ADMIN_USERNAME` - Admin login username
- `ADMIN_PASSWORD` - Admin login password
- `ADMIN_JWT_SECRET` - JWT signing secret
- `ADMIN_JWT_EXPIRES_HOURS` - JWT token expiry in hours

**Required env vars (frontend):**
- `VITE_DEV_API_PROXY_TARGET` - Backend URL for Vite dev proxy (development only)
- `VITE_API_BASE_URL` - Optional absolute API base URL for production (empty = same-origin)

**Secrets location:**
- Backend: `backend/.env` file (not committed, listed in `backend/.gitignore`)
- Production: `/opt/shino-blog/env/backend.env`
- Template files: `backend/.env.example`, `frontend/.env.example`

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Infrastructure Dependencies at Runtime

The backend has the following runtime dependencies on external processes or services (beyond the local filesystem):

| Dependency | Purpose | Required |
|------------|---------|----------|
| Local filesystem (rw) | SQLite database, upload storage, logs | Yes |
| Bun runtime | Application execution | Yes |
| PM2 (production only) | Process management, auto-restart, log rotation | Production |

---

*Integration audit: 2026-04-27*
