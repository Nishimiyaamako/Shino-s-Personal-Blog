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
- Frontend routes include admin entries:
  - `/admin/login`
  - `/admin`
- Backend default port: `3001` (see `backend/src/config/env.ts`).
- Vite dev proxy forwards `/api` and `/uploads` to backend target (default `http://127.0.0.1:3001`).
- Admin login API: `POST /api/admin/auth/login`.

Recommended local mental model:

- Browser hits domains (for example `blog.local.test` and `admin.local.test`)
- Local reverse proxy forwards to Vite (`:5173`)
- Vite forwards `/api` and `/uploads` to backend (`:3001`)

For detailed domain/port topology, use:

- `docs/ai-workflow/ARCHITECTURE.md`

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

Main public/admin API groups:

- Public: `/api/health`, `/api/posts`, `/api/home/featured`, `/api/friend-links`, `/api/about`, `/api/profile-card`, `/api/search`
- Admin: `/api/admin/auth/login`, `/api/admin/posts`, `/api/admin/friend-links`, `/api/admin/about`, `/api/admin/profile-card`, `/api/admin/uploads/image`

## Content & Security Notes

- Markdown rendering stack: `marked` + `DOMPurify`.
- Frontmatter validation remains strict for post content fields.
- Admin token is stored in browser localStorage key `shino.admin.token`.
- Upload URLs are served via `/uploads/images/*` from backend.

## AI Workflow Docs

Use `docs/ai-workflow/` as the primary collaboration baseline:

- `MEMORY.md` - Project long-term memory
- `STOP_HOOKS.md` - Stop-point checks
- `README.md` - Workflow usage
- `ARCHITECTURE.md` - Domain/port routing topology

## Important Notes

- Project name is **"Shino's Bolg"** (intentional spelling, do not auto-correct).
- Keep frontend style import order consistent (`global.css` as manifest entry).
- Do not re-introduce "backend placeholder/scaffold" descriptions in docs.
