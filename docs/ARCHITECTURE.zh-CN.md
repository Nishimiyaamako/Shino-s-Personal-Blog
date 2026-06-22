# Shino's Bolg 架构总览

> 分析日期：2026-06-22 | 基于源码分析与已有架构文档整合

---

## 1. 项目概览

**Shino's Bolg**（注意：Bolg 为有意拼写）是一个全栈个人博客系统，采用前后端分离架构。

| 维度 | 说明 |
|------|------|
| **项目类型** | 全栈个人博客 |
| **仓库结构** | Monorepo（`frontend/` + `backend/`） |
| **包管理** | Bun |
| **开发语言** | TypeScript 5.9 |
| **运行时** | Bun（后端）+ 浏览器（前端） |
| **前端** | Vite 7.2 + Vanilla TypeScript SPA（无框架） |
| **后端** | Elysia.js 1.4 + Drizzle ORM + SQLite |
| **认证** | JWT（HS256，jose 库） |
| **内容格式** | Markdown（marked + sanitize-html / DOMPurify） |
| **搜索** | SQLite FTS5 全文搜索 + BM25 评分 |

---

## 2. 系统架构总览

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            浏览器 (Browser SPA)                               │
│  frontend/src/main.ts                                                         │
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
│  │  服务层 (Services) - 业务逻辑                                            ││
│  │  posts.ts  search.ts  markdown.ts  about.ts  friends.ts                  ││
│  │  profile.ts  media.ts  site-config.ts                                    ││
│  ├───────────────────────────────────────────────────────────────────────────┤│
│  │  基础设施                                                                  ││
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
- 前后端 **无共享代码**，通信完全基于 HTTP + JSON
- 前端为纯 Vanilla SPA，页面渲染函数返回 HTML 字符串
- 后端使用原始 SQL 查询为主（尽管有 Drizzle ORM 定义 schema）
- 管理后台认证基于 JWT Bearer Token，存储在浏览器 localStorage

---

## 3. 技术栈

### 前端

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 构建工具 | Vite | 7.2 | 开发服务器 + 生产构建 + API 代理 |
| 语言 | TypeScript | 5.9 | 所有源码 |
| 运行时 | 浏览器 | — | 客户端 SPA |
| Markdown 渲染 | marked | 17.0 | 文章内容 Markdown → HTML |
| XSS 防护 | DOMPurify | 3.3 | 客户端 HTML 净化 |
| 图标 | @iconify/iconify | 3.1 | 名片卡联系人平台图标 |
| SPA 框架 | 无 (Vanilla TS) | — | 手动 DOM 渲染，无 React/Vue/Svelte |

### 后端

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| HTTP 框架 | Elysia.js | 1.4 | 路由、中间件、请求生命周期 |
| ORM | Drizzle ORM | 0.44 | 数据库表定义（schema 层） |
| 数据库 | SQLite | — | 关系型数据存储（WAL 模式） |
| JWT | jose | 6.1 | HS256 签名/验证 |
| 密码处理 | Bun.password | — | 管理员密码哈希与验证 |
| Markdown 渲染 | marked | 17.0 | 服务端 Markdown → HTML |
| 代码高亮 | highlight.js | 11.11 | 代码块语法高亮 |
| HTML 净化 | sanitize-html | 2.17 | 服务端 HTML 净化 |
| Markdown 高亮集成 | marked-highlight | 2.2 | marked 与 highlight.js 桥接 |
| 前置元数据解析 | gray-matter | 4.0 | Markdown frontmatter 解析 |
| CORS | @elysiajs/cors | 1.4 | 跨域请求支持 |

### 运维 / 部署

| 类别 | 技术 | 用途 |
|------|------|------|
| 进程管理 | PM2 | 生产环境后端进程守护 |
| 反向代理 | Nginx | SSL 终结 + API 路由转发 |
| 管理面板 | 1Panel | 服务器网站/进程管理 |
| 测试 | Bun Test | 后端 API 集成测试 |

---

## 4. 目录结构

```
[项目根目录]/
├── frontend/                        # Vite + TypeScript Vanilla SPA
│   ├── index.html                   # HTML 入口
│   ├── vite.config.ts               # Vite 配置（代理 /api /uploads 到 :3001）
│   ├── tsconfig.json
│   ├── package.json
│   ├── bun.lock
│   ├── public/images/               # 静态资源（图标、默认头像等）
│   └── src/
│       ├── main.ts                  # 应用入口（路由 + 功能初始化 + 动效系统）
│       ├── router/index.ts          # 路由表 (ROUTE_RECORDS) + 路由解析
│       ├── pages/                   # 页面模板（纯函数，返回 HTML 字符串）
│       │   ├── home.ts              # 首页
│       │   ├── posts.ts             # 文章列表
│       │   ├── post-detail.ts       # 文章详情
│       │   ├── tags.ts              # 标签总览
│       │   ├── tag-detail.ts        # 标签筛选
│       │   ├── archive.ts           # 归档
│       │   ├── friends.ts           # 友链
│       │   ├── about.ts             # 关于页
│       │   ├── admin.ts             # 管理后台壳
│       │   ├── admin-login.ts       # 管理登录页
│       │   └── not-found.ts         # 404
│       ├── features/                # 运行时行为绑定（事件监听、DOM 交互）
│       │   ├── admin.ts             # 管理功能入口分发
│       │   ├── public-runtime.ts    # 公开页面入口
│       │   └── admin/               # 管理模块（按功能拆分）
│       │       ├── login.ts         # 登录表单
│       │       ├── dashboard.ts     # 管理仪表板
│       │       ├── posts.ts         # 文章管理
│       │       ├── friends.ts       # 友链管理
│       │       ├── media.ts         # 媒体管理
│       │       ├── site-settings.ts # 站点设置
│       │       ├── content-settings.ts # 内容设置
│       │       ├── shared.ts        # 共享工具
│       │       └── avatar-crop.ts   # 头像裁剪
│       ├── data/                    # API 调用 + 客户端数据编排
│       │   ├── api.ts               # 所有 fetch 调用 + Token 管理
│       │   ├── posts.ts             # 文章数据缓存 + 指纹对比
│       │   ├── about.ts             # 关于页数据
│       │   ├── friends.ts           # 友链数据
│       │   ├── profile-card.ts      # 名片卡数据
│       │   ├── site-config.ts       # 站点配置数据
│       │   └── platform-presets.ts  # 联系人平台图标定义
│       ├── components/              # 可复用 UI 组件
│       │   ├── post-list.ts         # 文章列表组件
│       │   └── profile-card.ts      # 名片卡组件
│       ├── types/                   # 前端类型定义
│       ├── config/                  # 站点配置、主题色板
│       ├── utils/                   # 工具函数（日期、转义、DOM 样式）
│       └── styles/                  # CSS 文件（按关注点组织）
│
├── backend/                         # Elysia.js + SQLite + Drizzle
│   ├── package.json
│   ├── tsconfig.json
│   ├── bun.lock
│   ├── ecosystem.config.js          # PM2 生产配置
│   ├── start.sh                     # 生产启动脚本
│   ├── data/                        # SQLite 数据库文件（Git 忽略）
│   ├── uploads/images/              # 上传的图片（Git 忽略）
│   └── src/
│       ├── index.ts                 # 服务入口（监听端口）
│       ├── app.ts                   # Elysia 应用装配（CORS → 路由 → 静态文件）
│       ├── routes/                  # HTTP 路由（薄层，委托给 services）
│       │   ├── public.ts            # 公开 API (/api/*)
│       │   ├── admin.ts             # 管理 API (/api/admin/*)
│       │   └── helpers.ts           # 认证守卫 + JSON 解析 + 错误格式化
│       ├── services/                # 业务逻辑层
│       │   ├── posts.ts             # 文章 CRUD、发布/取消、精选切换
│       │   ├── search.ts            # FTS5 搜索 + 多因子排序
│       │   ├── markdown.ts          # marked 渲染 + highlight.js + sanitize
│       │   ├── about.ts             # 关于页 CRUD
│       │   ├── friends.ts           # 友链 CRUD
│       │   ├── profile.ts           # 名片卡 + 联系方式
│       │   ├── media.ts             # 图片上传 + 孤立文件检测
│       │   └── site-config.ts       # 站点全局配置 CRUD
│       ├── db/                      # 数据库层
│       │   ├── client.ts            # SQLite 连接（WAL / foreign_keys）
│       │   ├── schema.ts            # Drizzle ORM 表定义（10 张表）
│       │   ├── migrate.ts           # 原始 SQL 迁移脚本
│       │   └── search-index.ts      # FTS5 搜索索引管理
│       ├── auth/                    # 认证层
│       │   ├── jwt.ts               # JWT HS256 签发/验证
│       │   └── admin.ts             # 管理员密码验证 + 默认用户播种
│       ├── config/env.ts            # 环境变量读取与类型化
│       ├── scripts/                 # CLI 脚本
│       │   ├── seed.ts              # 数据库播种
│       │   ├── migrate.ts           # 迁移运行器
│       │   └── import-from-frontend.ts # 从旧前端目录导入数据
│       ├── types/api.ts             # API 请求/响应类型
│       └── __tests__/api.test.ts    # API 集成测试
│
├── .planning/codebase/              # 协作基准文档（GDocs）
│   ├── ARCHITECTURE.md              # 系统架构分析
│   ├── STACK.md                     # 技术栈
│   ├── STRUCTURE.md                 # 目录结构与命名规范
│   ├── CONVENTIONS.md               # 编码规范
│   ├── CONCERNS.md                  # 关注点与风险
│   ├── INTEGRATIONS.md              # 集成说明
│   └── TESTING.md                   # 测试指南
│
├── deploy/                          # 部署配置
│   ├── 1panel-backend-deploy.md     # 后端部署指南
│   ├── 1panel-static-deploy.md      # 前端静态部署指南
│   ├── nginx/                       # Nginx 反向代理配置
│   ├── scripts/                     # 部署自动化脚本
│   └── post-release-checklist.md    # 发布后检查清单
│
├── plans/                           # 历史实现计划归档
├── CLAUDE.md                        # Claude Code 项目指令（含路由/API 地图）
└── .gitignore
```

---

## 5. 数据库设计

数据库使用 SQLite（WAL 模式），通过 Drizzle ORM 定义 schema，共 **10 张表**。

### 5.1 ER 概览

```
admin_users ─── (独立，单用户模式)
posts ───(1:N)─── post_tags ───(N:1)─── tags
posts ───(1:N)─── media_assets (隐式关联，通过文件名)
friend_links ─── (独立)
about_page ─── (单行表，id=1)
profile_card ───(1:N)─── profile_contacts
site_config ─── (单行表，id=1)
```

### 5.2 表结构

#### admin_users（管理员用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `username` | TEXT NOT NULL | 管理员用户名（唯一索引） |
| `password_hash` | TEXT NOT NULL | Bun.password 哈希值 |
| `created_at` | TEXT NOT NULL | 创建时间 |

#### posts（文章）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `title` | TEXT NOT NULL | 文章标题 |
| `slug` | TEXT NOT NULL | URL 安全的唯一标识（唯一索引） |
| `date` | TEXT NOT NULL | 文章日期（YYYY-MM-DD） |
| `summary` | TEXT NOT NULL | 摘要 |
| `theme` | TEXT | 主题（可选） |
| `cover_image_url` | TEXT | 封面图 URL（可选） |
| `content_markdown` | TEXT NOT NULL | Markdown 原文 |
| `content_html` | TEXT NOT NULL | 渲染后的 HTML（服务端预渲染） |
| `status` | TEXT NOT NULL | 状态：`draft` / `published` |
| `is_featured` | BOOLEAN | 是否精选（默认 false） |
| `featured_order` | INTEGER | 精选排序（可选） |
| `view_count` | INTEGER | 浏览数（默认 0） |
| `like_count` | INTEGER | 点赞数（默认 0） |
| `comment_count` | INTEGER | 评论数（默认 0） |
| `created_at` | TEXT NOT NULL | 创建时间 |
| `updated_at` | TEXT NOT NULL | 更新时间 |
| `published_at` | TEXT | 发布时间（可选） |

#### tags（标签）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `name` | TEXT NOT NULL | 标签名（唯一索引，小写+连字符格式） |

#### post_tags（文章-标签关联）

| 字段 | 类型 | 说明 |
|------|------|------|
| `post_id` | INTEGER NOT NULL | 文章 ID（联合主键） |
| `tag_id` | INTEGER NOT NULL | 标签 ID（联合主键） |

#### media_assets（媒体资源）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `file_name` | TEXT NOT NULL | 文件名 |
| `mime_type` | TEXT NOT NULL | MIME 类型 |
| `size` | INTEGER NOT NULL | 文件大小（字节） |
| `url` | TEXT NOT NULL | 访问 URL（唯一索引） |
| `created_at` | TEXT NOT NULL | 上传时间 |

#### friend_links（友链）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `name` | TEXT NOT NULL | 站点名称 |
| `description` | TEXT NOT NULL | 描述 |
| `avatar` | TEXT NOT NULL | 头像 URL |
| `url` | TEXT NOT NULL | 链接地址 |
| `enabled` | BOOLEAN | 是否启用（默认 true） |
| `display_order` | INTEGER | 显示排序（默认 0） |
| `created_at` | TEXT NOT NULL | 创建时间 |
| `updated_at` | TEXT NOT NULL | 更新时间 |

#### about_page（关于页）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 主键（固定为 1） |
| `markdown` | TEXT NOT NULL | Markdown 内容 |
| `updated_at` | TEXT NOT NULL | 更新时间 |

#### profile_card（名片卡）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 主键（固定为 1） |
| `name` | TEXT NOT NULL | 显示名称 |
| `bio` | TEXT NOT NULL | 简介 |
| `avatar` | TEXT NOT NULL | 头像 URL |
| `updated_at` | TEXT NOT NULL | 更新时间 |

#### profile_contacts（联系方式）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `profile_card_id` | INTEGER NOT NULL | 关联名片卡（默认 1） |
| `platform` | TEXT NOT NULL | 平台标识（如 github、twitter） |
| `label` | TEXT NOT NULL | 显示标签 |
| `href` | TEXT NOT NULL | 链接地址 |
| `display_order` | INTEGER | 显示排序（默认 0） |

#### site_config（站点配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 主键（固定为 1） |
| `site_title` | TEXT NOT NULL | 站点标题（默认 "ShinoLog"） |
| `site_subtitle` | TEXT NOT NULL | 副标题（默认空） |
| `copyright_owner` | TEXT NOT NULL | 版权所有人（默认 "NagaShino"） |
| `powered_by` | TEXT NOT NULL | 底部 Powered by 声明 |
| `icp_record_text` | TEXT | ICP 备案号 |
| `icp_record_url` | TEXT | ICP 备案链接 |
| `public_security_record_text` | TEXT | 公安备案号 |
| `public_security_record_url` | TEXT | 公安备案链接 |
| `friend_link_template` | TEXT | 友链申请模板 |
| `updated_at` | TEXT NOT NULL | 更新时间 |

---

## 6. 前端路由映射

所有路由定义在 `frontend/src/router/index.ts` 中的 `ROUTE_RECORDS` 数组，采用手动路径匹配（非 History API 路由库）。

### 6.1 公开页面路由

| 路由 | 页面标题 | 渲染函数 |
|------|----------|----------|
| `/` | 首页 | `renderHomePage` |
| `/posts` | 文章列表 | `renderPostsPage` |
| `/posts/:slug` | 文章详情 | `renderPostDetailPage` |
| `/tags` | 标签总览 | `renderTagsPage` |
| `/tags/:tag` | 标签详情 | `renderTagDetailPage` |
| `/archive` | 归档 | `renderArchivePage` |
| `/friends` | 友链 | `renderFriendsPage` |
| `/about` | 关于 | `renderAboutPage` |
| `/404` | 404 | `renderNotFoundPage` |

### 6.2 管理后台路由

| 路由 | 页面标题 | 管理模块 |
|------|----------|----------|
| `/admin/login` | 后台登录 | 登录表单 |
| `/admin` | 内容管理 | 文章管理 |
| `/admin/posts` | 文章管理 | 文章 CRUD |
| `/admin/featured` | 精选管理 | 精选文章配置 |
| `/admin/friends` | 友链管理 | 友链 CRUD |
| `/admin/about` | 关于页 | 关于页编辑 |
| `/admin/profile` | 名片卡 | 名片卡编辑 |
| `/admin/media` | 媒体管理 | 图片上传与管理 |
| `/admin/settings` | 站点设置 | 站点配置 |

### 6.3 主导航

| 标签 | 链接 | 图标 |
|------|------|------|
| 首页 | `/` | home |
| 文章 | `/posts` | posts |
| 标签 | `/tags` | tags |
| 归档 | `/archive` | archive |
| 友链 | `/friends` | friends |
| 关于 | `/about` | about |

---

## 7. API 路由清单

后端路由分为两大组：**公开 API**（`/api/*`，无需认证）和**管理 API**（`/api/admin/*`，需 Bearer JWT 认证）。

### 7.1 公开 API

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/api/health` | 健康检查 | 无 |
| `GET` | `/api/posts` | 分页获取已发布文章列表 | `?page=1&pageSize=20&tag=` |
| `GET` | `/api/posts/:slug` | 获取文章详情 | slug（路径参数） |
| `GET` | `/api/home/featured` | 获取精选文章 | `?limit=5` |
| `GET` | `/api/friend-links` | 获取公开友链列表 | 无 |
| `GET` | `/api/about` | 获取关于页内容 | 无 |
| `GET` | `/api/profile-card` | 获取名片卡数据 | 无 |
| `GET` | `/api/site-config` | 获取站点配置 | 无 |
| `GET` | `/api/search` | 全文搜索 | `?q=关键词&limit=10` |

### 7.2 管理 API（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/auth/login` | 管理员登录 |
| `GET` | `/api/admin/posts` | 获取所有文章（含草稿） |
| `POST` | `/api/admin/posts` | 创建文章 |
| `PATCH` | `/api/admin/posts/:id` | 更新文章 |
| `DELETE` | `/api/admin/posts/:id` | 删除文章 |
| `POST` | `/api/admin/posts/:id/publish` | 发布文章 |
| `POST` | `/api/admin/posts/:id/unpublish` | 取消发布 |
| `PATCH` | `/api/admin/posts/:id/featured` | 切换精选状态 |
| `POST` | `/api/admin/uploads/image` | 上传图片 |
| `DELETE` | `/api/admin/uploads` | 删除媒体资源（`?url=`） |
| `GET` | `/api/admin/uploads` | 获取媒体资源列表 |
| `GET` | `/api/admin/friend-links` | 获取所有友链 |
| `POST` | `/api/admin/friend-links` | 创建友链 |
| `PATCH` | `/api/admin/friend-links/:id` | 更新友链 |
| `DELETE` | `/api/admin/friend-links/:id` | 删除友链 |
| `GET` | `/api/admin/about` | 获取关于页内容 |
| `PATCH` | `/api/admin/about` | 更新关于页 |
| `GET` | `/api/admin/profile-card` | 获取名片卡 |
| `PATCH` | `/api/admin/profile-card` | 更新名片卡 |
| `GET` | `/api/admin/site-config` | 获取站点配置 |
| `PATCH` | `/api/admin/site-config` | 更新站点配置 |
| `POST` | `/api/admin/search/rebuild` | 重建搜索索引 |

### 7.3 静态文件

| 路径 | 说明 |
|------|------|
| `GET /uploads/images/:fileName` | 访问上传的图片（文件名正则校验） |

---

## 8. 关键数据流

### 8.1 公开页面渲染流程

```
浏览器导航到 /posts/:slug
  │
  ├─ main.ts → resolveRoute(pathname)
  │   └─ 路由匹配成功 → 调用页面的 render 函数
  │       └─ renderPostDetailPage(context)
  │           ├── 可能展示本地缓存数据（若有）
  │           └── 返回 HTML 字符串
  │
  ├─ main.ts → setupPublicDataHydration()
  │   └─ fetchPostDetail(slug) → GET /api/posts/:slug
  │       ├── 后端: getPublishedPostBySlug()
  │       │   └─ 原始 SQL JOIN posts + tags → ApiPostDetail
  │       ├── 返回 JSON
  │       └── 前端: applyRemotePostDetail()
  │           ├── 计算指纹（内容哈希）
  │           ├── 对比本地缓存指纹
  │           └── 若指纹变化 → 重新渲染页面
  │
  └─ 渲染完成
```

### 8.2 管理认证流程

```
浏览器导航到 /admin/login
  │
  ├─ renderAdminLoginPage() → 渲染登录表单 HTML
  ├─ setupAdminLogin() → 绑定提交事件
  │
  ├─ 用户提交表单
  │   ├── adminLogin(username, password) → POST /api/admin/auth/login
  │   ├── 后端: verifyAdminCredentials()
  │   │   └─ Bun.password.verify(输入的密码, 哈希值)
  │   ├── 验证成功 → signAdminToken()
  │   │   └─ 签发 HS256 JWT（有效时长默认 24 小时）
  │   ├── 返回 { token, user }
  │   └── 前端: localStorage.setItem('shino.admin.token', token)
  │
  ├─ 跳转到 /admin/posts
  └─ setupAdminDashboard() → 检查 Token → 初始化管理模块
```

### 8.3 搜索流程

```
用户在搜索框输入关键词
  │
  ├─ 客户端本地搜索（优先）
  │   └─ searchPosts() 在缓存的文章列表中查找
  │
  ├─ 远程搜索（可选）
  │   └─ GET /api/search?q=关键词&limit=10
  │       └─ 后端: searchPublishedPosts()
  │           ├── FTS5 虚拟表查询 → BM25 文本相关性评分
  │           ├── 多因子排序:
  │           │   ├── 文本相关性 (50%) — BM25 分数
  │           │   ├── 时间衰减 (25%) — 新文章得分更高
  │           │   ├── 内容质量 (15%) — 浏览/点赞/评论数
  │           │   └── 权威性 (10%) — 精选标记
  │           └── FTS5 snippet() 生成高亮摘要（<mark> 标签）
  │
  └─ FTS 异常时 → 降级为 SQLite LIKE 查询
```

---

## 9. 关键设计模式

### 9.1 PageRenderer 模式

前端页面渲染的核心抽象：每个页面导出一个 **纯函数**，接收 `PageRenderContext`（包含路径参数和当前 pathname），返回完整 HTML 字符串。

```
类型签名: type PageRenderer = (context: PageRenderContext) => string
```

页面函数 **无副作用**、**无事件绑定**。所有交互逻辑在 `features/` 层通过 **hydration** 挂载。

### 9.2 指纹变化检测（Fingerprint-based Cache Busting）

前端数据层通过比较「内容指纹」来判断远程数据是否变化，避免不必要的重新渲染。

```
buildPostFingerprint(post):
  从关键字段（title + slug + contentHTML + tags 等）构建确定性字符串
  → 对比本地缓存的指纹
  → 若变化，触发重新渲染
  → 若未变化，保持当前 DOM
```

### 9.3 服务层架构（Routes → Services → DB）

后端采用三层分层：

| 层 | 职责 | 文件 |
|------|------|------|
| **Routes** | 薄的 HTTP 处理器：解析请求参数、调用服务、格式化响应和错误 | `routes/public.ts`、`routes/admin.ts` |
| **Services** | 业务逻辑：原始 SQL 查询、数据校验、DB 行 → API 类型转换 | `services/*.ts` |
| **DB** | SQLite 连接、Drizzle schema 定义、迁移、FTS5 索引 | `db/*.ts` |

路由层不包含任何业务逻辑，所有数据库访问在服务层完成。

### 9.4 requireAdmin 守卫

管理端点的认证检查通过 `requireAdmin()` 函数实现，在 **每个管理路由处理函数开头** 调用：

```
const admin = await requireAdmin(request, set);
if (!admin) return { error: 'Unauthorized' };
```

注意：这不是 Elysia 中间件/插件机制，而是一个可复用的异步函数。直接从请求头提取 Bearer Token，调用 JWT 验证，返回管理员用户或设置 401 状态。

### 9.5 原始 SQL 为主的查询策略

尽管使用 Drizzle ORM 定义数据库表结构，后端 **大多数查询使用原始 SQL**：

```typescript
context.sqlite.query(`
  SELECT p.*, GROUP_CONCAT(t.name) AS tags
  FROM posts p
  LEFT JOIN post_tags pt ON p.id = pt.post_id
  LEFT JOIN tags t ON pt.tag_id = t.id
  WHERE p.status = 'published'
  GROUP BY p.id
`);
```

原因：复杂的 JOIN 和聚合查询用 Drizzle 查询构建器写起来冗长，原始 SQL 更简洁。

---

## 10. 认证与安全

### 10.1 认证机制

| 维度 | 实现 |
|------|------|
| **Token 类型** | JWT，HS256 算法（jose 库） |
| **Token 存储** | 浏览器 `localStorage`，键名 `shino.admin.token` |
| **Token 过期** | 可配置，默认 24 小时（环境变量 `ADMIN_JWT_EXPIRES_HOURS`） |
| **传输方式** | HTTP Header: `Authorization: Bearer <token>` |
| **刷新机制** | 无（单 Token 模式，过期后重新登录） |
| **密码哈希** | Bun.password（内置密码哈希 API） |

### 10.2 管理员用户管理

- 首次启动时从环境变量 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 自动播种默认管理员
- 若环境变量中的密码与数据库中的密码不同，自动更新（热密码轮换）
- 单用户模式，不支持多管理员

### 10.3 XSS 防护

| 端 | 机制 | 库 |
|------|------|------|
| 服务端 | 渲染 Markdown → HTML 后净化 | `sanitize-html` |
| 客户端 | 渲染 Markdown → HTML 后净化 | `DOMPurify` |

两层防御，即使服务端净化被绕过，客户端仍会捕获。

### 10.4 其他安全措施

- 上传文件名：正则校验 `/^[A-Za-z0-9._-]+$/`，拒绝路径遍历
- 跨域：CORS 配置 `origin: true` + `credentials: true`
- Slug 校验：正则 `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`，拒绝特殊字符

---

## 11. 部署拓扑

### 11.1 生产架构

```
互联网 (HTTPS)
  │
  ▼
┌─────────────────────────────────┐
│  Nginx (反向代理 + SSL 终结)     │
│  ┌─────────────────────────────┐│
│  │  /api/*       → backend :3001  ││
│  │  /uploads/*   → backend :3001  ││
│  │  其他所有请求  → 静态文件目录  ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
          │                    │
          ▼                    ▼
┌──────────────┐    ┌──────────────────────────┐
│  PM2 进程     │    │  静态文件目录              │
│  shino-blog-  │    │  /opt/shino-blog/         │
│  backend      │    │  frontend-dist/           │
│  (bun)        │    │                           │
├──────────────┤    └──────────────────────────┘
│  SQLite       │
│  /opt/shino-  │
│  blog/data/   │
│  blog.sqlite  │
├──────────────┤
│  上传文件      │
│  /opt/shino-  │
│  blog/uploads/│
└──────────────┘
```

### 11.2 服务器目录规范

```
/opt/shino-blog/
├── backend/          # 后端代码（PM2 运行）
├── data/             # SQLite 数据库文件
├── uploads/          # 上传资源（含 images/ 子目录）
├── env/              # 环境变量文件
├── logs/             # PM2 日志
├── backups/          # 备份归档
└── frontend-dist/    # 前端构建产物（Nginx 静态服务）
```

### 11.3 管理系统

- 使用 **1Panel** 面板管理网站配置和 PM2 进程
- Nginx 配置文件通过 1Panel 网站配置界面管理
- 前端为「静态站点」类型，挂载 `frontend-dist/` 目录

### 11.4 本地开发拓扑

```
浏览器
  │
  ├─ blog.local.test  ──→ 本地反向代理
  └─ admin.local.test ──→ 本地反向代理
                              │
                              ▼
                      Vite 开发服务器 (localhost:5173)
                              │
                    /api, /uploads → 代理转发
                              │
                              ▼
                      Elysia 后端 (localhost:3001)
```

---

## 12. 已知技术债务（反模式）

项目中存在一些已知的架构问题，记录在 `.planning/codebase/ARCHITECTURE.md` 中：

### 12.1 单体 main.ts

`frontend/src/main.ts` 约 **3400 行**，混合了 SPA 外壳渲染、路由调用、动效系统、搜索模态框、事件代理、历史管理、页面增强编排等功能。单一文件难以测试和维护。

**建议方向**：将动效系统提取到 `features/motion.ts`，将外壳渲染组件提取到 `components/shell.ts`。

### 12.2 Drizzle + 原始 SQL 混用

后端的 Drizzle schema 定义和原始 SQL 查询并存，查询中大量手动列别名（如 `cover_image_url AS coverImageUrl`），schema 变更时需手动搜索所有原始 SQL 字符串。

**建议方向**：全面采用 Drizzle 查询构建器，或移除 Drizzle 完全使用原始 SQL。

### 12.3 前后端类型重复定义

API 响应类型在 `backend/src/types/api.ts` 和 `frontend/src/types/api.ts` 中独立维护，形状相似但不完全一致，变更时需手动同步。

**建议方向**：提取共享类型到 `packages/shared-types/` 工作区。

---

## 附录：开发命令速查

```bash
# 后端开发
cd backend && bun run dev     # 启动后端（默认 127.0.0.1:3001）

# 前端开发
cd frontend && bun run dev    # 启动 Vite（默认 127.0.0.1:5173）

# 全量质量门（提交前运行）
cd backend && bun run typecheck && bun run test && bun run build && \
cd ../frontend && bun run typecheck && bun run build

# 数据库操作
cd backend && bun run migrate # 运行数据库迁移
cd backend && bun run seed    # 填充初始数据
```
