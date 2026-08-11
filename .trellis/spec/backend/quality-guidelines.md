# Quality Guidelines

> 后端代码质量规范与质量门（Rust）。

## Overview

无第三方 lint 配置覆盖（cargo fmt + clippy 为内置质量门）。质量门：`cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --all-targets`。

## Forbidden Patterns

- **路由层写业务逻辑**：路由只做解析/认证/响应映射，业务在 services 层
- **使用 `query!` 宏**：保持运行时 `sqlx::query()` 策略一致性（避免 offline 数据文件）
- **位置参数传大量输入**：服务函数接收 typed 输入结构体（`UpsertPostInput`）
- **DB 错误透传内部消息**：`sqlx::Error` 映射为 500 通用文案，不 `Display` 给客户端
- **panic/unwrap 传播到 handler**：服务层返回 `Result`，路由层 `?` 传播
- **在文档中重新引入旧栈（Bun/Elysia/SQLite）描述**（历史教训，除明确的历史兼容说明）

## Required Patterns

- **cargo fmt + clippy -D warnings 零警告**：所有新代码必须通过
- **服务层分层**：新增业务域 = services 新文件 + `&PgPool`/`&AppState` 注入
- **中文校验消息**：`ServiceError::BadRequest('中文消息')`
- **错误统一映射**：`ServiceError` IntoResponse，handler 返回 `Result<_, ServiceError>`
- **AdminAuth 守卫**：管理路由 handler 签名含 `AdminAuth` 提取器
- **命名**：文件/函数 snake_case、类型 PascalCase
- **凭据红线**：`.env` 不入库；默认凭据占位 `<凭据位置>`；日志不打印凭据

## Testing Requirements

- 后端改动需通过 `cargo test --all-targets`（单元 + 集成）
- 集成测试 `tests/api_compat.rs`：独立测试库（`shino_blog_test`）+ TRUNCATE 重置 + 串行互斥
- 新增端点/服务建议补充集成测试用例（覆盖公开/管理 API）
- 数据迁移工具改动需跑迁移演练（`/tmp/opencode/prod-blog.sqlite` 构造副本）

## Code Review Checklist

- [ ] 无泄漏的默认凭据/密钥（env 默认值安全、未提交 .env）
- [ ] SQL 变更后全局搜索受影响列名（含 posts_search 镜像同步）
- [ ] 路由薄实现，服务层承载逻辑
- [ ] 错误路径有状态码 + `{ error }` 体（DB 错误 500 通用文案）
- [ ] cargo fmt/clippy/test 通过
- [ ] 搜索索引写路径同步维护（create/update/publish/delete）
