---
type: kb-ops
updated: 2026-08-10
---

# 外部集成与运行时依赖

> 归纳自 .planning/codebase/INTEGRATIONS.md。本项目**无任何第三方 API 集成**，完全自包含。

## APIs & External Services

无外部 API 调用（无 Stripe/Supabase/AWS/Sentry 等）。前端唯一的出站请求是到后端 API：生产同源（`VITE_API_BASE_URL` 为空时）或 dev 代理目标（`VITE_DEV_API_PROXY_TARGET`）。

## 数据存储

- **SQLite**（本地文件）：`bun:sqlite` + Drizzle ORM（仅 schema），连接 `DATABASE_PATH`（默认 `backend/data/blog.sqlite`，生产 `/opt/shino-blog/data/blog.sqlite`）；WAL 模式；迁移启动时幂等执行；FTS5 虚拟表全文搜索
- **文件存储**（本地文件系统）：上传目录 `UPLOADS_ROOT`（默认 `backend/uploads/images`，生产 `/opt/shino-blog/uploads/images`）；文件落盘 + `media_assets` 表记录元数据；`GET /uploads/images/:fileName` 由 `Bun.file()` 静态服务
- **缓存**：无（无 Redis/Memcached）；生产由 Nginx `expires 30d` + `Cache-Control: immutable` 缓存哈希静态资源

## 认证与身份

- 自研用户名/密码（无外部身份提供商）：`Bun.password.hash()/verify()` + jose JWT（HS256）
- Token 存浏览器 `localStorage['shino.admin.token']`，请求头 `Authorization: Bearer <token>`
- 启动时 `ensureDefaultAdminUser()` 播种管理员；env 变更时自动热更新密码

## 监控与可观测性

- 无错误追踪服务；console 日志 + PM2 日志文件（`/opt/shino-blog/logs/`：combined/out/error）

## CI/CD 与部署

- 无自动化 CI；本地脚本验证：`deploy/scripts/`（local-verify / online-smoke / build-frontend-dist / check-backend-prod-env）
- 部署拓扑：1Panel 静态网站（单域名）+ Nginx 反代 + PM2 进程；前端构建产物归档 `deploy/artifacts/`（latest 软链 `frontend-dist-latest.tar.gz`）
- 详见 docs/kb/deploy-ops.md

## 环境变量

后端（`backend/.env` 不入库，模板 `backend/.env.example`）：`NODE_ENV` / `PORT` / `DATABASE_PATH` / `UPLOADS_ROOT` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_JWT_SECRET` / `ADMIN_JWT_EXPIRES_HOURS`

前端（`frontend/.env.example`）：`VITE_DEV_API_PROXY_TARGET`（dev）/ `VITE_API_BASE_URL`（生产，空 = 同源）

**凭据位置**：本地 `backend/.env`；生产 `/opt/shino-blog/env/backend.env`（值不落文档）。

## Webhooks

无进出 webhook。

## 运行时基础设施依赖

| 依赖 | 用途 | 必需性 |
|------|------|--------|
| 本地文件系统（rw） | SQLite、上传存储、日志 | 是 |
| Bun 运行时 | 应用执行 | 是 |
| PM2 | 进程管理、自动重启、日志 | 生产 |
| Nginx | 反代 + SSL + 静态服务 | 生产 |
