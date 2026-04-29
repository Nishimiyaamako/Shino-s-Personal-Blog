# Technology Stack

**Analysis Date:** 2026-04-27

## Languages

**Primary:**
- TypeScript 5.9 - Used for all backend and frontend source code, targeting ES2022 with ESNext modules and Bundler resolution

**Secondary:**
- Bash - Used in deployment scripts (`deploy/scripts/`) and `backend/start.sh`
- SQL - Raw SQL embedded in migration files for DDL and FTS5 setup

## Runtime

**Environment:**
- Bun (latest, via `@types/bun`) - Primary runtime, package manager, and test runner for both frontend and backend
- Lockfile: `bun.lock` present in both `backend/` and `frontend/`
- Node.js `fs`, `path`, `crypto`, `url` modules available via Bun compatibility layer

**Package Manager:**
- Bun - `bun install`, `bun run`, `bun --watch`, `bun build`
- Production scripts in ecosystem config reference `bun` interpreter directly: `/usr/bin/bun`

## Frameworks

**Core:**
- Elysia.js 1.4 - Backend HTTP framework (`backend/src/app.ts`). Handles routing, middleware, and request lifecycle
- Vite 7.2 - Frontend dev server, build tool, and proxy (`frontend/vite.config.ts`)
- Vanilla TypeScript SPA - No React/Vue/Svelte. Custom router (`frontend/src/router/index.ts`), manual DOM rendering, page modules in `frontend/src/pages/`

**Testing:**
- Bun Test - Built-in test runner. Tests found at `backend/src/__tests__/api.test.ts`
- No frontend test framework detected

**Build/Dev:**
- `bun build` - Backend bundling (`backend/dist/index.js`)
- `vite build` - Frontend bundling (`frontend/dist/`)
- `tsc --noEmit` - Type checking for both frontend and backend

## Key Dependencies

**Critical:**
- `drizzle-orm` 0.44 - Database ORM, schema definition in `backend/src/db/schema.ts`, query building in all services
- `jose` 6.1 - JWT signing and verification (HS256) at `backend/src/auth/jwt.ts`
- `marked` 17.0 - Markdown-to-HTML rendering in both frontend (`frontend/src/data/posts.ts`) and backend (`backend/src/services/markdown.ts`)
- `@elysiajs/cors` 1.4 - CORS middleware for backend at `backend/src/app.ts`
- `sanitize-html` 2.17 - HTML sanitization after markdown rendering at `backend/src/services/markdown.ts`
- `dompurify` 3.3 - Client-side HTML sanitization on frontend
- `gray-matter` 4.0 - Frontmatter parsing for Markdown content at backend
- `highlight.js` 11.11 - Code syntax highlighting in backend markdown rendering at `backend/src/services/markdown.ts`
- `marked-highlight` 2.2 - Bridge between marked and highlight.js

**Dev/Process:**
- `pm2` 6.0 - Production process manager with Bun interpreter. Configs at `backend/ecosystem.config.js` (prod) and `backend/ecosystem.config.local.cjs` (local)

**Frontend-only:**
- `@iconify/iconify` 3.1 - Icon library used for platform preset icons in profile card contacts at `frontend/src/data/platform-presets.ts`

## Configuration

**Environment:**
- Backend env: `backend/.env` (not committed), template at `backend/.env.example`
- Backend env variables:
  - `NODE_ENV` - `development` or `production`
  - `PORT` - Server port (default: `3001`)
  - `DATABASE_PATH` - SQLite file path (default: `backend/data/blog.sqlite`)
  - `UPLOADS_ROOT` - Upload files directory
  - `ADMIN_USERNAME` / `ADMIN_PASSWORD` - Admin credentials
  - `ADMIN_JWT_SECRET` / `ADMIN_JWT_EXPIRES_HOURS` - JWT config
- Frontend env: `.env` (not committed), template at `frontend/.env.example`
- Frontend env variables:
  - `VITE_DEV_API_PROXY_TARGET` - Backend URL for Vite dev proxy (default: `http://127.0.0.1:3001`)
  - `VITE_API_BASE_URL` - Optional absolute API base for production (empty = same-origin)
- Env config parsed at `backend/src/config/env.ts` and `frontend/vite.config.ts`

**Build:**
- Backend: `backend/tsconfig.json` - strict mode, ES2022 target, Bundler resolution, types: `["bun"]`
- Frontend: `frontend/tsconfig.json` - strict mode, ES2022 target, Bundler resolution, types: `["vite/client"]`
- Vite config at `frontend/vite.config.ts` - dev proxy for `/api` and `/uploads` to backend
- Backend build output: `backend/dist/`
- Frontend build output: `frontend/dist/`

**Linting/Formatting:**
- No ESLint, Prettier, or Biome configuration detected
- TypeScript `strict: true` enforces type safety at compile time

## Platform Requirements

**Development:**
- Bun runtime installed
- Local SQLite (zero-config, file-based)
- Ports: frontend dev on `5173`, backend on `3001`

**Production:**
- Deployment target: 1Panel-managed Linux server (see `deploy/1panel-backend-deploy.md`, `deploy/1panel-static-deploy.md`)
- Nginx reverse proxy handles SSL termination and routes `/api` and `/uploads` to backend
- PM2 runs backend as persistent service (`shino-blog-backend`)
- Frontend served as static files from `/opt/shino-blog/frontend-dist`
- SQLite database at `/opt/shino-blog/data/blog.sqlite`
- Uploads at `/opt/shino-blog/uploads/images`
- Backend env at `/opt/shino-blog/env/backend.env`

---

*Stack analysis: 2026-04-27*
