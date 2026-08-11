# Database Guidelines

> 数据库约定：Postgres + SQLx（连接池 + 运行时查询 + migrate）。

## Overview

- **存储**：Postgres（生产云 PG / 本地原生 PG 通用），经 `DATABASE_URL` 连接
- **连接**：SQLx `PgPool` 连接池，`db.rs` 创建，`AppState` 注入各 handler
- **查询**：运行时 `sqlx::query()` / `query_as()`（**不用 `query!` 宏**——避免 offline data 文件与编译期 DB 依赖）
- **迁移**：SQLx migrate（`sql/migrations/*.sql`），启动自动执行（`sqlx::migrate!()`）

## 表结构（10 张 + 搜索镜像）

| 表 | 说明 |
|------|------|
| `admin_users` | 管理员（单用户模式，唯一索引 username，argon2id 哈希） |
| `posts` | 文章（slug 唯一，status: draft/published，无 featured 列） |
| `tags` | 标签（唯一索引，小写+连字符） |
| `post_tags` | 文章-标签关联（联合主键） |
| `media_assets` | 媒体资源（url 唯一索引） |
| `friend_links` | 友链（enabled boolean、display_order） |
| `about_page` | 关于页（单行表 id=1） |
| `profile_card` | 名片卡（单行表 id=1） |
| `profile_contacts` | 联系方式（profile_card_id 默认 1） |
| `site_config` | 站点配置（单行表 id=1，含 slogan） |
| `posts_search` | tsvector 镜像表（生成列 + GIN 索引，仅 published） |

**posts 关键字段**：`content_markdown` + `content_html`（服务端预渲染）、`cover_image_url`、`view_count`/`like_count`/`comment_count`。

**类型映射**：SQLite 迁移前的历史类型已收敛——`id` serial（i32）、时间戳 TEXT ISO8601（保持迁移前格式）、`enabled` boolean（SQLite 0/1 迁移时转换）。

## Query Patterns

- **运行时 SQL 为主**：复杂 JOIN 和聚合（如 posts + tags 的 `string_agg`）用 `sqlx::query_as` 映射结构体
- **布尔值**：PG boolean 原生，`bool_of()` 转换边界
- **单行配置表**：`id = 1` 约定 + upsert 逻辑（about_page、profile_card、site_config）
- **全文搜索**：`posts_search` 镜像表（`to_tsvector('simple', ...)` 生成列 + GIN），`ts_headline` 生成 `<mark>` 摘要；异常时降级 LIKE 查询
- 列名 snake_case ↔ API 字段 camelCase：在 SQL 别名或 `FromRow` 映射中转换

## Migrations

- 启动自动迁移：`sqlx::migrate!()`（`sql/migrations/`）
- 新增列/表：追加 `00XX_*.sql` 迁移文件（不可修改已应用的迁移）
- 数据结构变更：新迁移文件中执行 ALTER / 重建，保持幂等性验证

## Naming Conventions

- 表名：snake_case 复数（`post_tags`、`media_assets`）
- 列名：snake_case（`cover_image_url`）
- API 类型字段：camelCase，服务层映射

## Common Mistakes

- **引入 `query!` 宏**：需编译期 DB 访问/offline 文件，保持运行时 `query()` 一致性
- **迁移文件乱改**：已应用的迁移不可修改，新增迁移追加
- **时间戳类型漂移**：保持 TEXT ISO8601 存储（迁移前格式），勿改用 timestamptz 导致时区位移
- **搜索索引不同步**：写路径（create/update/publish/delete）必须同步维护 `posts_search` 镜像，或调用 rebuild 服务
