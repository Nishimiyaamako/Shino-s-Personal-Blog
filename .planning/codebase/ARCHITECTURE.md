<!-- refreshed: 2026-04-27 -->
# Architecture

**Analysis Date:** 2026-04-27

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Frontend (Browser SPA)                              │
│  `frontend/src/main.ts`                                                      │
│  ┌────────────────────┬──────────────────────────┬─────────────────────────┐ │
│  │  Router            │  Pages (Templates)        │  Admin Panel            │ │
│  │  `router/index.ts` │  `pages/*.ts`            │  `features/admin/*.ts`  │ │
│  ├────────────────────┴──────────────────────────┼─────────────────────────┤ │
│  │  Data Layer                                    │  Components             │ │
│  │  `data/*.ts` (API calls, caching, view models) │  `components/*.ts`      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                          │
│  HTTP (fetch + Bearer JWT for admin)                                          │
│                                    │                                          │
│                                    ▼                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                          Backend (Elysia HTTP Server)                        │
│  `backend/src/app.ts` (app assembly)                                         │
│  ┌────────────────────────────────────────┬────────────────────────────────┐ │
│  │  Routes (HTTP handlers)                 │  Auth (JWT + user verification)│ │
│  │  `routes/public.ts` `routes/admin.ts`   │  `auth/jwt.ts` `auth/admin.ts` │ │
│  ├────────────────────────────────────────┴────────────────────────────────┤ │
│  │  Services (Business logic)                                                │ │
│  │  `services/posts.ts` `services/search.ts` `services/markdown.ts`          │ │
│  │  `services/about.ts` `services/friends.ts` `services/profile.ts`          │ │
│  │  `services/media.ts` `services/site-config.ts`                            │ │
│  ├──────────────────────────────────────────────────────────────────────────┤ │
│  │  Database (Drizzle ORM + bun:sqlite FTS5)                                 │ │
│  │  `db/client.ts` `db/schema.ts` `db/migrate.ts` `db/search-index.ts`      │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                          │
│                                    ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  SQLite (WAL mode)                Uploads filesystem                      │ │
│  │  `backend/data/blog.sqlite`       `backend/uploads/images/`               │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App Assembly | Creates Elysia app, wires CORS, routes, static file serving | `backend/src/app.ts` |
| Server Entry | Starts listening on configured port | `backend/src/index.ts` |
| Config/Env | Reads and normalizes environment variables with defaults | `backend/src/config/env.ts` |
| DB Client | Creates SQLite connection (WAL, foreign_keys), runs migrations, exposes drizzle instance | `backend/src/db/client.ts` |
| DB Schema | Defines all tables via drizzle-orm/sqlite-core | `backend/src/db/schema.ts` |
| DB Migrations | CREATE TABLE IF NOT EXISTS + ALTER TABLE post-migrations | `backend/src/db/migrate.ts` |
| FTS5 Search Index | Manages posts_search virtual table entries | `backend/src/db/search-index.ts` |
| Public Routes | All `/api/*` public endpoints (posts, featured, search, about, profile, friends, site-config, health) | `backend/src/routes/public.ts` |
| Admin Routes | All `/api/admin/*` authenticated endpoints (posts CRUD, media, friends CRUD, about, profile, site-config) | `backend/src/routes/admin.ts` |
| Route Helpers | JWT extraction, admin auth guard, JSON body parsing, error formatting | `backend/src/routes/helpers.ts` |
| Posts Service | Post CRUD, publish/unpublish, featured toggle, tag sync, search index sync, raw SQL queries | `backend/src/services/posts.ts` |
| Search Service | FTS5 full-text search with BM25 scoring, time-decay ranking, quality/authority boosting | `backend/src/services/search.ts` |
| Markdown Service | `marked` rendering with `highlight.js` + `sanitize-html` | `backend/src/services/markdown.ts` |
| About Service | Structured about page with hero, narrative sections, timeline events | `backend/src/services/about.ts` |
| Friends Service | Friend link CRUD, public/private listing | `backend/src/services/friends.ts` |
| Profile Service | Profile card with contacts management | `backend/src/services/profile.ts` |
| Media Service | Image upload, orphan detection, file system storage | `backend/src/services/media.ts` |
| Site Config Service | Site-wide configuration (title, footer, ICP records) | `backend/src/services/site-config.ts` |
| JWT Auth | Sign/verify HS256 tokens via `jose`, Bearer token extraction | `backend/src/auth/jwt.ts` |
| Admin Auth | Default admin seeding, password verification via Bun.password | `backend/src/auth/admin.ts` |
| API Types | Shared TypeScript interfaces for all API shapes | `backend/src/types/api.ts` |
| SPA Entry | App shell rendering, route switching, motion system, event delegation, hydration | `frontend/src/main.ts` |
| Router | Path matching, route record table, admin module resolution | `frontend/src/router/index.ts` |
| Pages | Pure render functions returning HTML strings | `frontend/src/pages/*.ts` |
| Components | Reusable rendering fragments (post list, profile card) | `frontend/src/components/*.ts` |
| Data Layer | API call wrappers, fingerprint change detection, local data transformations | `frontend/src/data/*.ts` |
| Features | Runtime behavior wiring (public hydration, admin dashboard/modules, login) | `frontend/src/features/*.ts` |
| Types | Frontend-specific domain types | `frontend/src/types/*.ts` |
| Config | Static site config and theme palette definitions | `frontend/src/config/*.ts` |
| Utils | DOM style helpers, date formatting, HTML escaping, tag color, theme normalization, search | `frontend/src/utils/*.ts` |

## Pattern Overview

**Overall:** Monorepo with two independent Bun workspaces: `backend/` (Elysia HTTP server) + `frontend/` (Vite SPA). Both share no code at runtime; communication is strictly HTTP-based with JSON payloads.

**Key Characteristics:**
- **Vanilla SPA frontend** -- No framework (React, Vue, Svelte). Manual DOM-based routing and rendering. Pages are pure functions returning HTML strings.
- **Service-layer backend** -- Routes are thin handlers that delegate to service functions. Services contain all business logic, raw SQL queries, and validation.
- **Raw SQL for queries** -- Despite using Drizzle ORM for schema definitions, most read queries use `context.sqlite.query(...)` with raw SQL strings rather than Drizzle query builders.
- **SQLite FTS5 search** -- Full-text search with BM25 scoring, wrapped with a multi-factor ranking system (text relevance, time decay, quality, authority).
- **Fingerprint-based cache busting** -- Frontend data layer detects remote data changes via content fingerprint comparison before re-rendering.
- **Single Elysia app** -- Both public and admin routes are plugins registered on the same Elysia instance. Admin routes use a `requireAdmin()` middleware-like pattern.

## Layers

**Frontend -- Pages Layer:**
- Purpose: Pure functions that accept `PageRenderContext` and return HTML strings. No side effects, no event listeners.
- Location: `frontend/src/pages/`
- Contains: `home.ts`, `posts.ts`, `post-detail.ts`, `tags.ts`, `tag-detail.ts`, `archive.ts`, `friends.ts`, `about.ts`, `admin-login.ts`, `admin.ts`, `not-found.ts`
- Depends on: Data layer (`data/*.ts`), Components (`components/*.ts`), Router types (`types/router.ts`)
- Used by: `main.ts` (via `resolveRoute().route.render()`)

**Frontend -- Features Layer:**
- Purpose: Runtime behavior -- event listeners, mutation observers, debounced inputs, async hydration, admin module lifecycle. Attaches to the DOM after page render, returns cleanup functions.
- Location: `frontend/src/features/`
- Contains: `admin.ts` (re-exports), `public-runtime.ts`, `admin/login.ts`, `admin/dashboard.ts`, `admin/posts.ts`, `admin/friends.ts`, `admin/media.ts`, `admin/site-settings.ts`, `admin/content-settings.ts`, `admin/shared.ts`, `admin/avatar-crop.ts`
- Depends on: Data layer (`data/api.ts`), Router (`router/index.ts`)
- Used by: `main.ts` (via `setupPageEnhancements()`)

**Frontend -- Data Layer:**
- Purpose: API call functions, data caching with fingerprint-based change detection, local data transformations (tag stats, archive timeline, theme stats), view model resolution.
- Location: `frontend/src/data/`
- Contains: `api.ts`, `posts.ts`, `about.ts`, `friends.ts`, `profile-card.ts`, `site-config.ts`, `platform-presets.ts`
- Depends on: Types (`types/*.ts`), Config (`config/site.ts`, `config/themes.ts`)
- Used by: Pages, Features, Components

**Backend -- Routes Layer:**
- Purpose: Thin HTTP handlers. Parse request params/body/query, call service functions, format responses and errors.
- Location: `backend/src/routes/`
- Contains: `public.ts`, `admin.ts`, `helpers.ts`
- Depends on: Services, Auth, DB context (passed via closure)
- Used by: `app.ts` (via `.use(createPublicRoutes(dbContext))`)

**Backend -- Services Layer:**
- Purpose: Business logic, validation, raw SQL queries, data transformation between DB rows and API types.
- Location: `backend/src/services/`
- Contains: `posts.ts`, `search.ts`, `markdown.ts`, `about.ts`, `friends.ts`, `profile.ts`, `media.ts`, `site-config.ts`
- Depends on: DB context (passed as parameter), DB schema, API types
- Used by: Routes layer only

**Backend -- Infrastructure Layer:**
- Purpose: Database connection, schema, migrations, JWT sign/verify, admin credential management.
- Location: `backend/src/db/`, `backend/src/auth/`, `backend/src/config/`
- Depends on: External packages (drizzle-orm, jose, bun:sqlite)
- Used by: Routes, Services, App assembly

## Data Flow

### Primary Request Path (Public -- read post)

1. Browser navigates to `/posts/:slug` -- `main.ts` resolves route via `resolveRoute()` (`frontend/src/router/index.ts:84`)
2. Route renders page HTML (may show stale local cache) via `renderPostDetailPage()` (`frontend/src/pages/post-detail.ts:7`)
3. Post-render hydration `setupPublicDataHydration()` fires (`frontend/src/features/public-runtime.ts`)
4. Fetch fresh post detail from `/api/posts/:slug` via `fetchPostDetail()` (`frontend/src/data/api.ts:132`)
5. Backend `GET /api/posts/:slug` handler calls `getPublishedPostBySlug()` (`backend/src/services/posts.ts:310`)
6. Service runs raw SQL query joining posts + tags, returns `ApiPostDetail` (`backend/src/types/api.ts:15`)
7. Response returned to frontend. `applyRemotePostDetail()` compares fingerprint, updates cache (`frontend/src/data/posts.ts:94`)
8. If fingerprint changed, `main.ts` re-renders the page with updated content.

### Admin Auth Flow

1. User navigates to `/admin/login` -- `renderAdminLoginPage()` renders login form (`frontend/src/pages/admin-login.ts`)
2. `setupAdminLogin()` attaches submit listener (`frontend/src/features/admin/login.ts:44`)
3. On submit, `adminLogin()` posts to `POST /api/admin/auth/login` (`frontend/src/data/api.ts:268`)
4. Backend handler parses JSON body, calls `verifyAdminCredentials()` (`backend/src/auth/admin.ts:34`)
5. If valid, `signAdminToken()` creates HS256 JWT via `jose` (`backend/src/auth/jwt.ts:15`)
6. Frontend stores token in `localStorage` key `shino.admin.token` (`frontend/src/data/api.ts:252`)
7. Navigate to `/admin/posts` -- `setupAdminDashboard()` checks token, initializes admin modules.

### Search Flow

1. User types in search modal (header trigger or keyboard shortcut)
2. Client-side local search via `searchPosts()` in `frontend/src/utils/search.ts` scans cached posts
3. If remote search enabled, `searchPosts()` from `frontend/src/data/api.ts:187` calls `GET /api/search?q=...`
4. Backend `searchPublishedPosts()` (`backend/src/services/search.ts:110`) queries FTS5 virtual table with BM25 scoring
5. Results scored by multi-factor: text relevance (50%), time decay (25%), quality (15%), authority (10%)
6. FTS5 `snippet()` function generates highlighted excerpts with `<mark>` tags
7. On FTS failure, falls back to SQLite LIKE queries with simplified scoring

**State Management:**
- Backend: Stateless HTTP. No in-memory session state. JWT tokens are self-contained.
- Frontend: Module-level mutable caches. `remotePublishedPostCache`, `remotePublishedPostFingerprint`, `remoteSiteConfigOverride` etc. in data layer files. No centralized store. Each data module manages its own cache.
- History-based navigation: `main.ts` uses `window.history` with custom `__appNavIndex` state key for SPA navigation. `popstate` listener drives re-rendering.

## Key Abstractions

**DatabaseContext:**
- Purpose: Wraps the SQLite `Database` instance and Drizzle ORM instance. Passed through closure to all routes and services.
- Examples: `backend/src/db/client.ts:7-10`
- Pattern: Factory function `createDatabaseContext()` creates connection; option to reuse singleton via `getDatabaseContext()`. Connection lifecycle managed by `closeDatabaseContext()`.

**PageRenderer:**
- Purpose: Type signature for all page rendering functions. Takes `PageRenderContext` (params + pathname), returns HTML string.
- Examples: `frontend/src/types/router.ts:8`
- Pattern: `type PageRenderer = (context: PageRenderContext) => string`

**Fingerprint Change Detection:**
- Purpose: Compare serialized content hashes to avoid unnecessary re-renders when remote data matches local cache.
- Examples: `frontend/src/data/posts.ts:382-397` (buildPostFingerprint), `frontend/src/data/site-config.ts:38-44`
- Pattern: Build a deterministic string from key fields. Compare current vs next fingerprint. Return boolean signaling change.

**requireAdmin Guard:**
- Purpose: Extracts Bearer token from request, verifies JWT, returns admin user or sets 401 status. Not true middleware (Elysia plugin), but a reusable async function called at the top of every admin route handler.
- Examples: `backend/src/routes/helpers.ts:31-60`
- Pattern: `const admin = await requireAdmin(request, set); if (!admin) return { error: 'Unauthorized' };`

## Entry Points

**Backend Server:**
- Location: `backend/src/index.ts`
- Triggers: `bun --watch src/index.ts` (dev), `bun src/index.ts` (prod)
- Responsibilities: Import config, call `createApp()`, start listening on `ENV.port` (default 3001)

**App Assembly:**
- Location: `backend/src/app.ts`
- Trigger: Called by `index.ts`
- Responsibilities: Create DB context, seed default admin, configure CORS, register public routes, register admin routes, expose static file serving for `/uploads/images/:fileName`

**Frontend SPA:**
- Location: `frontend/src/main.ts`
- Trigger: Browser loads `index.html` -> `<script type="module" src="/src/main.ts">`
- Responsibilities: Mount on `#app`, initialize history state, set up popstate listener, render initial route, wire global event delegation (link clicks, form submissions), manage motion/animation system, coordinate page enhancement lifecycle (cleanup old, setup new)

## Architectural Constraints

- **Threading:** Bun's built-in event loop. SQLite is synchronous (blocking). No worker threads used.
- **Global state:** Backend `dbContext` is a module-level singleton in `db/client.ts` (line 12: `let dbContext: DatabaseContext | null = null`). Frontend uses per-module mutable caches (e.g., `remotePublishedPostCache` in `data/posts.ts` line 17).
- **Circular imports:** Not detected. Both frontend and backend use top-down dependency graphs. Frontend data layer depends on types; pages depend on data; features depend on data and pages. Backend routes depend on services; services depend on db context.
- **No shared code between frontend/backend:** Types are duplicated independently. Frontend types in `frontend/src/types/content.ts`, `types/api.ts`, etc. mirror backend types in `backend/src/types/api.ts` but are independently maintained.
- **No database connection pooling:** SQLite single-connection model. One connection per `DatabaseContext`. Concurrent writes not expected.
- **No middleware framework:** Backend does not use Elysia's `derive`/`guard` patterns for auth. Admin auth is checked inline in every route handler via `requireAdmin()`.

## Anti-Patterns

### Monolithic main.ts

**What happens:** `frontend/src/main.ts` is 3,423 lines and combines SPA shell rendering, routing invocation, motion/animation system (stagger, side-pop, content-rhythm, scroll-triggered, route-enter transitions), header drawer, search modal, theme filtering, scroll-to-top, event delegation, history management, profile card, TOC rail, admin/non-admin branching, and page enhancement orchestration.
**Why it's wrong:** Single failure point. Hard to test individual concerns (motion, routing, hydration). Adding a new page-level animation requires understanding the entire 3,400-line file.
**Do this instead:** Extract motion system to `features/motion.ts`. Extract shell rendering (`renderNavigation`, `renderHeaderSearchTrigger`, etc.) to `components/shell.ts`. Keep `main.ts` as an orchestrator that composes extracted modules.

### Raw SQL in Drizzle Codebase

**What happens:** Despite having Drizzle ORM with full schema definitions, most service functions use `context.sqlite.query(rawSqlString)` with manual parameter binding and type casting (e.g., `as PostRow | null`). Only the `ensureDefaultAdminUser` and `verifyAdminCredentials` functions use the Drizzle query builder.
**Why it's wrong:** Schema changes require hunting down all raw SQL strings. Manual aliasing (`cover_image_url AS coverImageUrl`) is duplicated across 10+ query strings. Risk of query-schema drift.
**Do this instead:** Either commit to Drizzle query builder for type-safe queries, or remove Drizzle and use raw SQL consistently. The current hybrid approach compounds maintenance effort.

### Duplicate Type Definitions

**What happens:** API response types are defined independently in both `backend/src/types/api.ts` and `frontend/src/types/api.ts` with similar but not identical shapes.
**Why it's wrong:** Backend changes to API response shapes require manual sync with frontend types. No compile-time guarantee of compatibility.
**Do this instead:** Extract shared types to a `packages/shared-types/` workspace, or at minimum generate frontend types from backend OpenAPI/TypeScript declarations.

## Error Handling

**Strategy:** Backend throws `Error` instances for validation failures. Route handlers catch and convert to `{ error: string }` JSON responses with appropriate HTTP status codes (400 for validation, 401 for auth, 404 for not found). Frontend API layer checks HTTP status and extracts error message from JSON body.

**Patterns:**
- Backend validation: `assertPostInput()` throws descriptive Chinese error messages (`backend/src/services/posts.ts:92-118`)
- Route error formatting: `toErrorPayload()` converts `Error` to `{ error: string }` (`backend/src/routes/helpers.ts:62-68`)
- Admin auth guard: `requireAdmin()` sets `set.status = 401` and returns `null`; caller returns `{ error: 'Unauthorized' }`
- Frontend API error: `fetchJson()` throws on non-ok response with extracted error message (`frontend/src/data/api.ts:36-58`)
- Frontend FTS5 fallback: `searchPublishedPosts()` catches FTS errors and falls back to LIKE queries (`backend/src/services/search.ts:232-311`)

## Cross-Cutting Concerns

**Logging:** Backend uses `console.info` for server startup (`backend/src/index.ts:7`). Search service uses `console.error` for FTS failures (`backend/src/services/search.ts:234`). No structured logging or log levels.

**Validation:** Input validation is manual and inline. Posts have strict regex-based slug/date/tag validation. Slug uniqueness checked against DB. Admin login validates username/password non-empty. File upload validates filename against `SAFE_UPLOAD_FILE_REGEXP` (`backend/src/app.ts:11`).

**Authentication:** JWT-based (HS256 via `jose`). Token stored in `localStorage` under `shino.admin.token`. Backend reads from `Authorization: Bearer <token>` header. No refresh token mechanism. Token expiry configurable via `ADMIN_JWT_EXPIRES_HOURS` (default 24h). Admin credentials seeded from env vars on first run with auto-password-update on env var change.

---

*Architecture analysis: 2026-04-27*
