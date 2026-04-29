# Codebase Structure

**Analysis Date:** 2026-04-27

## Directory Layout

```
[project-root]/
├── frontend/                # Vite + TypeScript Vanilla SPA
│   ├── index.html           # HTML entry point
│   ├── vite.config.ts       # Vite config (proxy /api, /uploads to :3001)
│   ├── tsconfig.json
│   ├── package.json
│   ├── public/images/       # Static assets served as /images/*
│   └── src/
│       ├── main.ts          # App bootstrap (router + feature init)
│       ├── router/index.ts  # Route map (public + admin)
│       ├── pages/           # HTML template renderers (per-page)
│       ├── components/      # Reusable UI components
│       ├── features/        # Runtime behavior wiring
│       ├── data/            # API client functions + data layer
│       ├── types/           # TypeScript type definitions
│       ├── config/          # Site config, theme definitions
│       ├── utils/           # Pure utility functions
│       └── styles/          # CSS files (organized by concern)
├── backend/                 # Elysia.js + Bun + SQLite + Drizzle
│   ├── package.json
│   ├── tsconfig.json
│   ├── ecosystem.config.js  # PM2 process config (production)
│   ├── start.sh             # Production start script
│   ├── data/                # SQLite DB files (not committed)
│   ├── uploads/images/      # Uploaded images (not committed)
│   └── src/
│       ├── index.ts         # Server entry (listen on configured port)
│       ├── app.ts           # Elysia app assembly (CORS, routes, static)
│       ├── routes/          # HTTP route handlers (public + admin)
│       ├── services/        # Business logic (one file per domain)
│       ├── db/              # Drizzle schema, migrations, SQLite client
│       ├── auth/            # JWT signing + admin user management
│       ├── config/          # Environment variable config
│       ├── scripts/         # CLI scripts (seed, migrate, import)
│       ├── types/           # Shared backend type definitions
│       └── __tests__/       # API integration tests
├── docs/                    # Project documentation
│   ├── ai-workflow/         # AI collaboration docs (MEMORY, ARCHITECTURE, STOP_HOOKS)
│   ├── blueprint.md         # Project technical blueprint
│   └── content-spec.md      # Content format specification
├── deploy/                  # Deployment configs, nginx, runbooks
├── plans/                   # Archived implementation plans
├── CLAUDE.md                # Claude Code project instructions
└── PROJECT_STRUCTURE.zh-CN.md  # Chinese-language structure overview
```

## Directory Purposes

**`frontend/src/pages/`:**
- Purpose: One file per page route. Each exports a function that returns an HTML string (no framework).
- Contains: `home.ts`, `post-detail.ts`, `posts.ts`, `about.ts`, `friends.ts`, `archive.ts`, `tags.ts`, `tag-detail.ts`, `admin.ts`, `admin-login.ts`, `not-found.ts`
- Key pattern: Each page function receives parameters (e.g., `renderHomePage()`, `renderPostDetail(post)`) and returns assembled HTML.

**`frontend/src/features/`:**
- Purpose: Runtime behavior wiring. Mounts event listeners, handles DOM interactions, manages state for each page/module.
- Contains: `admin.ts` (admin entry dispatcher), `public-runtime.ts` (public pages entry), and `admin/` subdirectory with per-module files (`dashboard.ts`, `login.ts`, `posts.ts`, `friends.ts`, `site-settings.ts`, `content-settings.ts`, `media.ts`, `shared.ts`, `avatar-crop.ts`).
- Pattern: `setupAdmin[Module]()` functions registered via `window.__appFeatures`.

**`frontend/src/data/`:**
- Purpose: All API communication + client-side data orchestration.
- Key file: `api.ts` (~550 lines) -- all fetch calls, auth token management (localStorage `shino.admin.token`), request/response handling.
- Supporting files: `posts.ts`, `about.ts`, `friends.ts`, `profile-card.ts`, `site-config.ts`, `platform-presets.ts`.

**`frontend/src/components/`:**
- Purpose: Reusable UI component functions that return HTML strings.
- Contains: `post-list.ts`, `profile-card.ts`.
- Pattern: Pure functions, no side effects, called by page renderers.

**`backend/src/routes/`:**
- Purpose: HTTP route definitions for Elysia.js. Thin handlers that delegate to services.
- Contains: `public.ts` (health, posts, search, friend-links, about, profile-card), `admin.ts` (20 endpoints for admin CRUD), `helpers.ts` (auth middleware, JSON parsing, validation).
- Pattern: Route groups registered in `app.ts` via `app.group('/api', ...)` and `app.group('/api/admin', ...)`.

**`backend/src/services/`:**
- Purpose: Business logic layer. All database access and domain logic lives here.
- Contains: `posts.ts` (~741 lines, largest file), `about.ts`, `friends.ts`, `profile.ts`, `site-config.ts`, `media.ts`, `search.ts`, `markdown.ts`.
- Pattern: One service file per domain entity. Services receive DatabaseContext, return typed results.

**`backend/src/db/`:**
- Purpose: Database schema definition, migration runner, SQLite client.
- Contains: `schema.ts` (Drizzle ORM table definitions), `migrate.ts` (raw SQL migrations + FTS5 full-text search setup), `client.ts` (SQLite connection), `search-index.ts` (FTS5 search helper).

**`backend/src/scripts/`:**
- Purpose: CLI scripts invoked via `bun run <script>`.
- Contains: `seed.ts` (database seeding), `migrate.ts` (migration runner), `migrate-about-structured.ts`, `import-from-frontend.ts`, `render-posts-html.ts`.

## Key File Locations

**Entry Points:**
- `frontend/src/main.ts` -- SPA bootstrap
- `frontend/index.html` -- HTML shell
- `backend/src/index.ts` -- HTTP server start
- `backend/src/app.ts` -- Elysia app composition

**Configuration:**
- `frontend/vite.config.ts` -- Vite + dev proxy
- `frontend/tsconfig.json`
- `backend/tsconfig.json`
- `backend/src/config/env.ts` -- Environment variables (port, JWT secret, db path, upload dir)
- `backend/ecosystem.config.js` -- PM2 process manager config

**Database:**
- `backend/data/blog.sqlite` -- SQLite database file (gitignored)
- `backend/src/db/schema.ts` -- Drizzle ORM schema (source of truth for table structure)

**Deployment:**
- `deploy/nginx/` -- Nginx reverse proxy configs
- `deploy/scripts/` -- Deployment automation scripts

## Naming Conventions

**Files and directories:** kebab-case (`post-detail.ts`, `site-settings.ts`, `ai-workflow/`).

**Functions:** camelCase (`renderHomePage`, `setupAdminDashboard`, `fetchPosts`).

**Types/interfaces:** PascalCase (`AdminModuleRoute`, `Post`, `FriendLink`).

**CSS classes:** `admin-*` prefix for admin UI; BEM-like naming for public components (`post-card__title`, `search-modal__overlay`).

**Backend routes:** `/api/` prefix for public, `/api/admin/` for admin.

**Backend services:** One file per domain entity, named after the entity (`posts.ts`, `friends.ts`).

## Where to Add New Code

**New public page:**
- Page template: `frontend/src/pages/<page-name>.ts`
- Runtime wiring: `frontend/src/features/public-runtime.ts` (or new file in `features/`)
- Styles: `frontend/src/styles/pages/<page-name>.css`
- Route registration: `frontend/src/router/index.ts`
- API data functions: `frontend/src/data/<resource>.ts` + `frontend/src/data/api.ts`

**New admin module/feature:**
- Feature wiring: `frontend/src/features/admin/<module-name>.ts`
- Registration: import and call `setupAdmin<Module>()` in `frontend/src/features/admin.ts`

**New component:**
- Implementation: `frontend/src/components/<component-name>.ts`
- Styles: `frontend/src/styles/components/<component-name>.css`

**New API endpoint (public):**
- Service logic: `backend/src/services/<resource>.ts`
- Route handler: `backend/src/routes/public.ts`
- Type definitions: `backend/src/types/api.ts`

**New API endpoint (admin):**
- Service logic: `backend/src/services/<resource>.ts`
- Route handler: `backend/src/routes/admin.ts`
- Auth enforcement via `helpers.ts` middleware.

**New database table:**
- Schema: `backend/src/db/schema.ts` (Drizzle table definition)
- Migration: `backend/src/db/migrate.ts` (raw SQL migration)
- Seed data: `backend/src/scripts/seed.ts`

## Special Directories

**`backend/data/`:**
- Purpose: SQLite database files and WAL/journal.
- Generated: Yes (by SQLite at runtime).
- Committed: No (gitignored).

**`backend/uploads/`:**
- Purpose: User-uploaded images served via `/uploads/images/*`.
- Generated: Yes (by admin media upload).
- Committed: No (gitignored).

**`frontend/dist/` and `backend/dist/`:**
- Purpose: Build output.
- Generated: Yes (by `bun run build`).
- Committed: No (gitignored).

---

*Structure analysis: 2026-04-27*
