# 前端：landing 页 + 博客路由迁移 — Design

## 1. 目标路由表（新旧对照）

| 旧路由 | 新路由 | 处理 |
| --- | --- | --- |
| `/` | `/` | landing 页（新渲染器 `renderHomePage` 重写为 landing） |
| `/posts` | `/blog` | 路由迁移（renderPostsPage 复用，URL 前缀变化） |
| `/posts/:slug` | `/blog/:slug` | 路由迁移 |
| `/tags` | `/blog/tags` | 路由迁移 |
| `/tags/:tag` | `/blog/tags/:tag` | 路由迁移 |
| `/archive` | `/blog/archive` | 路由迁移 |
| `/friends` | `/friends` | URL 不变，仅导航位置变化 |
| `/about` | `/about` | URL 不变，仅导航位置变化 |
| `/admin/*` | 不变 | 精选模块移除 |
| `/home/featured` API | 删除 | 精选废弃 |
| `/posts*`、`/tags*`、`/archive`（旧 URL） | — | nginx 301 → `/blog*`（见 §5） |

## 2. 前端架构改动

### 2.1 路由层（frontend/src/router/index.ts）
- `ROUTE_RECORDS` 更新：`/` → landing title「首页」；`/blog`、`/blog/:slug`、`/blog/tags`、`/blog/tags/:tag`、`/blog/archive`；删除 `/admin/featured` 记录。
- `PRIMARY_NAV_LINKS`（:49-56）重排：
  - 一级导航：首页 `/`、博客 `/blog`、标签 `/blog/tags`、归档 `/blog/archive`（icon 沿用）。
  - 友链/关于：从 PRIMARY_NAV_LINKS 移除（landing 卡片 + 页脚入口，URL 不变）。
  - `PrimaryNavIcon` 类型保留 home/posts/tags/archive 四个 icon，friends/about icon 可留作 landing 卡片复用（实现时可导出独立 landing 卡片组件使用）。
- `resolveAdminModule` 移除 featured 分支（:77）。

### 2.2 landing 页（frontend/src/pages/home.ts 重写）
结构（对齐 2x.nz，适配本项目数据源）：
```
<section class="page page-landing">
  <div class="landing-hero">
    头像（profile-card 数据） + 站名(siteTitle) + slogan(新字段) + 双 CTA（进入博客 /blog、关于 /about）
  </div>
  <div class="landing-sections">
    分区入口卡片：博客 /blog · 归档 /blog/archive · 标签 /blog/tags · 友链 /friends · 关于 /about
  </div>
  <section class="landing-about-preview">关于摘要（about API 前 N 段）</section>
  <section class="landing-social">社交关注（profile-card contact 列表复用）</section>
</section>
```
- 数据源：`loadSiteConfig()`（含新 slogan）、`loadProfileCard()`（头像/昵称/简介/contact）、`loadAboutViewModel()`（摘要）。
- 新增 `frontend/src/pages/landing.ts`（或 home.ts 就地重写，二选一；推荐**新文件 landing.ts**，home.ts 删除，避免命名混乱）。
- 新增样式 `frontend/src/styles/pages/landing.css`。

### 2.3 硬编码链接扫描（全部改为 /blog 前缀）
已核验需改点：
- `components/post-list.ts`：:140、:152（?theme 查询）、:153、:160、:172、:178、:188、:189 — `/posts` → `/blog`，`/tags/:label` → `/blog/tags/:label`。
- `pages/post-detail.ts:16`：「返回文章列表」`/posts` → `/blog`。
- `pages/archive.ts:27`：`/posts/${slug}` → `/blog/${slug}`。
- `pages/tag-detail.ts:20`：返回标签页 `/tags` → `/blog/tags`。
- `features/public-runtime.ts:389`：搜索结果链接 `/posts/${slug}` → `/blog/${slug}`。
- `features/public-runtime.ts:12-33`：水合路径判断（shouldHydratePostCollection / shouldHydrateProfileCard / readSlugFromPathname）— `/`、`/posts`、`/posts/`、`/tags`、`/tags/`、`/archive` 全部换成 `/blog` 系；`/` 从文章集合水合中移除（landing 不加载文章列表，改为加载 profile-card + about + site-config）。

### 2.4 main.ts 联动（frontend/src/main.ts）
- `shouldRenderProfileCard`（:205-207）：`/` 移除（landing 无 profile 侧栏），`/blog`、`/blog/:slug` 保留 → `['/blog', '/blog/:slug']`。
- `shouldEnableProfileCardRouteMotionForRoute`（:209-215）：同步新路径。
- `shouldRenderFloatingScrollTopButton`（:217-225）：`/` 移除（或保留供 landing 长页滚动，二选一，推荐保留），`/blog` 系保留。
- `isNavActive`（:323-329）：`/` 精确匹配逻辑保留；`/blog` 前缀匹配已满足（`startsWith('/blog/')`）。
- `PAGE_STAGGER_SELECTORS`（:846-862）与路由 enter 动画：新增 `.landing-*` 选择器；`home` 相关类（`.page-home`、`hero-card` 已存在）补充。
- `POST_CARD_MOTION_SELECTORS`（:868-873）：`.post-list--home` 类随 landing 移除精选而删（home 变体不再使用），`.post-list--posts` 保留（/blog）。
- `setupPublicDataHydration` 调用不变（内部逻辑已按 2.3 改）。

### 2.5 精选功能移除（前端）
- `data/posts.ts`：删除 `loadHomeFeaturedPosts`（:32-46）及其导出；`toSummary`/`fromSummary` 相关 featuredOrder 字段（:356/:369/:390）清理。
- `types/content.ts:21`：删除 `featuredOrder`。
- `types/api.ts`：删除 featured 相关类型字段。
- `utils/search.ts:116-128`：质量分公式去掉 featuredOrder 分支（回退纯文本质量分）。
- `pages/home.ts`：删除（被 landing.ts 替代）。
- `pages/admin.ts`：删除 featured 面板（:157-165 renderFeaturedWorkspace）与 `isFeaturedMode` 逻辑（:38-42）；`renderPanelHidden` 中 featured 分支（:31）移除。
- `router/index.ts`：移除 `/admin/featured` 记录与 ADMIN_MODULE_LINKS 中 featured 项（:20）、resolveAdminModule featured 分支。
- `features/admin/dashboard.ts`、`features/admin/shared.ts`、`features/admin/posts.ts`：删除 featured 引用（isFeatured 表单字段/接口调用）。
- `features/admin/login.ts` 若引用 featured 一并清理。

## 3. 后端改动（仅精选删除 + slogan）

### 3.1 精选删除
- `db/schema.ts`：postsTable 移除 `isFeatured`（:29）、`featuredOrder`（:30）→ 生成新迁移（drizzle-kit 或手写 SQLite ALTER，实施时核验现有迁移机制，backend/src/db/migrate.ts）。
- `services/posts.ts`：删除 featuredOrder 相关类型（:34/:68）、SQL 列（:186-187/:287-288/:324-325/:473-474）、`getHomeFeaturedPosts` 或等价（:344-367，含 /home/featured 数据源）、写入逻辑（:515/:538-539/:556）。
- `routes/public.ts:34`：删除 `.get('/home/featured', ...)`。
- `routes/admin.ts`：删除 `/posts/:id/featured`（:247）及 featured 相关查询参数处理（若有）。
- `types/api.ts`：删除 featured 字段。
- 注意：`getHomeFeaturedPosts` 若被 search/其他服务引用，需同步清理。

### 3.2 slogan 字段
- `db/schema.ts`：site_config 表新增 `slogan` 文本列（Drizzle schema 更新 + 迁移）。
- `services/site-config.ts`：DEFAULT_SITE_CONFIG 增 `slogan: ''`；SiteConfigRow/查询/保存 SQL 增 slogan（:20-40 区域）。
- `types/api.ts`：`ApiSiteConfig`/`AdminSiteConfig` 增 `slogan: string`。
- `routes/admin.ts`：PATCH /site-config 校验与保存逻辑加 slogan。
- 前端 `data/site-config.ts`：DEFAULT_SITE_CONFIG 增 slogan、normalize 增 slogan；`config/site.ts` 可加默认值。
- 前端 admin「站点设置」表单（pages/admin.ts:293-334 settings 面板）增 slogan 输入（顶栏 fieldset 内，紧邻站点副标题）。
- 兼容：API 响应缺 slogan 字段时前端 fallback ''（避免旧后端未部署时崩溃）。

## 4. 数据/契约变更

- GET /api/site-config 响应新增 `slogan`（旧前端忽略未知字段，安全）；PATCH 提交含 slogan。
- /api/home/featured 删除 → 前端不再调用（无 404 影响）。
- 文章 API 响应不再含 featuredOrder（前端类型同步删除，容错：保留读取但忽略）。

## 5. nginx 301 规则（deploy/nginx/ 三份模板统一）

```
# 旧博客路径 → /blog 前缀（保留查询参数）
location ~ ^/posts(/.*)?$ { return 301 /blog$1$is_args$args; }
location ~ ^/tags(/.*)?$ { return 301 /blog/tags$1$is_args$args; }
location = /archive { return 301 /blog/archive$is_args$args; }
location = /tags { return 301 /blog/tags$is_args$args; }
```
- 置于 location / 的 try_files 之前。
- 双域模板（1panel-dual-domain-template.conf）中 API 域不需要这些规则（仅前端域）。
- 前端 SPA 内部 data-link 导航已全部改为新路径，301 仅兜底外部旧链接/书签。

## 6. 兼容性与回滚

- **回滚点**：本任务分三个提交块（①路由迁移+landing ②精选删除 ③slogan），每块独立提交；回滚任一提交不破坏其他功能。
- 前端先上线（构建 dist + nginx 新规则 + 旧路径 301），后端 slogan 字段上线前 landing 的 slogan fallback ''（无感）。
- 精选删除与后端 /home/featured 删除同步提交（前端不再调用，删除安全）。
- 旧书签 `/posts/xxx` 通过 301 落到 `/blog/xxx`，浏览器 URL 更新为新路径。

## 7. 验证方案

- 前端：`npm run typecheck`（frontend/）→ `npm run build` → `deploy/scripts/local-verify.sh`。
- 后端：`bun run typecheck` + `bun test`（backend/，api.test.ts 需同步移除 /home/featured 与 featured 用例）。
- 手动冒烟：`/` landing 渲染、`/blog` 列表+筛选、`/blog/:slug` 详情、搜索跳转 `/blog/:slug`、`/friends`、`/about` 正常。
