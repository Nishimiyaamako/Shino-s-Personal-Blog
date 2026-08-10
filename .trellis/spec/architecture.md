# System Architecture

> Shino's Bolg（注意：Bolg 为有意拼写，不得自动纠正）全栈个人博客系统架构总览。基于源码分析与历史架构文档整合。

---

## 1. 系统概览

| 维度 | 说明 |
|------|------|
| 项目类型 | 全栈个人博客 |
| 仓库结构 | Monorepo（`frontend/` + `backend/`），前后端无共享代码，通信纯 HTTP + JSON |
| 包管理 | Bun |
| 开发语言 | TypeScript 5.9 |
| 运行时 | Bun（后端）+ 浏览器（前端） |
| 前端 | Vite 7.2 + Vanilla TypeScript SPA（无框架） |
| 后端 | Elysia.js 1.4 + Drizzle ORM（仅 schema）+ SQLite |
| 认证 | JWT（HS256，jose 库） |
| 内容格式 | Markdown（marked + sanitize-html / DOMPurify） |
| 搜索 | SQLite FTS5 全文搜索 + BM25 评分 + 多因子排序 |

## 2. 系统架构总览

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            浏览器 (Browser SPA)                               │
│  frontend/src/main.ts                                                        │
│  ┌──────────────────────┬──────────────────────┬────────────────────────────┐ │
│  │  路由 (Router)        │  页面 (Pages)         │  管理后台 (Admin Panel)    │ │
│  │  router/index.ts     │  pages/*.ts           │  features/admin/*.ts       │ │
│  ├──────────────────────┼──────────────────────┼────────────────────────────┤ │
│  │  数据层 (Data Layer)  │  组件 (Components)     │  样式 (Styles)             │ │
│  │  data/*.ts           │  components/*.ts      │  styles/*.css              │ │
│  └──────────────────────┴──────────────────────┴────────────────────────────┘ │
│                                     │                                          │
│   HTTP (fetch + Bearer JWT)          │                                          │
│                                     ▼                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                          后端 (Elysia HTTP Server)                             │
│  backend/src/app.ts (应用装配)                                                 │
│  ┌─────────────────────────────────────┬─────────────────────────────────────┐│
│  │  路由 (Routes)                       │  认证 (Auth)                        ││
│  │  routes/public.ts  routes/admin.ts  │  auth/jwt.ts  auth/admin.ts         ││
│  ├─────────────────────────────────────┴─────────────────────────────────────┤│
│  │  服务层 (Services) - 业务逻辑                                              ││
│  │  posts.ts  search.ts  markdown.ts  about.ts  friends.ts                   ││
│  │  profile.ts  media.ts  site-config.ts                                     ││
│  ├───────────────────────────────────────────────────────────────────────────┤│
│  │  基础设施                                                                ││
│  │  db/client.ts (SQLite 连接)  db/schema.ts (Drizzle 表定义)                 ││
│  │  db/search-index.ts (FTS5)  db/migrate.ts (原始 SQL 迁移)                 ││
│  └───────────────────────────────────────────────────────────────────────────┘│
│                                     │                                          │
│                                     ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  SQLite (WAL 模式)              上传文件系统                               │ │
│  │  backend/data/blog.sqlite       backend/uploads/images/                   │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**关键特点**：
- 前后端无共享代码，通信完全基于 HTTP + JSON
- 前端为纯 Vanilla SPA，页面渲染函数返回 HTML 字符串
- 后端使用原始 SQL 查询为主（Drizzle 仅用于 schema 定义与类型）
- 管理后台认证基于 JWT Bearer Token，存储在浏览器 localStorage

## 3. 组件职责

| 组件 | 职责 | 文件 |
|------|------|------|
| App Assembly | 创建 Elysia app，装配 CORS、路由、静态文件 | `backend/src/app.ts` |
| Server Entry | 监听配置端口启动 | `backend/src/index.ts` |
| Config/Env | 读取并规范化环境变量（带默认值） | `backend/src/config/env.ts` |
| DB Client | 创建 SQLite 连接（WAL、foreign_keys），运行迁移 | `backend/src/db/client.ts` |
| DB Schema | drizzle-orm/sqlite-core 定义全部表 | `backend/src/db/schema.ts` |
| DB Migrations | CREATE TABLE IF NOT EXISTS + ALTER TABLE 后置迁移 | `backend/src/db/migrate.ts` |
| FTS5 Index | 管理 posts_search 虚拟表条目 | `backend/src/db/search-index.ts` |
| Public Routes | 所有 `/api/*` 公开端点 | `backend/src/routes/public.ts` |
| Admin Routes | 所有 `/api/admin/*` 认证端点 | `backend/src/routes/admin.ts` |
| Route Helpers | JWT 提取、admin 守卫、JSON 解析、错误格式化 | `backend/src/routes/helpers.ts` |
| Posts Service | 文章 CRUD、发布/取消、精选、标签同步、搜索索引同步 | `backend/src/services/posts.ts` |
| Search Service | FTS5 全文搜索 + BM25 + 多因子排序 | `backend/src/services/search.ts` |
| Markdown Service | marked 渲染 + highlight.js + sanitize-html | `backend/src/services/markdown.ts` |
| About Service | 结构化关于页（hero、叙事段落、时间线事件） | `backend/src/services/about.ts` |
| Friends Service | 友链 CRUD、公开/私有列表 | `backend/src/services/friends.ts` |
| Profile Service | 名片卡 + 联系方式管理 | `backend/src/services/profile.ts` |
| Media Service | 图片上传、孤立文件检测、文件系统存储 | `backend/src/services/media.ts` |
| Site Config Service | 站点全局配置（标题、页脚、备案） | `backend/src/services/site-config.ts` |
| JWT Auth | jose 签发/验证 HS256，Bearer 提取 | `backend/src/auth/jwt.ts` |
| Admin Auth | 默认管理员播种、Bun.password 验证 | `backend/src/auth/admin.ts` |
| API Types | 后端 API 请求/响应类型 | `backend/src/types/api.ts` |
| SPA Entry | 外壳渲染、路由切换、动效系统、事件代理、hydration | `frontend/src/main.ts` |
| Router | 路径匹配、路由表、admin 模块解析 | `frontend/src/router/index.ts` |
| Pages | 纯渲染函数返回 HTML 字符串 | `frontend/src/pages/*.ts` |
| Components | 可复用渲染片段（文章列表、名片卡） | `frontend/src/components/*.ts` |
| Data Layer | API 包装、指纹变化检测、本地数据变换 | `frontend/src/data/*.ts` |
| Features | 运行时行为绑定（hydration、admin 模块、登录） | `frontend/src/features/*.ts` |

## 4. 分层与依赖

**前端**：
- **Pages 层**（`pages/`）：纯函数接收 `PageRenderContext` 返回 HTML 字符串，无副作用无事件绑定。依赖 Data/Components/Router types。
- **Features 层**（`features/`）：运行时行为——事件监听、MutationObserver、防抖输入、异步 hydration、admin 模块生命周期。渲染后挂载到 DOM，返回 cleanup 函数。
- **Data 层**（`data/`）：API 调用函数、基于指纹变化检测的缓存、本地数据变换（标签统计、归档时间线、主题统计）。依赖 Types/Config。

**后端**：
- **Routes 层**（`routes/`）：薄 HTTP 处理器，解析参数/body/query，调用服务，格式化响应与错误。无业务逻辑。
- **Services 层**（`services/`）：业务逻辑、校验、原始 SQL 查询、DB 行 → API 类型转换。仅被 Routes 调用。
- **Infrastructure 层**（`db/`、`auth/`、`config/`）：数据库连接、schema、迁移、JWT 签发/验证、管理员凭据管理。

依赖方向自上而下（Pages → Data → Types；Routes → Services → DB），无循环依赖。

## 5. 关键抽象

- **DatabaseContext**：包装 SQLite Database + Drizzle 实例，闭包传递给所有路由和服务。`createDatabaseContext()` 工厂创建，`getDatabaseContext()` 复用单例，`closeDatabaseContext()` 生命周期管理。
- **PageRenderer**：`type PageRenderer = (context: PageRenderContext) => string`，所有页面渲染函数签名。
- **Fingerprint Change Detection**：从关键字段构建确定性字符串，对比当前/新指纹判断远程数据是否变化，避免不必要重渲染。
- **requireAdmin 守卫**：从请求头提取 Bearer Token、验证 JWT、返回管理员用户或置 401。非 Elysia 中间件，是每个 admin 路由处理函数开头调用的可复用异步函数：
  ```ts
  const admin = await requireAdmin(request, set);
  if (!admin) return { error: 'Unauthorized' };
  ```

## 6. 关键数据流

### 6.1 公开页面渲染（/posts/:slug）

1. 浏览器导航 → `main.ts` `resolveRoute()` 匹配路由 → 调用 `renderPostDetailPage(context)` 渲染（可能先展示本地缓存）
2. `setupPublicDataHydration()` 发起 `fetchPostDetail(slug)` → `GET /api/posts/:slug`
3. 后端 `getPublishedPostBySlug()` 原始 SQL JOIN posts + tags → `ApiPostDetail`
4. `applyRemotePostDetail()` 计算指纹对比本地缓存，变化则重新渲染

### 6.2 管理认证

1. `/admin/login` → `adminLogin(username, password)` → `POST /api/admin/auth/login`
2. 后端 `verifyAdminCredentials()` → `Bun.password.verify()` → `signAdminToken()` 签发 HS256 JWT（默认 24h）
3. 前端 `localStorage.setItem('shino.admin.token', token)` → 跳转 `/admin/posts` → `setupAdminDashboard()` 初始化管理模块

### 6.3 搜索

1. 客户端本地搜索优先（`searchPosts()` 扫缓存文章列表）
2. 远程搜索 `GET /api/search?q=...` → FTS5 虚拟表 BM25 评分
3. 多因子排序：文本相关性 50% + 时间衰减 25% + 内容质量 15%（浏览/点赞/评论）+ 权威性 10%（精选标记）
4. FTS5 `snippet()` 生成 `<mark>` 高亮摘要；FTS 异常时降级 SQLite LIKE 查询

## 7. 状态管理

- **后端**：无状态 HTTP，无内存会话。JWT 自包含。
- **前端**：模块级可变缓存（`remotePublishedPostCache`、`remotePublishedPostFingerprint`、`remoteSiteConfigOverride` 等），无集中 store；SPA 导航用 `window.history` + 自定义 `__appNavIndex` 状态键，`popstate` 驱动重渲染。

## 8. 架构约束

- Bun 事件循环单线程，SQLite 同步阻塞，无 worker 线程
- 后端 `dbContext` 为模块级单例（`db/client.ts`）；前端为各 data 模块独立缓存
- 无循环依赖；无数据库连接池（SQLite 单连接）
- 后端不使用 Elysia `derive`/`guard` 中间件模式，admin 认证在路由内联检查

## 9. 已知技术债务

- **单体 main.ts**：`frontend/src/main.ts` 约 3400 行，混合外壳渲染、路由、动效系统、搜索模态框、事件代理、页面增强编排。方向：动效提取到 `features/motion.ts`，外壳提取到 `components/shell.ts`。
- **Drizzle + 原始 SQL 混用**：schema 变更需手动搜索全部原始 SQL 字符串（如 `cover_image_url AS coverImageUrl` 别名）。方向：全面采用 Drizzle 查询构建器或完全移除。
- **前后端类型重复定义**：`backend/src/types/api.ts` 与 `frontend/src/types/api.ts` 独立维护、形状不完全一致。方向：提取共享类型工作区。
