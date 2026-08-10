# Backend Development Guidelines

> 后端开发规范（Elysia.js + Bun + SQLite + Drizzle schema）。

## Overview

后端为 Elysia HTTP 服务，三层架构：**Routes（薄 HTTP 层）→ Services（业务逻辑 + 原始 SQL）→ DB/Auth（基础设施）**。认证为 JWT HS256（localStorage Bearer token），数据库查询以原始 SQL 为主（Drizzle 仅 schema 与类型）。

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Architecture](../architecture.md) | 系统架构总览（跨层） |
| [API Contract](./api.md) | 全部公开/管理 API 端点清单 |
| [Directory Structure](./directory-structure.md) | 模块组织与文件布局 |
| [Database Guidelines](./database-guidelines.md) | SQLite/Drizzle/原始 SQL/迁移约定 |
| [Error Handling](./error-handling.md) | 错误类型、路由 try/catch、响应格式 |
| [Quality Guidelines](./quality-guidelines.md) | 禁止模式、必需模式、审查清单 |
| [Logging Guidelines](./logging-guidelines.md) | 原生 console 日志、PM2 输出 |
| [Testing](./testing.md) | Bun Test 集成测试约定 |
| [Tech Stack](../tech-stack.md) | 技术栈与环境变量 |

## 核心约定（速查）

- **路由薄实现**：业务逻辑一律在 `services/`，路由只解析 + 调用 + 格式化
- **原始 SQL**：`context.sqlite.query(...)`，Drizzle 查询构建器禁用（保持一致性）
- **中文校验消息**：`throw new Error('中文消息')`，路由 `toErrorPayload` 格式化
- **requireAdmin 守卫**：每个管理路由开头调用
- **质量门**：`cd backend && bun run typecheck && bun run test && bun run build`

## 文档语言

- 本 spec 目录内容以中文为主（项目已有中文文档惯例），代码标识符保持英文
