---
type: kb-ops
updated: 2026-08-11
---

# 外部集成与运行时依赖

> 归纳自 .planning/codebase/INTEGRATIONS.md。本项目**无任何第三方 API 集成**，完全自包含。

## APIs & External Services

无外部 API 调用（无 Stripe/Supabase/AWS/Sentry 等）。前端唯一的出站请求是到后端 API：生产同源（`VITE_API_BASE_URL` 为空时）或 dev 代理目标（`VITE_DEV_API_PROXY_TARGET`）。

## 数据存储

- **Postgres**（云 PG 或本机 PG）：SQLx 连接池，连接串 `DATABASE_URL`（`postgres://user:pass@host:5432/shino_blog`）；迁移由 SQLx migrate 启动时幂等执行（`backend/rust/sql/migrations/`）；全文搜索 tsvector + GIN（旧 SQLite FTS5 数据经 `migrate-data` 一次性迁移）
- **文件存储**（本地文件系统）：上传目录 `UPLOADS_ROOT`（默认 `uploads`，生产 `/opt/shino-blog/uploads/images`）；文件落盘 + `media_assets` 表记录元数据；`GET /uploads/images/:fileName` 由 API 静态服务
- **缓存**：无（无 Redis/Memcached）；生产由 Nginx `expires 30d` + `Cache-Control: immutable` 缓存哈希静态资源

## 认证与身份

- 自研用户名/密码（无外部身份提供商）：argon2id（PHC 字符串，兼容既有 `$argon2id$` 哈希）+ jsonwebtoken JWT（HS256）
- Token 存浏览器 `localStorage['shino.admin.token']`，请求头 `Authorization: Bearer <token>`
- 启动时 `ensure_default_admin()` 播种管理员；env 变更时自动热更新密码

## 监控与可观测性

- 无错误追踪服务；console 日志 + systemd journal（`journalctl -u shino-blog-backend`）

## CI/CD 与部署

- 无自动化 CI；本地脚本验证：`deploy/scripts/`（local-verify / online-smoke / build-frontend-dist / check-backend-prod-env）
- 部署拓扑：标准 nginx（单域名或双域名）+ systemd 常驻 Rust 后端（`shino-blog-backend`）；前端静态挂载 `/opt/shino-blog/frontend-dist`；Postgres 于服务器本机或云（`DATABASE_URL`）；上传于 `/opt/shino-blog/uploads/images`；env 于 `/opt/shino-blog/env/backend.env`。前端构建产物归档 `deploy/artifacts/`（latest 软链 `frontend-dist-latest.tar.gz`）
- 详见 docs/kb/deploy-ops.md

## 环境变量

后端（`backend/.env` 不入库，模板 `backend/.env.example`）：`NODE_ENV` / `PORT` / `DATABASE_URL` / `UPLOADS_ROOT` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_JWT_SECRET` / `ADMIN_JWT_EXPIRES_HOURS`

前端（`frontend/.env.example`）：`VITE_DEV_API_PROXY_TARGET`（dev）/ `VITE_API_BASE_URL`（生产，空 = 同源）

**凭据位置**：本地 `backend/.env`；生产 `/opt/shino-blog/env/backend.env`（值不落文档）。

## Webhooks

无进出 webhook。

## 运行时基础设施依赖

| 依赖 | 用途 | 必需性 |
|------|------|--------|
| 本地文件系统（rw） | 上传存储 | 是 |
| Postgres | 数据库（云 PG 或本机 PG，经 `DATABASE_URL`） | 是 |
| Rust 运行时 | 应用执行（cargo build --release 产物） | 是 |
| systemd | 进程管理、自动重启、日志 | 生产 |
| Nginx | 反代 + SSL + 静态服务 | 生产 |
