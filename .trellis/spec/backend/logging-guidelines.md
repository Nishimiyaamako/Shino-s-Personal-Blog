# Logging Guidelines

> 后端日志约定（tracing + systemd journal）。

## Overview

后端使用 `tracing` + `tracing-subscriber`（格式化输出到 stdout）。生产环境由 systemd 接管输出至 journal（`journalctl -u shino-blog-backend`）。

## Log Levels

- `tracing::info`：服务启动/监听端口信息（`main.rs`）
- `tracing::error`：错误路径（如搜索索引重建失败、迁移失败）
- `tracing::debug`：可选调试细节（hydration 跳过等场景）

## Structured Logging

- `tracing-subscriber` 默认格式化（时间戳 + 级别 + 目标 + 消息）
- 无请求日志中间件（个人博客体量不需要全量访问日志）
- systemd journal：`journalctl -u shino-blog-backend -f` 实时查看，`--since today` 按天过滤

## What to Log

- 服务启动/监听端口信息
- 异常降级路径（搜索 LIKE 降级、迁移工具备份/校验步骤）
- 关键错误（DB 连接失败、迁移失败）——含足够上下文但不含凭据

## What NOT to Log

- **凭据**：`ADMIN_PASSWORD`、`ADMIN_JWT_SECRET`、admin token 一律不得写入日志
- 用户上传文件内容、数据库完整行转储（避免泄漏隐私内容）

## 约束

- 不引入第三方日志框架（tracing 已是标准）
- 新增关键错误路径加 `tracing::error!` 并包含足够上下文
- 生产排查靠 `journalctl`，不写独立日志文件（systemd 已接管）
