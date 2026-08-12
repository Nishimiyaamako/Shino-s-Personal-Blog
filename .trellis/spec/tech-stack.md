# Technology Stack

> Shino's Bolg 技术栈与配置速查。

## 语言

- **Rust**：后端全部源码（edition 2024，rustup stable），`cargo` 管理（非交互安装见 docs/kb/deploy-ops.md）
- **TypeScript 5.9**：前端源码（Vite + Vanilla TS SPA），目标 ES2022，ESNext modules，Bundler resolution
- **Bash**：部署脚本（`deploy/scripts/`）
- **SQL**：SQLx 迁移文件（`backend/rust/sql/migrations/`）中的原始 SQL

## 运行时与包管理

- **后端**：Rust 编译为单一二进制 `shino-blog-backend`（`cargo build --release` → `backend/rust/target/release/`）；无 Node 运行时依赖
- **前端**：Bun（包管理 + 脚本执行，`frontend/bun.lock`）；构建经 Vite

## 框架

| 类别 | 技术 | 说明 |
|------|------|------|
| HTTP | Axum 0.8 | 路由、提取器、中间件（`backend/rust/src/routes/`） |
| DB 访问 | SQLx 0.8 | `postgres` 特性，`PgPool` 连接池，运行时 `query()`（不用 `query!` 宏） |
| DB 迁移 | SQLx migrate | `sql/migrations/0001_init.sql`，启动自动执行 |
| JWT | jsonwebtoken | HS256，sub=user.id + username claim |
| 密码 | argon2 crate | argon2id，兼容 Bun.password 生成的 PHC 哈希 |
| Markdown | pulldown-cmark + ammonia | GFM 渲染 + XSS 白名单过滤 |
| 构建 | Vite 7.2 | 开发服务器 + 构建 + API 代理（`frontend/vite.config.ts`） |
| SPA | Vanilla TS | 无框架，自定义路由 + 手动 DOM 渲染 |
| 测试 | cargo test（后端）+ Vitest 4/happy-dom（前端） | 后端：单元（`src/` 内 `#[cfg(test)]`）+ 集成（`tests/api_compat.rs`，tower::ServiceExt::oneshot，含公开端点键集契约断言）；前端：52 用例（`src/**/*.test.ts` + `__fixtures__/contract.test.ts`） |

## 关键依赖

**后端（backend/rust/Cargo.toml）**：
- `axum` + `tokio` + `tower-http`（cors）— HTTP 栈
- `sqlx`（runtime-tokio / postgres / migrate / derive / macros）— 数据库
- `jsonwebtoken` — JWT HS256
- `argon2` + `password-hash` — 密码哈希（兼容 Bun argon2id）
- `pulldown-cmark` + `ammonia` — Markdown 渲染 + 净化
- `serde` + `serde_json` — 序列化
- `chrono` — 时间处理
- `rusqlite`（bundled，仅 `migrate-data` 工具读旧 SQLite）— 数据迁移
- `tracing` + `tracing-subscriber` — 结构化日志
- `anyhow` — 错误传播

### 依赖版本锁定说明（2026-08-12 核验，技术债清理任务）

| 依赖 | 当前 | crates.io 最新 | 维持理由 |
|------|------|----------------|----------|
| sqlx | 0.8.0 | 0.9.0 | 0.9 为破坏性大版本（查询 API/特性重组），迁移工具与运行时均稳定，升级风险>收益；0.8.0 是 0.8 系列最终版（无补丁），cargo 报 future-incompat 警告（已知） |
| jsonwebtoken | 9.3.1 | 11.0.0 | 9→10/11 破坏性变更（Key/Header API 重设计），当前实现对齐旧 jose 契约，行为优先不升级 |
| rusqlite | 0.31.0 | 0.40.2 | sqlx 0.8 的 migrate 特性传递依赖 libsqlite3-sys ^0.28，与 rusqlite 0.37+ 需要的 ^0.35 冲突（links = "sqlite3"）；升级需先升 sqlx 0.9 |
| argon2 | 0.5.3 | 0.6.0-rc.8 | 最新稳定版即 0.5.x；0.6 仅 RC |
| axum / ammonia / pulldown-cmark | — | 已最新 | — |

升级路径（未来）：sqlx 0.9 发布稳定并验证 → 同步升级 rusqlite 解锁 + jsonwebtoken 11（一次完成，全量 api_compat 回归）。

**前端**：
- `dompurify` 3.3 — 客户端 HTML 净化
- `highlight.js` 11.12 — 代码块语法高亮（core + 按需语言注册于 `features/post-detail.ts`）
- `@iconify/iconify` 3.1 — 名片卡平台图标（`data/platform-presets.ts`）
- `vitest` + `happy-dom` — 测试框架（devDependencies）

**进程管理**：systemd 单元 `deploy/systemd/shino-blog-backend.service`（替代 PM2，已移除）

## 环境变量

**后端**（`backend/.env` 不入库，模板 `backend/.env.example`）：

| 变量 | 说明 |
|------|------|
| `NODE_ENV` | `development` / `production` |
| `PORT` | 端口（默认 3001） |
| `DATABASE_URL` | Postgres 连接串（生产云 PG / 本地原生 PG 通用） |
| `UPLOADS_ROOT` | 上传目录（默认 `/opt/shino-blog/uploads`） |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 管理员凭据 |
| `ADMIN_JWT_SECRET` / `ADMIN_JWT_EXPIRES_HOURS` | JWT 配置（默认 24h） |

**前端**（`frontend/.env.example`）：
- `VITE_DEV_API_PROXY_TARGET` — Vite dev 代理目标（默认 `http://127.0.0.1:3001`）
- `VITE_API_BASE_URL` — 生产环境绝对 API 基址（空 = 同源）

## 构建与质量门

```bash
# 后端（backend/rust/）
export PATH="$HOME/.cargo/bin:$PATH"
cargo fmt && cargo clippy --all-targets -- -D warnings && cargo test --all-targets
cargo build --release            # 产物 target/release/shino-blog-backend + migrate-data

# 前端（frontend/）
bun run typecheck && bun run test && bun run build

# 数据迁移（SQLite → Postgres，一次性工具）
cargo run --release --bin migrate-data -- <sqlite路径> <DATABASE_URL>
```

- 前端无 ESLint / Prettier / Biome 配置，格式约定靠纪律（见 conventions spec）
- 旧 Bun 后端（Elysia + SQLite）已删除，Rust 版本（08-11-backend-rust-migration）为其唯一继任者

## 平台要求

**开发**：Rust 工具链（rustup）、本地 Postgres（原生或 docker 临时实例）、端口 5173（前端）/ 3001（后端，dev 可用 3101 避开占用）。

**生产**：Linux 服务器 + systemd + Nginx 反代（`/api`、`/uploads` → 后端）；前端静态挂载 `/opt/shino-blog/frontend-dist`；Postgres（云或自建）经 `DATABASE_URL` 连接；上传于 `/opt/shino-blog/uploads/images`；env 于 `/opt/shino-blog/env/backend.env`。详见 docs/kb/deploy-ops.md。
