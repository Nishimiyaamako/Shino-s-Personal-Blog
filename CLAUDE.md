# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Shino's Bolg** - A personal blog built as a Vite + TypeScript Vanilla SPA with Markdown-based content.

- Frontend: Vite + TypeScript (no framework, vanilla DOM manipulation)
- Backend: Elysia.js placeholder (not yet implemented)
- Content: Markdown files with frontmatter in `frontend/src/content/posts/`
- Package Manager: Bun

## Development Commands

```bash
# Frontend development
cd frontend
bun install
bun run dev          # Start dev server
bun run build        # Production build
bun run preview      # Preview production build
bun run typecheck    # Type checking without emit

# Quality gate (run before commits)
cd frontend && bun run typecheck && bun run build
```

## Architecture

### Frontend Structure

The frontend is a **client-side SPA** with manual routing and DOM rendering:

- **Entry**: `frontend/src/main.ts` - App shell, navigation, route switching, page enhancements
- **Router**: `frontend/src/router/index.ts` - Route table, dynamic parameter matching, 404 fallback
- **Pages**: `frontend/src/pages/*.ts` - Page-level render modules (home, posts, post-detail, tags, etc.)
- **Components**: `frontend/src/components/*.ts` - Reusable UI render fragments
- **Data Layer**: `frontend/src/data/*.ts` - Content parsing, view models, local data sources
- **Types**: `frontend/src/types/*.ts` - Domain type definitions

### Content System

Articles are Markdown files with strict frontmatter validation:

**Required fields** (see `docs/content-spec.md`):
- `title`: string (non-empty)
- `slug`: string (kebab-case, used in URL `/posts/:slug`)
- `date`: string (YYYY-MM-DD format)
- `tags`: string[] (at least 1, kebab-case)
- `summary`: string (non-empty, ~140 chars)
- `status`: 'draft' | 'published' (only published shown in lists)

**Content pipeline**:
1. Import via `import.meta.glob(..., { query: '?raw', eager: true })`
2. Parse frontmatter with `gray-matter`
3. Render Markdown with `marked`
4. Sanitize HTML with `DOMPurify`

### Styles Architecture

Styles are layered in `frontend/src/styles/` with strict import order (see `frontend/src/styles/README.md`):

1. `tokens.css` - Global tokens, theme variables, dark mode, responsive tokens
2. `base.css` - Reset, base elements, app-shell background decorations
3. `layout.css` - Header/nav/main/footer, page shell layout
4. `content.css` - Shared content shells (about, profile, home-intro, archive, friends, markdown)
5. `posts.css` - Post list/cards, tags, post detail, theme rail, TOC, floating actions
6. `motion.css` - Keyframes, motion state classes, reduced-motion fallbacks

**Only import `global.css` in `main.ts`** - it aggregates all other layers.

**Token guidelines**:
- Use global tokens (`tokens.css`) when: used by 3+ areas, global semantic (focus ring, transition, surface), shared across light/dark
- Use local recipe variables when: serves single module, module-prefixed names

**Runtime CSS variables**: Use `frontend/src/utils/dom-style.ts` for reading/writing CSS custom properties at runtime (stagger indices, floating button positioning, TOC progress).

**Design Token System** (as of 2026-03-30):
- Semantic text colors: `--text-secondary`, `--text-tertiary`, `--text-info`
- Card shadows: `--card-shadow-cool`, `--card-shadow-cool-hover`, `--card-shadow-warm`, `--card-shadow-warm-hover`
- Post cover shadows: `--post-cover-shadow`, `--post-cover-shadow-strong`
- Button base styles: `--button-border`, `--button-radius`, `--button-bg`, `--button-bg-hover`
- All interactive elements use unified hover effect: `translateY(calc(var(--motion-distance-hover) * -1))` + `--card-shadow-cool-hover`

## Routes

- `/` - Home
- `/posts` - Post list
- `/posts/:slug` - Post detail
- `/tags` - Tag overview
- `/tags/:tag` - Tag detail
- `/archive` - Archive
- `/friends` - Friend links
- `/about` - About page
- `/404` - Not found

## Backend API (Placeholder)

Currently `backend/` is a scaffold. Planned endpoints:

- `GET /api/about` → `{ markdown: string }` (about page tries remote, falls back to local)
- `/api/health`, `/api/stats`, `/api/search`, `/api/comment`, `/api/admin/*` (not implemented)

## AI Workflow

This project uses AI collaboration baseline docs in `docs/ai-workflow/`:

- `MEMORY.md` - Project long-term memory (decisions, risks, current tasks)
- `STOP_HOOKS.md` - Stop-point self-check rules
- `README.md` - Workflow usage guide

**Standard workflow loop**:
```
Requirement → Plan → plan-stop-audit → frontend-preflight-skill-stack (if frontend changes)
→ Implementation (auto task-stop-memory-sync after each change) → code-stop-typecheck
→ task-stop-memory-sync (fallback) → Delivery
```

## Important Notes

- Project name is **"Shino's Bolg"** (intentional spelling, do not auto-correct to "Blog")
- No framework - all DOM manipulation is vanilla TypeScript
- Import order in styles matters - respect the layering
- Content frontmatter validation is strict - follow `docs/content-spec.md`
- Only `status: published` posts appear in lists; drafts/missing slugs → 404
