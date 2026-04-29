# Coding Conventions

**Analysis Date:** 2026-04-27

## Naming Patterns

**Files:**
- kebab-case throughout. `frontend/src/components/post-list.ts`, `frontend/src/features/admin/site-settings.ts`, `backend/src/services/site-config.ts`, `backend/src/auth/jwt.ts`

**Functions:**
- camelCase. `setupAdminDashboard()`, `listPublishedPosts()`, `renderMarkdownToSafeHtml()`, `fetchPublicPosts()`, `getBearerToken()`, `asPositiveInt()`

**Variables:**
- camelCase. `rootElement`, `runtimeStatusElement`, `testDatabasePath`, `normalizedTags`, `existingSlug`

**Types/Interfaces:**
- PascalCase. `AdminPost`, `AdminSiteConfig`, `AppContext`, `DatabaseContext`, `UpsertPostInput`, `PageRenderContext`, `RouteRecord`

**CSS classes:**
- kebab-case with `admin-` prefix for admin dashboard. `admin-panel`, `admin-form-grid`, `admin-unsaved-badge`, `admin-editor-panel`. Public-facing classes use plain kebab-case: `post-card`, `profile-card`, `markdown-content`

**DOM data attributes:**
- `data-role` for JavaScript targeting (e.g., `data-role="admin-logout"`, `data-role="admin-post-search"`)
- `data-*` for state (e.g., `data-admin-module="${activeModule}"`, `data-panel="posts"`)

## Code Style

**Formatting:**
- No semicolons. Consistent across both frontend and backend.
- Single quotes for strings.
- 2-space indentation.
- No eslint or prettier config files detected -- formatting is convention-driven.

**TypeScript:**
- `strict: true` in both `frontend/tsconfig.json` and `backend/tsconfig.json`
- Backend targets `ES2022` with `module: ESNext`, `moduleResolution: Bundler`, types: `["bun"]`
- Frontend targets `ES2022` with `lib: ["ES2022", "DOM", "DOM.Iterable"]`, types: `["vite/client"]`
- Arrow functions preferred for callbacks and short functions (e.g., `.map((item) => toAdminPost(item))`)
- async/await over raw Promises (e.g., `jwtVerify(token, getSecret())`, `fetchJson<T>(url, init)`)

**Comments:**
- Chinese error messages in validation (e.g., `throw new Error('title 不能为空')`)
- Descriptive inline comments in CSS (`/* Component Layer - Reusable UI Components */`)
- No JSDoc/TSDoc observed -- type annotations serve as documentation

## Import Organization

**Frontend import order** (observed in `frontend/src/data/api.ts`, `frontend/src/router/index.ts`, `frontend/src/features/admin/dashboard.ts`):
1. Types (from `types/`)
2. Config / constants
3. Data layer (`data/`)
4. Components (`components/`)
5. Features (`features/`)
6. Styles (in entry `main.ts` only)

**Backend import order** (observed in `backend/src/app.ts`, `backend/src/routes/admin.ts`):
1. Node built-in modules (`node:fs`, `node:path`)
2. External libraries (`elysia`, `jose`, `drizzle-orm/sqlite-core`)
3. Project config (`config/env.ts`)
4. Database layer (`db/`)
5. Auth layer (`auth/`)
6. Services (`services/`)
7. Route helpers (`routes/helpers.ts`)

**Path aliases:** None configured. All imports use relative paths (e.g., `../../data/api`, `../auth/jwt`, `../types/api`).

## Frontend Patterns

**Page rendering:**
- Pages render HTML strings via a `render[PageName](context)` function returning a string template literal. See `frontend/src/pages/admin.ts` (`renderAdminPage`), `frontend/src/pages/home.ts` (`renderHomePage`), etc.

**Feature wiring:**
- Features wire up DOM events after render via `setup[Feature](options)` functions. See `frontend/src/features/admin/dashboard.ts` (`setupAdminDashboard`), `frontend/src/features/admin/login.ts` (`setupAdminLogin`).
- Feature setup functions return a `(() => void) | null` teardown function for cleanup.

**API client:**
- All fetch wrappers live in `frontend/src/data/api.ts`. Typed request/response functions: `fetchPublicPosts()`, `adminCreatePost()`, `fetchSiteConfig()`, etc.
- Smaller data modules exist for specialized needs: `frontend/src/data/posts.ts`, `frontend/src/data/friends.ts`, `frontend/src/data/profile-card.ts`
- Token is stored in `localStorage` under key `shino.admin.token`
- Admin requests attach `Authorization: Bearer <token>` header via `getAdminAuthHeaders()`
- API base URL resolved from `import.meta.env.VITE_API_BASE_URL`

**Admin sub-modules:**
- Lazy-init pattern in `frontend/src/features/admin/dashboard.ts`: sub-modules are initialized on first access to the corresponding admin tab panel.
- Each sub-module is in its own file: `frontend/src/features/admin/posts.ts`, `frontend/src/features/admin/friends.ts`, `frontend/src/features/admin/media.ts`, `frontend/src/features/admin/site-settings.ts`, `frontend/src/features/admin/content-settings.ts` (covers about + profile)
- The dashboard feature aggregates all sub-modules and handles cross-cutting concerns (logout, dirty tracking, runtime status)

**Dirty tracking:**
- Uses a `Set<DirtyScope>` in `frontend/src/features/admin/dashboard.ts` to track which form panels have unsaved changes
- Registers a `beforeunload` guard to warn on page close
- Displays unsaved badge via `[data-role="admin-unsaved-status"]` element

**CSS organization:**
- Manifest file: `frontend/src/styles/global.css` -- imports in cascade order: tokens -> base -> layout -> components -> pages -> admin -> motion
- Component styles: `frontend/src/styles/components/*.css` (cards, buttons, forms, markdown, etc.)
- Page-specific styles: `frontend/src/styles/pages/*.css` (about, archive, friends)
- Admin styles: `frontend/src/styles/admin/admin-core.css`, `frontend/src/styles/admin/admin-forms.css`
- Design tokens: `frontend/src/styles/tokens.css` (CSS custom properties)
- Animations: `frontend/src/styles/motion.css`

**Form messaging:**
- Uses paired error/success elements: `[data-role="admin-post-error"]` and `[data-role="admin-post-success"]`, both `hidden` by default
- Messages displayed by toggling `hidden` attribute and setting `textContent`

## Backend Patterns

**Route organization:**
- Elysia routes grouped into `createPublicRoutes(context)` in `backend/src/routes/public.ts` and `createAdminRoutes(context)` in `backend/src/routes/admin.ts`
- Public routes mounted at `/api/...`, admin routes at `/api/admin/...`
- Each route function receives `DatabaseContext` as a parameter (Dependency Injection)

**Service layer:**
- Services in `backend/src/services/*.ts` receive `DatabaseContext` as their first argument
- Services contain all business logic and database queries; routes only handle HTTP concerns (request parsing, auth, response formatting)
- Service functions are pure synchronous functions (no async on database operations with `bun:sqlite`)

**Database access:**
- Schema defined with Drizzle ORM in `backend/src/db/schema.ts` (used only for type definitions and migrations)
- All runtime queries use raw SQL via `context.sqlite.query(...)`. Drizzle ORM is NOT used for query building
- JSON fields are stored as `TEXT` in SQLite, parsed/stringified in the service layer
- Boolean values stored as `INTEGER` (0/1), converted to boolean at service boundaries (e.g., `isFeatured: Boolean(row.isFeatured)`)
- Single-row configuration tables (`about_page`, `profile_card`, `site_config`) use `id = 1` convention with upsert logic

**Authentication:**
- JWT via `jose` library, HS256 algorithm. Key handling in `backend/src/auth/jwt.ts`
- Token extraction: `getBearerToken()` parses `Authorization: Bearer <token>` header
- Token verification: `verifyAdminToken()` returns payload or null
- Route-level auth guard: `requireAdmin()` in `backend/src/routes/helpers.ts` -- checks token validity and returns user object, or sets 401 status
- Admin credentials stored in `admin_users` table: username + bcrypt-like password hash

**Validation:**
- Manual validation in each service function. No validation library or middleware.
- `assertPostInput()` in `backend/src/services/posts.ts` -- validates title, slug format (lower-kebab-case regex), date format (YYYY-MM-DD), non-empty summary/content/tags
- Errors thrown as `new Error('Chinese message')`, caught in route handlers by try/catch blocks and converted via `toErrorPayload(error)` to `{ error: string }`

## Error Handling

**Frontend:**
- try/catch in async functions. Errors displayed via `showFormMessage()` or similar helpers.
- `fetchJson()` in `frontend/src/data/api.ts` checks `response.ok` and throws `Error` with server message or status text.

**Backend:**
- Each route wraps business logic in try/catch, sets HTTP status code on the `set` object, and returns `{ error: message }`.
- No centralized error handling middleware.
- `toErrorPayload(error: unknown): { error: string }` in `backend/src/routes/helpers.ts` normalizes Error instances to `{ error: error.message }`.

## Function Design

**Size:**
- Service functions tend to be substantial (100-200 lines for complex CRUD), but well-segmented into helper functions
- Route files keep handlers concise (10-30 lines each)

**Parameters:**
- Services accept typed input objects (e.g., `UpsertPostInput`, `ListAdminPostOptions`) rather than positional parameters
- Route helpers use explicit primitive params (e.g., `asPositiveInt(params.id)`)

**Return Values:**
- Service functions return typed objects or `null` for not-found cases
- Route handlers return objects (Elysia auto-JSON-serializes)
- Frontend API functions return typed responses via generics (`fetchJson<T>(...)`)

## Module Design

**Exports:**
- Named exports preferred throughout. Each file exports specific functions and types.
- Barrel file in `frontend/src/features/admin.ts` re-exports from sub-modules.

**Barrel Files:**
- Limited usage. `frontend/src/features/admin.ts` is the only barrel file observed.

---

*Convention analysis: 2026-04-27*
