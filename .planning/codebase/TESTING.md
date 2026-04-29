# Testing Patterns

**Analysis Date:** 2026-04-27

## Test Framework

**Runner:**
- Bun's built-in test runner (`bun test`). Imports from `bun:test`: `describe`, `test`, `expect`, `beforeAll`, `afterAll`.

**Assertion Library:**
- Bun's built-in `expect` (Jest-compatible API). Includes matchers like `toBe()`, `toBeTrue()`, `toBeFalse()`, `toBeGreaterThan()`, `toBeGreaterThanOrEqual()`, `toStrictEqual()`, `toBeUndefined()`.

**Run Commands:**
```bash
cd backend && bun run test       # Run all tests
cd backend && bun test            # Alias via bun's native runner
```

**Config file:** No separate test config. The `backend/package.json` `"test"` script calls `bun test`, which auto-discovers `*.test.ts` files.

## Test File Organization

**Location:**
- Single test file: `backend/src/__tests__/api.test.ts`
- Co-located with source under `src/__tests__/`. All tests are in one file.

**Naming:**
- Test file: `api.test.ts`
- Test suites (describe blocks): `'admin auth'`, `'post publish and search'`, `'uploads'`
- Test cases (test blocks): `'login success with default admin'`, `'draft post is not visible in public list'`, `'upload image returns a public url'`

**Structure:**
```
backend/src/__tests__/
  api.test.ts          # All API integration tests
```

## Test Structure

**Suite Organization** (from `backend/src/__tests__/api.test.ts`):
```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createApp } from '../app';

const testDatabasePath = resolve('/tmp', `shino-blog-api-test-${Date.now()}.sqlite`);
let appInstance: Awaited<ReturnType<typeof createApp>>;

beforeAll(async () => {
  appInstance = await createApp({ databasePath: testDatabasePath });
});

afterAll(() => {
  appInstance.dbContext.sqlite.close();
  rmSync(testDatabasePath, { force: true });
});

describe('admin auth', () => {
  test('login success with default admin', async () => {
    const token = await login();
    expect(token.length).toBeGreaterThan(20);
  });
});
```

**Patterns:**
- Setup: `beforeAll` creates a full Elysia app with an in-memory SQLite database (`:memory:` equivalent via `/tmp/shino-blog-api-test-<timestamp>.sqlite`). The `createApp()` call triggers migrations and seeds the default admin user.
- Teardown: `afterAll` closes the database connection and removes the temporary database file and its WAL/SHM siblings.
- Assertion: Tests use `expect()` assertions. Responses are parsed as JSON via `response.json()` and cast to typed objects with `as`.

## Mocking

**Framework:** No mocking library used. Tests run against a real SQLite database.

**Approach:** All tests are integration-style. They:
1. Create an app with a temporary database path (`/tmp/shino-blog-api-test-<timestamp>.sqlite`)
2. Make HTTP requests to the app via `appInstance.app.handle(new Request(...))`
3. Assert on response status codes and JSON bodies

**What NOT to Mock:**
- Database -- all tests use real SQLite
- Services -- no service-level mocking
- Auth -- login helper obtains real JWT tokens from the app

This means tests exercise the full request lifecycle: HTTP parsing -> route matching -> auth -> service logic -> database -> response serialization.

## Fixtures and Factories

**Test Data:**
- Test helpers defined in the test file itself: `requestJson()`, `requestForm()`, `login()`.
- `requestJson()` wraps `app.handle(new Request(...))` with optional body JSON serialization and Bearer token.
- `login()` performs a complete login flow and returns a valid JWT token.
- Test input data defined inline as typed object literals within each test case.

**Location:** All test helpers and data live in `backend/src/__tests__/api.test.ts` -- no separate fixture files or factory modules.

## Coverage

**Requirements:** No coverage threshold enforced.

**Current Test Coverage:**

Tested (in `backend/src/__tests__/api.test.ts`):
- Public endpoints: post listing, post detail, featured posts, search (title, tag, content, Chinese)
- Admin auth: login success, token rejection
- Admin posts: create, list with filters (q/status/tag), pagination, duplicate slug rejection, publish lifecycle
- Admin friend links: CRUD operations (implicitly tested as part of the test suite)
- Uploads: MIME type rejection, file size rejection, successful image upload with URL return

NOT tested:
- About page API (GET/PATCH `/api/admin/about`)
- Profile card API (GET/PATCH `/api/admin/profile-card`)
- Site config API (GET/PATCH `/api/admin/site-config`)
- Media listing/deletion (GET `/api/admin/media`, DELETE `/api/admin/media/:id`)
- Frontend: No test framework configured, no test files exist in `frontend/src/`

## Test Types

**Integration Tests:**
- All tests in `backend/src/__tests__/api.test.ts` are integration tests. They spin up the full app with a real database and make HTTP-level assertions.

**Unit Tests:**
- None observed. No unit-level tests for individual service functions or route helpers.

**E2E Tests:**
- Not used. No browser-based or Playwright/Cypress tests configured.

## Common Patterns

**Async Testing:**
```typescript
test('published post can be searched', async () => {
  const token = await login();
  await requestJson('/api/admin/posts', { method: 'POST', token, body: { /* ... */ } });
  const searchResponse = await requestJson('/api/search?q=keyword');
  const payload = await searchResponse.json();
  expect(payload.items.some(item => item.slug === expected)).toBeTrue();
});
```

**Auth Flow Testing:**
```typescript
test('reject admin endpoint without token', async () => {
  const response = await requestJson('/api/admin/posts');
  expect(response.status).toBe(401);
});
```

**Error Testing:**
```typescript
test('reject duplicated slug when creating posts', async () => {
  // Create first
  await requestJson('/api/admin/posts', { method: 'POST', token, body: { slug: 'xxx' } });
  // Attempt duplicate
  const response = await requestJson('/api/admin/posts', { method: 'POST', token, body: { slug: 'xxx' } });
  expect(response.status).toBe(400);
});
```

## Running Tests

```bash
cd backend && bun run test
```

Tests run against a temporary SQLite database. Each test run creates a new database file in `/tmp/` identified by a timestamp. The `beforeAll` hook creates the app instance, and `afterAll` cleans up the database file and WAL/SHM siblings.

---

*Testing analysis: 2026-04-27*
