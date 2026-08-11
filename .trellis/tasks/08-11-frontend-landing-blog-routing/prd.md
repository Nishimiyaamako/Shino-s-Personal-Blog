# 前端：landing 页 + 博客路由迁移

## Goal

将 `/` 从"精选最新文章页"改造为站点的 landing 主页面（参考 https://2x.nz/ 结构：Hero + 分区入口卡片 + 关于摘要 + 社交关注），博客全家族移入 `/blog` 前缀，精选功能整体废弃，新增 `slogan` 站点配置（后台可编辑），并保证旧链接 `/posts*` 通过 301 兼容。

## Background

- 现状（已核验）：
  - 路由注册在 `frontend/src/router/index.ts:28-47`（ROUTE_RECORDS）与 `:49-56`（PRIMARY_NAV_LINKS：首页/文章/标签/归档/友链/关于）。
  - `/` 渲染 `renderHomePage`（frontend/src/pages/home.ts，19 行，精选最新 5 篇）。
  - 精选字段贯穿前后端：DB `posts.is_featured`/`posts.featured_order`（backend/src/db/schema.ts:29-30）、后端 /home/featured API（backend/src/routes/public.ts:34）、admin 精选管理模块（frontend/src/pages/admin.ts 中 featured 面板 + router 的 /admin/featured）、前端 `data/posts.ts:32-46`（loadHomeFeaturedPosts）、`utils/search.ts:116-128`（featuredOrder 作为质量分）、`types/content.ts:21`。
  - site-config 数据流：后端 site_config 表 → GET /api/site-config → 前端 `data/site-config.ts`（applyRemoteSiteConfig 覆盖 DEFAULT_SITE_CONFIG，DEFAULT 在 `config/site.ts`）。
  - 前端 API base 已环境化：`data/api.ts:20`（`VITE_API_BASE_URL`）。
  - nginx 模板：`deploy/nginx/1panel-single-domain-template.conf` 等三份（静态 SPA + /api/ + /uploads/ 反代），无旧链重定向规则。
- 父任务决策（D1-D6 子集）：
  - D1 `/` → landing；D2 `/blog` 承载文章列表（含主题筛选/排序）；D3 精选功能整体废弃；D4 友链/关于 → landing 卡片 + 页脚（URL 不变）；D5 slogan 新增 site-config 字段；D6 不引框架。

## Requirements

1. **Landing 页（`/`）**：Hero（头像复用 profile-card 数据、站名、slogan、双 CTA 进入博客/关于）+ 分区入口卡片（博客 /blog、归档 /blog/archive、标签 /blog/tags、友链 /friends、关于 /about）+ 关于摘要区块（复用 about API）+ 社交关注（复用 profile-card contact 列表）。无 profile card 侧栏、无精选文章区块。
2. **路由迁移**：`/blog`（文章列表，原 /posts 全功能：主题筛选、日期排序）、`/blog/:slug`、`/blog/tags`、`/blog/tags/:tag`、`/blog/archive`；`/friends`、`/about` URL 不变。导航更新为博客相关条目。
3. **旧链 301**：`/posts`、`/posts/:slug` → nginx 301 至 `/blog`、`/blog/:slug`；`/tags`、`/tags/:tag`、`/archive` → `/blog/tags`、`/blog/tags/:tag`、`/blog/archive`（前端路由不保留旧路径，由 nginx 或 SPA 兜底处理）。
4. **精选功能废弃**：前端删除 loadHomeFeaturedPosts、home 页精选区块、admin featured 面板与路由、search 质量分中的 featuredOrder 逻辑；后端删除 /home/featured API、schema 的 is_featured/featured_order 字段、admin featured 相关端点；迁移脚本/新建库不含该字段（与子任务 3 衔接，以删除后的后端为 API 兼容基准）。
5. **slogan 配置**：site_config 表新增 slogan 列；API（GET/PATCH /api/site-config）与类型（AdminSiteConfig）增加 slogan；后台"站点设置"表单新增 slogain 输入；landing Hero 显示 slogan。
6. **main.ts 联动**：shouldRenderProfileCard / shouldRenderFloatingScrollTopButton / isNavActive / motion 选择器按新路由调整（`/` 不再渲染 profile card，`/blog` 及其子路由替代原 `/posts` 行为）。

## Acceptance Criteria

- [ ] `/` 渲染 landing：Hero（站名+slogan+CTA）、分区入口卡片（博客/归档/标签/友链/关于）、关于摘要、社交关注均正常展示，无精选区块。
- [ ] `/blog`、`/blog/:slug`、`/blog/tags`、`/blog/tags/:tag`、`/blog/archive` 全部路由工作，/blog 含主题筛选与日期排序（原 /posts 行为等价）。
- [ ] 主导航更新：博客/文章/标签/归档（/blog 前缀），友链/关于从导航移除。
- [ ] `/friends`、`/about` URL 不变且页面正常。
- [ ] 精选功能完全移除：前端无 featured 相关代码残留（grep 为空或仅注释说明），后端 schema/API/admin 无 featured 残留；`/home/featured` 不再提供服务。
- [ ] slogan：后台站点设置可编辑并保存，landing Hero 生效；空值时有合理 fallback。
- [ ] nginx 模板含 /posts*、/tags*、/archive 301 规则。
- [ ] 自检三命令通过；动画/交互无回归（首页 profile card 不再出现、路由切换正常）。

## Out of Scope

- 管理界面整体 UI 重构（子任务 2）。
- Rust 后端重写与 SQLite→PG 数据迁移（子任务 3）。
- 精选字段在 Postgres 新库的处理细节（子任务 3 以本任务删除后的后端为基准）。
- Cloudflare Workers 接入（deferred）。

## Open Questions

- [ ] nginx 301 对 SPA 旧链接（含查询参数）的精确规则在实施时以线上流量验证（低风险，可 301 通配）。

## Notes

- 本任务同时触碰前后端（featured 清理、slogan 存储），但前端为主；后端改动仅限 featured 删除与 slogan 字段，不重构业务。
- 实施首步：核验 backend/.env 入库问题（父任务固定检查项）。
