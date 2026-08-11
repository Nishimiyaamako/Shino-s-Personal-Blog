# Directory Structure

> 后端代码组织方式（Rust + Axum + SQLx）。

## Overview

后端为 Rust 单一 crate（`backend/rust/`），按 **Routes → Services → 基础设施** 三层组织。路由层只处理 HTTP 关注点，业务逻辑全部在 services 层，数据库访问统一经 `AppState`（PgPool）注入。

## Directory Layout

```
backend/
├── .env.example           # 环境变量模板（DATABASE_URL 版）
├── rust/                  # Rust crate（唯一开发/构建目标）
│   ├── Cargo.toml         # 依赖（axum/sqlx/jsonwebtoken/argon2/...）
│   ├── Cargo.lock
│   ├── sql/migrations/    # SQLx 迁移（0001_init.sql：10 表 + posts_search 镜像）
│   ├── src/
│   │   ├── main.rs        # 启动：env → pool → migrate → axum serve
│   │   ├── lib.rs         # Router 装配（CORS + public + admin + uploads + 静态）
│   │   ├── config.rs      # 环境变量读取（含 DATABASE_URL）
│   │   ├── db.rs          # PgPool 初始化 + sqlx migrate
│   │   ├── auth.rs        # login / JWT HS256 / require_admin 守卫 / 默认管理员播种
│   │   ├── error.rs       # ServiceError → { error } 响应映射
│   │   ├── models.rs      # API 请求/响应类型（camelCase）
│   │   ├── markdown.rs    # pulldown-cmark GFM + ammonia 白名单
│   │   ├── routes/        # HTTP 路由（薄层，委托给 services）
│   │   │   ├── mod.rs
│   │   │   ├── public.rs  # 公开 API (/api/*)
│   │   │   ├── admin.rs   # 管理 API (/api/admin/*，AdminAuth 守卫)
│   │   │   └── uploads.rs # GET /uploads/images/:fileName 静态服务
│   │   └── services/      # 业务逻辑层（一个文件一个领域）
│   │       ├── mod.rs
│   │       ├── posts.rs   # 文章 CRUD、发布/取消、标签同步、搜索索引同步
│   │       ├── search.rs  # tsvector 搜索 + 多因子排序
│   │       ├── media.rs   # 图片上传校验、媒体列表、孤立检测
│   │       ├── about.rs   # 关于页 CRUD
│   │       ├── friends.rs # 友链 CRUD
│   │       ├── profile.rs # 名片卡 + 联系方式
│   │       └── site_config.rs  # 站点全局配置 CRUD
│   ├── src/bin/
│   │   └── migrate-data.rs   # SQLite→PG 数据迁移工具（一次性）
│   └── tests/
│       └── api_compat.rs     # 集成测试（tower::ServiceExt::oneshot，独立测试库）
├── data/                  # （历史）SQLite 数据文件，已被 Postgres 替代
├── uploads/images/        # 上传的图片（Git 忽略）
└── src/                   # （历史）Elysia + Bun 旧后端，待删除
```

## Module Organization

- **新增业务域**：在 `services/` 加一个文件，接收 `&PgPool`（或 `&AppState`）作为参数，业务逻辑与 SQLx 查询全部放这里
- **新增端点**：在 `routes/public.rs`（公开）或 `routes/admin.rs`（管理）注册，handler 保持 10-30 行薄实现
- **依赖方向**：routes → services → db/auth/config；禁止反向依赖
- **API 类型**：统一放 `models.rs`，前端独立维护镜像类型（已知债务，见 architecture.md）

## Naming Conventions

- 文件/目录：snake_case（`site_config.rs`、`migrate-data.rs`）
- 函数：snake_case（`list_published_posts()`、`require_admin()`）
- 类型/结构体：PascalCase（`AppState`、`ApiPostDetail`）
- 服务函数：接收 typed 输入结构体而非位置参数
- bin 目标：cargo 按文件名派生目标名，`migrate-data.rs` → `migrate-data`

## Examples

- 路由薄实现 + 服务注入模式：`src/routes/admin.rs` + `src/services/posts.rs`
- 守卫 + 错误映射：`src/auth.rs`（AdminAuth 提取器）+ `src/error.rs`（ServiceError）
- 迁移工具：`src/bin/migrate-data.rs`（rusqlite 只读 + sqlx 写 PG + 校验报告）
