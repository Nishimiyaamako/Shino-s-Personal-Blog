# System Architecture

> Shino's Bolg（注意：Bolg 为有意拼写，不得自动纠正）全栈个人博客系统架构总览。基于 Rust 迁移完成后的源码状态。

---

## 1. 系统概览

| 维度 | 说明 |
|------|------|
| 项目类型 | 全栈个人博客 |
| 仓库结构 | Monorepo（`frontend/` + `backend/`），前后端无共享代码，通信纯 HTTP + JSON |
| 后端 | Rust（Axum 0.8 + SQLx 0.8 + Postgres），单一二进制部署 |
| 前端 | Vite 7.2 + Vanilla TypeScript SPA（无框架） |
| 认证 | JWT（HS256，jsonwebtoken） |
| 内容格式 | Markdown（pulldown-cmark + ammonia 服务端渲染） |
| 搜索 | Postgres tsvector（simple 配置）+ GIN 索引 + 多因子排序 |
| 部署 | systemd + Nginx 标准配置（无 1Panel/docker 依赖） |

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
│                          后端 (Axum HTTP Server)                               │
│  backend/rust/src/main.rs (启动：env → pool → migrate → serve)                │
│  ┌─────────────────────────────────────┬─────────────────────────────────────┐│
│  │  路由 (Routes)                       │  认证 (Auth)                        ││
│  │  routes/public.rs  routes/admin.rs  │  auth.rs (login/JWT/守卫/播种)       ││
│  │  routes/uploads.rs                  │                                     ││
│  ├─────────────────────────────────────┴─────────────────────────────────────┤│
│  │  服务层 (Services) - 业务逻辑                                              ││
│  │  posts.rs  search.rs  markdown.rs  about.rs  friends.rs                   ││
│  │  profile.rs  media.rs  site_config.rs                                     ││
│  ├───────────────────────────────────────────────────────────────────────────┤│
│  │  基础设施                                                                ││
│  │  db.rs (PgPool + migrate)  config.rs (env)  error.rs (统一错误)            ││
│  │  models.rs (API 类型)  sql/migrations/ (schema + tsvector 镜像表)          ││
│  └───────────────────────────────────────────────────────────────────────────┘│
│                                     │                                          │
│                                     ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  Postgres（DATABASE_URL 连接池）        上传文件系统                        │ │
│  │  shino_blog 库（10 表 + posts_search 镜像）│ /opt/shino-blog/uploads/images │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**关键特点**：
- 前后端无共享代码，通信完全基于 HTTP + JSON
- 前端为纯 Vanilla SPA，页面渲染函数返回 HTML 字符串
- 后端为无状态 Rust 服务（水平可扩展，为未来多实例铺路）
- 管理后台认证基于 JWT Bearer Token，存储在浏览器 localStorage

## 3. 组件职责

### 后端（backend/rust/）

| 组件 | 职责 | 文件 |
|------|------|------|
| Main Entry | 启动：env → pool → migrate → axum serve | `src/main.rs` |
| Lib 装配 | Router 装配（CORS + public + admin + uploads + 静态） | `src/lib.rs` |
| Config/Env | 读取并规范化环境变量（含 DATABASE_URL） | `src/config.rs` |
| DB Client | PgPool 创建 + sqlx migrate 自动执行 | `src/db.rs` |
| Auth | argon2id 验证、JWT HS256 签发/验证、默认管理员播种、require_admin 守卫 | `src/auth.rs` |
| Error | 统一 `{ error: string }` 响应与 400/401/404/500 映射 | `src/error.rs` |
| Models | 全部 API 请求/响应类型（camelCase，null 省略键） | `src/models.rs` |
| Markdown | pulldown-cmark GFM + ammonia 白名单 + 代码块形态 | `src/markdown.rs` |
| Public Routes | `/api/*` 公开端点（8 个） | `src/routes/public.rs` |
| Admin Routes | `/api/admin/*` 认证端点（20 个） | `src/routes/admin.rs` |
| Uploads | `GET /uploads/images/:fileName` 静态服务 | `src/routes/uploads.rs` |
| Posts Service | 文章 CRUD、发布/取消、标签同步、搜索索引同步 | `src/services/posts.rs` |
| Search Service | tsvector 搜索 + 时间衰减/质量分多因子排序 | `src/services/search.rs` |
| Media Service | 上传校验、媒体列表、孤立检测、删除 | `src/services/media.rs` |
| 其他 Service | about / friends / profile / site_config | `src/services/*.rs` |
| 迁移工具 | SQLite→PG 数据迁移 + 校验报告 + 回滚快照 | `src/bin/migrate-data.rs` |
| 集成测试 | 等价 api.test.ts + 全端点冒烟 | `tests/api_compat.rs` |

### 前端（frontend/src/）

| 组件 | 职责 | 文件 |
|------|------|------|
| SPA Entry | bootstrap：注册页面增强表、全局事件代理（点击/popstate/beforeunload） | `main.ts`（~260 行） |
| Shell | 外壳渲染（renderApp/导航/页头/页脚）、history 索引状态、navigateTo、页面增强钩子 | `components/shell.ts` |
| Motion | 动效系统（selector 表、时序常量、11 个 setup\*Motion、postCardMotionHandle） | `features/motion.ts` |
| Router | 路径匹配、路由表（/、/blog 系、/friends、/about、/admin/*）、admin 模块解析 | `router/index.ts` |
| Pages | 纯渲染函数返回 HTML 字符串（含 landing.ts） | `pages/*.ts` |
| Components | 可复用渲染片段（文章列表、名片卡） | `components/*.ts` |
| Data Layer | API 包装、指纹变化检测、本地数据变换 | `data/*.ts` |
| Features | 运行时行为绑定（hydration、admin 模块、登录、dialog、按宿主页增强：post-detail/tags/posts/archive/friends） | `features/*.ts` |

## 4. 分层与依赖

**前端**：
- **Pages 层**（`pages/`）：纯函数接收 `PageRenderContext` 返回 HTML 字符串，无副作用无事件绑定。依赖 Data/Components/Router types。
- **Features 层**（`features/`）：运行时行为——事件监听、MutationObserver、防抖输入、异步 hydration、admin 模块生命周期。渲染后挂载到 DOM，返回 cleanup 函数。
- **Data 层**（`data/`）：API 调用函数、基于指纹变化检测的缓存、本地数据变换（标签统计、归档时间线、主题统计）。依赖 Types/Config。

**后端**（Rust，模块边界对应）：
- **Routes 层**（`routes/`）：薄 HTTP 处理器，使用 axum 提取器解析参数/body/query，调用 services，映射错误。无业务逻辑。
- **Services 层**（`services/`）：业务逻辑、校验、SQLx 查询、DB 行 → API 类型转换。仅被 Routes 调用。
- **Infrastructure 层**（`db.rs`、`auth.rs`、`config.rs`、`error.rs`）：数据库连接池、迁移、JWT、凭据管理、统一错误。

依赖方向自上而下（Pages → Data → Types；Routes → Services → DB），无循环依赖。

## 5. 关键抽象

- **AppState**：`Arc<AppState>` 持有 `PgPool` + `Config`，经 axum 提取器注入所有 handler。
- **ServiceError**：`src/error.rs` 定义业务错误（400 中文消息）与 DB 错误（500 通用消息）的映射。
- **PageRenderer**：`type PageRenderer = (context: PageRenderContext) => string`，所有页面渲染函数签名。
- **Fingerprint Change Detection**：从关键字段构建确定性字符串，对比当前/新指纹判断远程数据是否变化，避免不必要重渲染。
- **require_admin 守卫**：`AdminAuth` FromRequestParts 提取器（body 消费前鉴权），失败返回 401 `{error:'Unauthorized'}`。

## 6. 关键数据流

### 6.1 公开页面渲染（/blog/:slug）

1. 浏览器导航 → `main.ts` `resolveRoute()` 匹配路由 → 调用 `renderPostDetailPage(context)` 渲染（可能先展示本地缓存）
2. `setupPublicDataHydration()` 发起 `fetchPostDetail(slug)` → `GET /api/posts/:slug`
3. 后端 `get_published_post_by_slug()` SQLx JOIN posts + tags → `ApiPostDetail`
4. `applyRemotePostDetail()` 计算指纹对比本地缓存，变化则重新渲染

### 6.2 管理认证

1. `/admin/login` → `adminLogin(username, password)` → `POST /api/admin/auth/login`
2. 后端 `login()` → argon2 verify → 签发 HS256 JWT（默认 24h）
3. 前端 `localStorage.setItem('shino.admin.token', token)` → 跳转 `/admin/posts` → `setupAdminDashboard()` 初始化管理模块

### 6.3 搜索

1. 客户端本地搜索优先（`searchPosts()` 扫缓存文章列表）
2. 远程搜索 `GET /api/search?q=...` → PG tsvector（simple 配置，前缀 OR 匹配）
3. 多因子排序：文本相关性（ts_rank 归一化）50% + 时间衰减 25%（半衰期 365 天）+ 内容质量 15%（浏览/点赞/评论，0.4/0.4/0.2 归一化）
4. `ts_headline` 生成 `<mark>` 高亮摘要；搜索异常时降级 LIKE 查询

## 7. 状态管理

- **后端**：无状态 HTTP，无内存会话。JWT 自包含。PgPool 为唯一共享资源。
- **前端**：模块级可变缓存（`remotePublishedPostCache`、`remotePublishedPostFingerprint`、`remoteSiteConfigOverride` 等），无集中 store；SPA 导航用 `window.history` + 自定义 `__appNavIndex` 状态键，`popstate` 驱动重渲染。

## 8. 架构约束

- 后端无状态、连接池化（PgPool），为多实例/异地部署预留
- 时间戳统一 TEXT ISO8601 存储（保持迁移前格式，避免时区位移）
- 错误响应统一 `{ error: string }`；DB 错误不泄露内部消息（500 通用文案）
- 前端无循环依赖；各 data 模块独立缓存
- 管理后台破坏性操作（删除/下线）使用样式化 dialog（`confirmAdminAction`），不新增原生 `window.confirm`

## 9. 已知技术债务（2026-08-12 处理后状态）

- ~~**单体 main.ts**~~：已拆分（08-12-tech-debt-architecture/main-split）——动效 → `features/motion.ts`，外壳 → `components/shell.ts`，页面增强按宿主页分发 `features/{post-detail,tags,posts,archive,friends}.ts`，main.ts 收尾为 ~260 行 bootstrap + 增强表 + 全局事件代理。
- **前后端类型重复定义**：后端 `models.rs` 与前端 `types/api.ts` 独立维护、形状需手动同步。已加测试防线：`tests/api_compat.rs::public_response_shapes_match_frontend_types_contract`（响应键集 ⊆ 契约）与 `frontend/src/__fixtures__/contract.test.ts`（契约键 ⊆ 夹具）双向锁定；方向不变（共享契约/OpenAPI 仍为长期选项，未落地）。
- ~~**Rust 服务响应时间戳**~~：已关闭（2026-08-12 核验）——`now_iso()` 即 `to_rfc3339_opts(Millis)`，与 JS `toISOString()` 同格式且同时用于 `published_at`，前端不消费 `/health`；秒级仅为旧 Elysia 历史，统一格式是合理现状。
- ~~**syntect 代码高亮未引入**~~：方向改为**客户端 hljs**（08-12-tech-debt-architecture/client-hljs）——后端 `markdown.rs` 维持 `<pre data-language><code class="hljs language-x">` 标记，前端 `features/post-detail.ts` 挂 `hljs.highlightElement`（core + js/ts/rust/json/bash/xml/css 按需注册），`styles/components/markdown.css` 提供 hljs 主题色；syntect 因类名与 hljs 不兼容被否决。
