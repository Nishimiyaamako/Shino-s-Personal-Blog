# Logging Guidelines

> 后端日志约定（现状 + 约束）。

## Overview

无结构化日志库。使用 Bun/Node 原生 `console.info` / `console.error`。生产环境日志由 PM2 接管输出到文件。

## Log Levels

- `console.info`：服务启动信息（`index.ts`）
- `console.error`：错误路径（如 FTS5 降级，`services/search.ts`）

## Structured Logging

- 无结构化日志格式（无 JSON 行、无请求日志中间件）
- PM2 输出：
  - 合并日志 `/opt/shino-blog/logs/combined.log`
  - stdout `/opt/shino-blog/logs/out.log`
  - stderr `/opt/shino-blog/logs/error.log`

## What to Log

- 服务启动/监听端口信息
- 异常降级路径（FTS5 → LIKE）

## What NOT to Log

- **凭据**：`ADMIN_PASSWORD`、`ADMIN_JWT_SECRET`、admin token 一律不得写入日志
- 用户上传文件内容、数据库完整行转储（避免泄漏隐私内容）

## 约束

- 保持现状即可：不引入日志框架，新增关键错误路径加 `console.error` 并包含足够上下文
- 生产排查靠 `pm2 logs shino-blog-backend`
