# Technology Stack

> Shino's Bolg 技术栈与配置速查。

## 语言

- **TypeScript 5.9**：全部前后端源码，目标 ES2022，ESNext modules，Bundler resolution
- **Bash**：部署脚本（`deploy/scripts/`）与 `backend/start.sh`
- **SQL**：迁移文件中的原始 SQL（DDL 与 FTS5 设置）

## 运行时与包管理

- **Bun**（`@types/bun`）：主运行时 + 包管理器 + 测试运行器；`bun.lock` 前后端各一份；Node `fs`/`path`/`crypto`/`url` 经 Bun 兼容层使用
- 生产 ecosystem 配置直接引用 `/usr/bin/bun`

## 框架

| 类别 | 技术 | 说明 |
|------|------|------|
| HTTP | Elysia.js 1.4 | 路由、中间件、请求生命周期（`backend/src/app.ts`） |
| 构建 | Vite 7.2 | 开发服务器 + 构建 + API 代理（`frontend/vite.config.ts`） |
| SPA | Vanilla TS | 无框架，自定义路由 + 手动 DOM 渲染 |
| 测试 | Bun Test | 内置运行器，`backend/src/__tests__/api.test.ts`；前端无测试框架 |
| 类型检查 | `tsc --noEmit` | 前后端均 strict 模式 |

## 关键依赖

**后端**：
- `drizzle-orm` 0.44 — schema 定义（`db/schema.ts`），查询层不使用
- `jose` 6.1 — JWT HS256（`auth/jwt.ts`）
- `marked` 17.0 — Markdown 渲染（前后端共用）
- `@elysiajs/cors` 1.4 — CORS 中间件
- `sanitize-html` 2.17 — 服务端 HTML 净化
- `gray-matter` 4.0 — frontmatter 解析
- `highlight.js` 11.11 + `marked-highlight` 2.2 — 代码高亮

**前端**：
- `dompurify` 3.3 — 客户端 HTML 净化
- `@iconify/iconify` 3.1 — 名片卡平台图标（`data/platform-presets.ts`）

**进程管理**：`pm2` 6.0 — 生产守护（`ecosystem.config.js` / `ecosystem.config.local.cjs`）

## 环境变量

**后端**（`backend/.env` 不入库，模板 `backend/.env.example`）：

| 变量 | 说明 |
|------|------|
| `NODE_ENV` | `development` / `production` |
| `PORT` | 端口（默认 3001） |
| `DATABASE_PATH` | SQLite 路径（默认 `backend/data/blog.sqlite`） |
| `UPLOADS_ROOT` | 上传目录 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 管理员凭据 |
| `ADMIN_JWT_SECRET` / `ADMIN_JWT_EXPIRES_HOURS` | JWT 配置（默认 24h） |

**前端**（`frontend/.env.example`）：
- `VITE_DEV_API_PROXY_TARGET` — Vite dev 代理目标（默认 `http://127.0.0.1:3001`）
- `VITE_API_BASE_URL` — 生产环境绝对 API 基址（空 = 同源）

## 构建与质量门

```bash
cd backend && bun run dev        # 启动后端（默认 127.0.0.1:3001）
cd frontend && bun run dev       # 启动 Vite（默认 127.0.0.1:5173）

# 全量质量门（提交前运行）
cd backend && bun run typecheck && bun run test && bun run build && \
cd ../frontend && bun run typecheck && bun run build

# 数据库
cd backend && bun run migrate    # 运行迁移
cd backend && bun run seed       # 播种初始数据
```

- 构建产物：`backend/dist/`、`frontend/dist/`
- 无 ESLint / Prettier / Biome 配置，格式约定靠纪律（见 conventions spec）

## 平台要求

**开发**：Bun 运行时、本地 SQLite（零配置文件型）、端口 5173（前端）/ 3001（后端）。

**生产**：1Panel 管理的 Linux 服务器；Nginx 反代 + SSL 终结（`/api`、`/uploads` → 后端）；PM2 常驻 `shino-blog-backend`；前端静态挂载 `/opt/shino-blog/frontend-dist`；SQLite 于 `/opt/shino-blog/data/blog.sqlite`；上传于 `/opt/shino-blog/uploads/images`；env 于 `/opt/shino-blog/env/backend.env`。详见 docs/kb/deploy-ops.md。
