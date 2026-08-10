# Database Guidelines

> 数据库约定：SQLite（WAL）+ Drizzle schema + 原始 SQL 查询。

## Overview

- **存储**：SQLite（WAL 模式），`bun:sqlite` 驱动，单连接模型
- **Schema**：Drizzle ORM（`drizzle-orm/sqlite-core`）定义 10 张表，仅用于类型定义与迁移
- **查询**：运行时全部使用原始 SQL（`context.sqlite.query(...)`），Drizzle 查询构建器不在服务层使用
- **迁移**：启动时 `db/migrate.ts` 执行（CREATE TABLE IF NOT EXISTS 幂等 + ALTER TABLE 后置迁移），另有 `bun run migrate` CLI

## 表结构（10 张）

| 表 | 说明 |
|------|------|
| `admin_users` | 管理员（单用户模式，唯一索引 username） |
| `posts` | 文章（slug 唯一索引，status: draft/published，is_featured） |
| `tags` | 标签（唯一索引，小写+连字符） |
| `post_tags` | 文章-标签关联（联合主键） |
| `media_assets` | 媒体资源（url 唯一索引） |
| `friend_links` | 友链（enabled、display_order） |
| `about_page` | 关于页（单行表 id=1） |
| `profile_card` | 名片卡（单行表 id=1） |
| `profile_contacts` | 联系方式（profile_card_id 默认 1） |
| `site_config` | 站点配置（单行表 id=1） |

**posts 关键字段**：`content_markdown` + `content_html`（服务端预渲染）、`cover_image_url`、`featured_order`、`view_count`/`like_count`/`comment_count`。

## Query Patterns

- **原始 SQL 为主**：复杂 JOIN 和聚合（如 posts + tags 的 GROUP_CONCAT）用 `context.sqlite.query()` 更简洁
- **JSON 字段**：SQLite TEXT 存储，服务层 JSON.parse/stringify
- **布尔值**：INTEGER (0/1) 存储，服务边界转换 `Boolean(row.isFeatured)`
- **单行配置表**：`id = 1` 约定 + upsert 逻辑（about_page、profile_card、site_config）
- **FTS5 全文搜索**：`db/search-index.ts` 维护 posts_search 虚拟表，BM25 评分；异常时降级 LIKE 查询
- 命名别名遵循列名 → 驼峰 API 字段映射（如 `cover_image_url AS coverImageUrl`）

## Migrations

- 启动自动迁移：`db/migrate.ts`，幂等 CREATE TABLE IF NOT EXISTS
- 显式迁移：`cd backend && bun run migrate`
- 列添加用 `PRAGMA table_info` 检查 + ALTER TABLE ADD COLUMN（后置迁移，注意脆弱性见 Common Mistakes）

## Naming Conventions

- 表名：snake_case 复数（`post_tags`、`media_assets`）
- 列名：snake_case（`cover_image_url`、`featured_order`）
- API 类型字段：camelCase，通过 SQL 别名映射

## Common Mistakes

- **Drizzle 与原始 SQL 混用**：schema 变更需手动 grep 全部原始 SQL 字符串，列别名多处重复 → 提交涉及列变更时全局搜索受影响查询
- **后置迁移脆弱**：ALTER TABLE 按固定顺序无条件执行，失败会静默破坏 → 变更 schema 后务必在干净库上跑迁移验证
- **不要在服务层引入 Drizzle 查询构建器**：保持既有原始 SQL 策略一致性，除非有明确重构任务
