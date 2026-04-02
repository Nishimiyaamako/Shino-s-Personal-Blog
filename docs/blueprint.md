# Shino's Bolg Blueprint（V2）

> As of 2026-04-02。
> 文档定位：记录当前真实系统边界与近期演进方向，不承载未落地承诺。

## 1) 项目现状快照（As of 2026-04-02）

当前系统是：**同一前端 SPA（含公开站点与后台路由）+ 单后端 API 服务**。

- Frontend：Vite + TypeScript + Vanilla SPA
- Backend：Elysia.js + Drizzle + SQLite + JWT
- Content：Markdown 内容源 + 数据库存储与查询
- Deploy：静态前端分发 + `/api`/`/uploads` 反向代理

## 2) 系统架构与职责

### Frontend（`frontend/`）

- 提供公开页面路由（首页、文章、标签、归档、友链、关于）。
- 提供后台页面路由（`/admin/login`、`/admin`）。
- 统一处理页面渲染、交互、主题样式、前后端 API 调用。

### Backend（`backend/`）

- 提供 Public API（`/api/*`）与 Admin API（`/api/admin/*`）。
- 提供管理员认证（JWT）、内容管理、友链管理、关于页管理、资料卡管理。
- 提供上传文件服务（`/uploads/images/*`）。

### Content（`frontend/src/content` + DB）

- Markdown 作为可维护内容源。
- 后端可通过脚本导入内容并在 SQLite 中提供查询能力。
- 前端遵循统一内容协议（frontmatter 规则）。

### Deploy（`deploy/`）

- 前端按静态产物部署。
- Nginx/1Panel 负责 SPA 路由回退与 `/api`、`/uploads` 反代。
- 可采用前台/后台双域名入口语义（后台入口映射到 `/admin/login`）。

## 3) 能力边界（已实现）

### 公开站点能力

- 文章列表、详情、标签、归档、友链、关于页。
- 站内搜索、精选文章、资料卡展示。

### 后台管理能力

- 管理员登录。
- 文章增删改查、发布/下线、精选排序。
- 友链管理、关于页管理、资料卡管理。
- 图片上传与回显 URL。

### 内容与媒体能力

- Markdown 渲染与清洗。
- SQLite 存储与搜索索引支持。
- 上传图片通过后端统一访问路径提供。

### 部署能力

- 开发态前后端分离运行并通过代理衔接。
- 生产态由反向代理统一入口与路由分发。

## 4) 路由与 API 边界（当前契约）

### 前端关键路由

- 公开：`/`、`/posts`、`/posts/:slug`、`/tags`、`/tags/:tag`、`/archive`、`/friends`、`/about`
- 后台：`/admin/login`、`/admin`
- 兜底：`/404`

### Public API（`/api/*`）

- `GET /api/health`
- `GET /api/posts`
- `GET /api/posts/:slug`
- `GET /api/home/featured`
- `GET /api/friend-links`
- `GET /api/about`
- `GET /api/profile-card`
- `GET /api/search`

### Admin API（`/api/admin/*`）

- `POST /api/admin/auth/login`
- `GET/POST/PATCH/DELETE /api/admin/posts...`
- `POST /api/admin/posts/:id/publish`
- `POST /api/admin/posts/:id/unpublish`
- `PATCH /api/admin/posts/:id/featured`
- `POST /api/admin/uploads/image`
- `GET/POST/PATCH/DELETE /api/admin/friend-links...`
- `GET/PATCH /api/admin/about`
- `GET/PATCH /api/admin/profile-card`

### Uploads

- `GET /uploads/images/:fileName`

## 5) 运行模型（开发态 vs 生产态）

### 开发态

- 前端开发服务默认端口：`5173`
- 后端服务默认端口：`3001`
- 链路：`Browser -> (可选本机反代) -> Vite:5173 -> Backend:3001`
- `frontend/vite.config.ts` 将 `/api` 与 `/uploads` 代理到后端。

### 生产态

- 链路：`Browser -> Nginx/1Panel -> SPA 静态资源 + Backend:3001`
- `/api` 与 `/uploads` 由反代转发到后端。
- 可采用 `blog.<domain>` 与 `admin.<domain>` 双入口语义（`admin` 根路径跳转到 `/admin/login`）。

## 6) 短路线图（Next）

1. 强化本机与线上链路一致性：补齐可直接复用的本机反代模板与验收清单。
2. 收敛内容源工作流：明确 Markdown 与数据库之间的日常更新路径与责任边界。
3. 提升质量与安全基线：在现有 typecheck/test/build 之外补充更稳定的回归与配置校验。

## 7) 非目标与约束

### 非目标

- 本文不定义具体迭代排期或人力分配。
- 本文不作为低层 schema/字段规范文档。
- 本文不把未实现能力写成交付承诺。

### 约束

- 当前不拆分独立后台前端工程，后台仍属于同一 SPA 路由体系。
- 任何新能力说明必须以“已实现边界优先”，禁止回退到占位式表述。

## 8) 权威来源

- 架构与域名/端口拓扑：[docs/ai-workflow/ARCHITECTURE.md](./ai-workflow/ARCHITECTURE.md)
- 内容协议：[docs/content-spec.md](./content-spec.md)
- 项目结构总览：[PROJECT_STRUCTURE.zh-CN.md](../PROJECT_STRUCTURE.zh-CN.md)
