# Codebase Concerns

**Analysis Date:** 2026-04-27

## Security

**Hardcoded default JWT secret:**
- Severity: Critical
- Files: `backend/src/config/env.ts:29`
- Issue: `jwtSecret` defaults to `'change-this-secret-in-production'` when `ADMIN_JWT_SECRET` env var is unset. Anyone who leaves this unset in production has a trivially forgeable token.
- Fix: Fail startup in production if `ADMIN_JWT_SECRET` is not explicitly configured.

**Default admin credentials `admin`/`admin123`:**
- Severity: High
- Files: `backend/src/config/env.ts:31-32`
- Issue: `adminUsername` and `adminPassword` have predictable defaults. Combined with no rate limiting on login, this invites credential stuffing.
- Fix: Require `ADMIN_PASSWORD` env var in production; do not use defaults.

**CORS reflects all origins (`origin: true`):**
- Severity: Medium
- Files: `backend/src/app.ts:28`
- Issue: `cors({ origin: true })` mirrors any request's Origin header, allowing any website to make credentialed cross-origin requests (with `credentials: true`). Combined with cookie-less JWT, the immediate risk is CRSF-type form submissions from any origin.
- Fix: Restrict to known frontend origins via env var.

**No rate limiting on `POST /api/admin/auth/login`:**
- Severity: Medium
- Files: `backend/src/routes/admin.ts:29-62`
- Issue: The login endpoint has no throttle or lockout mechanism, allowing unlimited brute-force attempts.
- Fix: Add a simple in-memory rate limiter (or Bun plugin) keyed by IP, with exponential backoff.

**No JWT token refresh or revocation mechanism:**
- Severity: Medium
- Files: `backend/src/auth/jwt.ts`
- Issue: Tokens are signed with a 24-hour expiry (`ADMIN_JWT_EXPIRES_HOURS`) but cannot be revoked early. If a token leaks, the only mitigation is changing the JWT secret, which invalidates all sessions.
- Fix: Maintain a token blacklist in SQLite, or implement short-lived access tokens with a refresh token flow.

**Admin token stored in localStorage:**
- Severity: High
- Files: `frontend/src/data/api.ts:19`, `frontend/src/data/api.ts:257`
- Issue: Token key `'shino.admin.token'` is stored in localStorage and read by `readAdminToken()` for every API call. Any XSS (e.g., through a compromised dependency or unsanitized markdown rendering) can exfiltrate the token.
- Fix: Consider httpOnly cookie-based auth for the admin, or tighten CSP headers.

## Architecture

**Drizzle ORM schema defined but unused in service layer:**
- Severity: Medium
- Files: `backend/src/db/schema.ts` (tables defined), `backend/src/db/client.ts:23` (drizzle client initialized), vs. all 8 service files in `backend/src/services/*.ts` using raw SQL via `context.sqlite.query()`
- Issue: The Drizzle schema and client are fully configured and used only in `backend/src/auth/admin.ts`. All service files (49 raw `.query()` calls across: `posts.ts` 19, `about.ts` 7, `friends.ts` 7, `profile.ts` 6, `media.ts` 5, `search.ts` 3, `site-config.ts` 2) bypass type-safe queries.
- Impact: No compile-time validation of SQL correctness or column names. Changes in schema require manual grep across all raw SQL strings.
- Fix: Incrementally migrate service functions to use Drizzle's query builder, starting with simple CRUD operations first.

**No input validation library:**
- Severity: Medium
- Files: `backend/src/services/posts.ts:6-8` (manual regex), `backend/src/routes/admin.ts` (inline `.trim()` and emptiness checks), `backend/src/routes/helpers.ts:22-28` (only checks content-type)
- Issue: Every service function implements its own validation (regex, string trimming, length checks). No Zod, TypeBox, or Valibot schema validation. This creates inconsistency and makes it easy to miss edge cases.
- Fix: Adopt a validation library (e.g., TypeBox for Elysia native integration) to centralize input shapes.

**No centralized error handling middleware:**
- Severity: Medium
- Files: `backend/src/routes/admin.ts` (try/catch on every route handler), `backend/src/routes/helpers.ts:62-68` (basic `toErrorPayload`)
- Issue: Each admin route has its own try/catch that calls `toErrorPayload()` and sets `set.status = 400`. There is no global error boundary for unhandled exceptions. A thrown error in a handler without try/catch returns an unformatted 500.
- Fix: Add an Elysia `onError` hook that maps known error types to status codes and logs unexpected errors.

**No structured request logging or error tracking:**
- Severity: Low
- Files: `backend/src/services/search.ts:234` (only `console.error` call in production paths)
- Issue: The backend has no request logger or structured error output. Debugging production issues requires adding logging ad-hoc. There is no exception reporting service integration.

## Code Quality

**Massive single-file admin page template (414 lines):**
- Severity: Medium
- Files: `frontend/src/pages/admin.ts`
- Issue: All 7 admin panels (posts, featured, friends, about, settings, media, profile) are rendered from a single function `renderAdminPage()` returning one giant HTML template. Adding a new panel requires touching this monolithic file.
- Fix: Split each panel into its own template function in separate files under `frontend/src/pages/admin/`.

**Large feature file `admin/posts.ts` (696 lines):**
- Severity: Medium
- Files: `frontend/src/features/admin/posts.ts`
- Issue: The posts admin feature handles list rendering, editor form binding, search, filter, pagination, save, publish, unpublish, delete, slug generation, and markdown preview all in one file. Hard to reason about or test.
- Fix: Extract concerns: list rendering, editor state management, and network operations into separate modules.

**Large service file `services/posts.ts` (740 lines):**
- Severity: Medium
- Files: `backend/src/services/posts.ts`
- Issue: All post CRUD operations plus tag management, slug generation, search filtering, and FTS index maintenance in one file. Tight coupling between concerns.
- Fix: Extract tag management and FTS index operations into dedicated service files.

**Fragile post-migration ALTER TABLE statements:**
- Severity: Medium
- Files: `backend/src/db/migrate.ts:130-153`
- Issue: `runPostMigrations()` uses `PRAGMA table_info` to check column existence and `ALTER TABLE ADD COLUMN` for each new about_page column. Column additions are applied unconditionally in a fixed order. If a column fails to add (e.g., already exists but pragma didn't detect it), the migration silently breaks.
- Fix: Use a migration version table with tracked applied migrations, or use Drizzle Kit's declarative migration generator.

**No consistent code formatting or linting tools:**
- Severity: Low
- Files: No `.eslintrc`, `eslint.config.*`, `.prettierrc`, or `biome.json` found in either `frontend/` or `backend/`
- Issue: No automated style enforcement. Code style consistency depends entirely on developer discipline.

## Feature Gaps

**No draft auto-save:**
- Severity: Medium
- Files: `frontend/src/features/admin/posts.ts`
- Issue: The post editor requires explicit "Save" button clicks. Losing browser state means losing all unsaved content.
- Fix: Auto-save to localStorage on every keystroke (debounced), with a "restore draft" prompt on editor open.

**No bulk operations on posts:**
- Severity: Low
- Files: `backend/src/routes/admin.ts`, `backend/src/services/posts.ts`
- Issue: Posts can only be deleted, published, or featured one at a time. No batch endpoints exist.

**No admin user management:**
- Severity: Low
- Files: `backend/src/auth/admin.ts`
- Issue: Only one admin user is created via `ensureDefaultAdminUser()`. There is no API to list, create, or update admin accounts. All changes require direct database access.

**No image optimization on upload:**
- Severity: Low
- Files: `backend/src/services/media.ts:18-56`
- Issue: Uploaded images are stored as-is with no resizing, compression, or format conversion. A 5MB PNG cover image is served directly to every visitor. Only a 5MB max size check exists.
- Fix: Generate thumbnail variants on upload (e.g., using `sharp`), or validate dimensions before accepting.

**Media orphan detection rescans all posts on every query:**
- Severity: Low
- Files: `backend/src/services/media.ts:58-88`, `buildPostReferenceMap()`
- Issue: Every call to `listMediaAssets()` loads ALL posts from the database and scans their `cover_image_url` and `content_markdown` fields with regex to build a reference map. No caching. With hundreds of posts, this becomes linearly slower.
- Fix: Maintain a `media_references` join table updated on post save/delete, or cache the reference map.

**FTS5 search fallback is fragile:**
- Severity: Low
- Files: `backend/src/services/search.ts:232-310`
- Issue: The LIKE-based fallback search (used when FTS5 raises an exception) uses a completely different scoring algorithm (simplistic fixed weights) and only searches `title` and `summary`, not `content_markdown` or `tags`. Results between FTS and fallback are inconsistent.
- Fix: Create/verify the FTS5 virtual table during migration to prevent the FTS path from failing, or make the LIKE fallback match the FTS weighting.

## Frontend UX

**Destructive actions use bare `window.prompt()`/`window.confirm()`:**
- Severity: Medium
- Files: `frontend/src/features/admin/posts.ts:46` and `:167`, `frontend/src/features/admin/friends.ts:145` and `:339`, `frontend/src/features/admin/media.ts:191`, `frontend/src/features/admin/content-settings.ts:164-166`, `frontend/src/main.ts:451`
- Issue: Post deletion requires typing the title in a `prompt()` dialog. Friend link deletion and media deletion use unstyled `confirm()` dialogs. These are jarring compared to the otherwise styled admin UI.
- Fix: Build a reusable `<dialog>`-based confirmation modal component with proper styling.

**No keyboard shortcuts in admin editor:**
- Severity: Low
- Files: `frontend/src/pages/admin.ts:94` (plain textarea), `frontend/src/features/admin/posts.ts`
- Issue: No Ctrl+S to save, no Ctrl+B/I for bold/italic in markdown, no Tab for indentation. All interactions require mouse.
- Fix: Add a lightweight keyboard shortcut handler that listens for common editor shortcuts.

**No WYSIWYG toolbar (pure Markdown textarea):**
- Severity: Low
- Files: `frontend/src/pages/admin.ts:94` (textarea with Markdown content)
- Issue: Content editing is done in a plain textarea. Users must know Markdown syntax. There is no toolbar for inserting links, images, headings, or formatting.
- Fix: Add a simple toolbar that inserts Markdown syntax at the cursor position.

**About page admin has deeply nested UI with high cognitive load:**
- Severity: Low
- Files: `frontend/src/pages/admin.ts:251-290`, `frontend/src/features/admin/content-settings.ts`
- Issue: The about page editor uses multiple `<fieldset>` elements with dynamically populated lists (intro paragraphs, narrative sections, timeline events). The add/remove controls are generated in JS with no visual hierarchy or inline validation feedback.
- Fix: Consider a step-by-step wizard UI or a single-page structured form with collapsible sections.

## Test Coverage Gaps

**Only one test file covering backend API:**
- Severity: High
- Files: `backend/src/__tests__/api.test.ts` (421 lines, 9 test cases)
- What's tested: auth login, post CRUD, search, featured ordering, upload validation.
- What's NOT tested: friend links service, about service, profile card service, site config service, media asset lifecycle (list/delete without upload), token verification edge cases, POST `/api/admin/posts/:id/publish` and `/unpublish` flows.
- Risk: Backend-only personal blog; risk is moderate. But untested services can silently break on refactor.
- Priority: Medium. Add integration tests for friend links, about, profile, and media services.

**No frontend tests:**
- Severity: High
- Files: No `.test.ts` or `.spec.ts` files found in `frontend/src/`
- What's missing: No component tests, no router tests, no rendering tests, no feature behavior tests.
- Risk: UI bugs are caught only by manual testing. The Vanilla SPA pattern (manual DOM manipulation) is particularly prone to runtime errors from missing elements.
- Priority: Medium. A full test framework is heavyweight for a personal blog; at minimum, add smoke tests for critical admin flows (login, post save/load).

---

*Concerns audit: 2026-04-27*
