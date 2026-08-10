# Directory Structure

> 后端代码组织方式（Elysia.js + Bun + SQLite）。

## Overview

后端为 Elysia HTTP 服务，按 **Routes → Services → DB/Auth** 三层组织。路由层只处理 HTTP 关注点，业务逻辑全部在 services 层，数据库访问统一走 `DatabaseContext`（闭包注入）。

## Directory Layout

```
backend/
├── package.json
├── tsconfig.json           # strict, ES2022, Bundler resolution, types: ["bun"]
├── bun.lock
├── ecosystem.config.js     # PM2 生产配置
├── ecosystem.config.local.cjs  # PM2 本地配置
├── start.sh                # 生产启动脚本
├── data/                   # SQLite 数据库文件（Git 忽略）
├── uploads/images/         # 上传的图片（Git 忽略）
└── src/
    ├── index.ts            # 服务入口（监听端口）
    ├── app.ts              # Elysia 应用装配（CORS → 路由 → 静态文件）
    ├── routes/             # HTTP 路由（薄层，委托给 services）
    │   ├── public.ts       # 公开 API (/api/*)
    │   ├── admin.ts        # 管理 API (/api/admin/*)
    │   └── helpers.ts      # 认证守卫 + JSON 解析 + 错误格式化
    ├── services/           # 业务逻辑层（一个文件一个领域）
    │   ├── posts.ts        # 文章 CRUD、发布/取消、精选切换
    │   ├── search.ts       # FTS5 搜索 + 多因子排序
    │   ├── markdown.ts     # marked 渲染 + highlight.js + sanitize
    │   ├── about.ts        # 关于页 CRUD
    │   ├── friends.ts      # 友链 CRUD
    │   ├── profile.ts      # 名片卡 + 联系方式
    │   ├── media.ts        # 图片上传 + 孤立文件检测
    │   └── site-config.ts  # 站点全局配置 CRUD
    ├── db/                 # 数据库层
    │   ├── client.ts       # SQLite 连接（WAL / foreign_keys）
    │   ├── schema.ts       # Drizzle ORM 表定义（10 张表）
    │   ├── migrate.ts      # 原始 SQL 迁移脚本
    │   └── search-index.ts # FTS5 搜索索引管理
    ├── auth/               # 认证层
    │   ├── jwt.ts          # JWT HS256 签发/验证
    │   └── admin.ts        # 管理员密码验证 + 默认用户播种
    ├── config/env.ts       # 环境变量读取与类型化
    ├── scripts/            # CLI 脚本（seed / migrate / import-from-frontend）
    ├── types/api.ts        # API 请求/响应类型
    └── __tests__/api.test.ts  # API 集成测试（bun test）
```

## Module Organization

- **新增业务域**：在 `services/` 加一个文件，接收 `DatabaseContext` 作为第一参数，业务逻辑与原始 SQL 全部放这里
- **新增端点**：在 `routes/public.ts`（公开）或 `routes/admin.ts`（管理）注册，handler 保持 10-30 行薄实现
- **依赖方向**：routes → services → db/auth；禁止反向依赖
- **API 类型**：统一放 `types/api.ts`，前端独立维护镜像类型（已知债务，见 architecture.md）

## Naming Conventions

- 文件/目录：kebab-case（`site-config.ts`、`search-index.ts`）
- 函数：camelCase（`listPublishedPosts()`、`getBearerToken()`）
- 类型/接口：PascalCase（`DatabaseContext`、`UpsertPostInput`）
- 服务函数：接收 typed 输入对象（`UpsertPostInput`）而非位置参数

## Examples

- 路由薄实现 + 服务注入模式：`backend/src/routes/admin.ts` + `backend/src/services/posts.ts`
- 守卫 + 错误格式化：`backend/src/routes/helpers.ts`
