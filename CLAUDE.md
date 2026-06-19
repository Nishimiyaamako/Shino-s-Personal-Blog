# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Shino's Bolg** is a personal blog project with a real full-stack runtime.

- Frontend: Vite + TypeScript + Vanilla SPA (public pages + admin pages in one app)
- Backend: Elysia.js + Drizzle + SQLite + JWT (already implemented)
- Content: Markdown + database-backed content APIs
- Package Manager: Bun

## Development Commands

```bash
# Backend development
cd backend
bun install
bun run dev            # Start backend (default 127.0.0.1:3001)
bun run typecheck
bun run test
bun run build
bun run migrate
bun run seed

# Frontend development
cd frontend
bun install
bun run dev            # Start Vite dev server (default 127.0.0.1:5173)
bun run typecheck
bun run build
bun run preview

# Quality gate (run before commits)
cd backend && bun run typecheck && bun run test && bun run build && cd ../frontend && bun run typecheck && bun run build
```

## Runtime Architecture

- Current shape: **one SPA + one backend service**.
- Backend default port: `3001` (see `backend/src/config/env.ts`).
- Vite dev proxy forwards `/api` and `/uploads` to backend target (default `http://127.0.0.1:3001`).
- Admin login API: `POST /api/admin/auth/login`.

Recommended local mental model:

- Browser hits domains (for example `blog.local.test` and `admin.local.test`)
- Local reverse proxy forwards to Vite (`:5173`)
- Vite forwards `/api` and `/uploads` to backend (`:3001`)

For detailed domain/port topology, use:

- `.planning/codebase/ARCHITECTURE.md`

### Frontend Route Map

| Route | Description |
|---|---|
| `/` | Home page |
| `/posts` | Post listing |
| `/posts/:slug` | Post detail |
| `/tags` | Tag cloud |
| `/tags/:tag` | Posts by tag |
| `/archive` | Post archive |
| `/friends` | Friend links |
| `/about` | About page |
| `/admin/login` | Admin login |
| `/admin` | Admin dashboard |
| `/admin/posts` | Post management |
| `/admin/featured` | Featured post management |
| `/admin/friends` | Friend link management |
| `/admin/about` | About page editor |
| `/admin/profile` | Profile card editor |
| `/404` | Not found |

### Backend API Map

**Public API (`/api/*`):**

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/posts` | List published posts |
| `GET` | `/api/posts/:slug` | Post detail |
| `GET` | `/api/home/featured` | Featured posts |
| `GET` | `/api/friend-links` | Public friend links |
| `GET` | `/api/about` | About page content |
| `GET` | `/api/profile-card` | Profile card data |
| `GET` | `/api/search` | Full-text search |

**Admin API (`/api/admin/*`):**

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/auth/login` | Admin login |
| `GET/POST/PATCH/DELETE` | `/api/admin/posts` | Post CRUD |
| `POST` | `/api/admin/posts/:id/publish` | Publish post |
| `POST` | `/api/admin/posts/:id/unpublish` | Unpublish post |
| `PATCH` | `/api/admin/posts/:id/featured` | Toggle featured |
| `POST` | `/api/admin/uploads/image` | Upload image |
| `GET/POST/PATCH/DELETE` | `/api/admin/friend-links` | Friend link CRUD |
| `GET/PATCH` | `/api/admin/about` | Read/update about |
| `GET/PATCH` | `/api/admin/profile-card` | Read/update profile card |

**Static files:**

| Path | Description |
|---|---|
| `GET /uploads/images/:fileName` | Uploaded images |

## Frontend Architecture

The frontend is a client-side SPA with manual routing and DOM rendering:

- Entry: `frontend/src/main.ts`
- Router: `frontend/src/router/index.ts`
- Pages: `frontend/src/pages/*.ts`
- Components: `frontend/src/components/*.ts`
- Runtime features: `frontend/src/features/*.ts`
- Data layer: `frontend/src/data/*.ts`
- Types: `frontend/src/types/*.ts`

## Backend Architecture

Backend code is organized as:

- Entrypoints: `backend/src/index.ts`, `backend/src/app.ts`
- Routes: `backend/src/routes/public.ts`, `backend/src/routes/admin.ts`
- Services: `backend/src/services/*.ts`
- Auth: `backend/src/auth/*.ts`
- Database: `backend/src/db/*.ts`
- Scripts: `backend/src/scripts/*.ts`
- Tests: `backend/src/__tests__/api.test.ts`

See [Backend API Map](#backend-api-map) above for the full endpoint reference.

## Content & Security Notes

- Markdown rendering stack: `marked` + `DOMPurify`.
- Frontmatter validation remains strict for post content fields.
- Admin token is stored in browser localStorage key `shino.admin.token`.
- Upload URLs are served via `/uploads/images/*` from backend.

## Collaboration Docs (GSD)

Use `.planning/codebase/` as the primary collaboration baseline:

- `ARCHITECTURE.md` - System architecture & domain/port topology
- `STRUCTURE.md` - Project structure
- `STACK.md` - Tech stack
- `CONVENTIONS.md` - Coding conventions
- `CONCERNS.md` - Concerns & risks
- `INTEGRATIONS.md` - Integrations
- `TESTING.md` - Testing guidelines

## Important Notes

- Project name is **"Shino's Bolg"** (intentional spelling, do not auto-correct).
- Keep frontend style import order consistent (`global.css` as manifest entry).
- Do not re-introduce "backend placeholder/scaffold" descriptions in docs.
