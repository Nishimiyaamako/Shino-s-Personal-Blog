# Backend Development Guidelines

> 后端开发规范（Rust + Axum + SQLx + Postgres）。

## Overview

后端为 Rust 单体二进制（Axum HTTP 服务），三层架构：**Routes（薄 HTTP 层）→ Services（业务逻辑 + SQLx 查询）→ 基础设施（db/auth/config/error）**。认证为 JWT HS256（localStorage Bearer token），数据库为 Postgres（SQLx 连接池），查询使用运行时 `sqlx::query()`。

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Architecture](../architecture.md) | 系统架构总览（跨层） |
| [API Contract](./api.md) | 全部公开/管理 API 端点清单 |
| [Directory Structure](./directory-structure.md) | 模块组织与文件布局 |
| [Database Guidelines](./database-guidelines.md) | Postgres/SQLx/迁移约定 |
| [Error Handling](./error-handling.md) | 错误类型、路由映射、响应格式 |
| [Quality Guidelines](./quality-guidelines.md) | 禁止模式、必需模式、审查清单 |
| [Logging Guidelines](./logging-guidelines.md) | tracing 日志、systemd journal |
| [Testing](./testing.md) | cargo 单元/集成测试约定 |
| [Tech Stack](../tech-stack.md) | 技术栈与环境变量 |

## 核心约定（速查）

- **路由薄实现**：业务逻辑一律在 `services/`，路由只解析 + 调用 + 映射错误
- **运行时 SQL**：`sqlx::query()` / `query_as()`，不使用 `query!` 宏（避免 offline 数据文件复杂度）
- **中文校验消息**：业务错误返回 `ServiceError::BadRequest('中文消息')`，统一映射 `{ error }`
- **require_admin 守卫**：`AdminAuth` FromRequestParts 提取器，每个管理路由自动鉴权
- **质量门**：`cargo fmt && cargo clippy --all-targets -- -D warnings && cargo test --all-targets`

## 文档语言

- 本 spec 目录内容以中文为主（项目已有中文文档惯例），代码标识符保持英文
