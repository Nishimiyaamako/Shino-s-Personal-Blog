# Shino's Bolg 项目结构说明（中文注释版）

本文档用于集中说明当前仓库结构、关键目录职责与前后端边界。

## 0) 维护约定

- 结构变更（新增/删除/重命名关键目录或文件）后，同步更新本文档。
- 本文件当前状态已同步至：**2026-04-02（清理过期“后端占位”描述）**。
- 项目正式名称保持为：**`Shino's Bolg`**。

## 1) 当前目录树（精简注释版）

```text
.
├─ CLAUDE.md                                  # 给 Claude Code 的项目协作说明（已对齐真实架构）
├─ PROJECT_STRUCTURE.zh-CN.md                 # 本文件
├─ frontend/                                  # 前端工程（Vite + TypeScript + Vanilla SPA）
│  ├─ .env.example                            # 前端环境变量示例（dev proxy / API base）
│  ├─ index.html
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ vite.config.ts                          # Vite dev 代理：/api 与 /uploads
│  ├─ public/
│  │  └─ images/covers/                       # 封面图静态资源
│  └─ src/
│     ├─ main.ts                              # SPA 入口（App Shell、路由切换、页面增强）
│     ├─ router/index.ts                      # 路由表（含 /admin/login、/admin）
│     ├─ pages/                               # 页面渲染模块
│     ├─ features/                            # 运行时行为（public hydration / admin 交互）
│     ├─ components/                          # 可复用渲染片段
│     ├─ data/                                # API 调用、内容解析、视图模型
│     ├─ types/                               # 领域类型
│     ├─ config/                              # 站点配置、主题配置
│     ├─ utils/                               # 工具函数
│     ├─ styles/                              # 样式分层（tokens/base/layout/content/posts/motion）
│     └─ content/                             # 本地 Markdown 内容源（posts/about）
├─ backend/                                   # 后端工程（Elysia + Drizzle + SQLite + JWT）
│  ├─ package.json
│  └─ src/
│     ├─ index.ts                             # 后端启动入口
│     ├─ app.ts                               # 应用组装（CORS、uploads、public/admin routes）
│     ├─ config/env.ts                        # 环境变量与默认端口（PORT=3001）
│     ├─ routes/                              # API 路由层（public/admin/helpers）
│     ├─ services/                            # 业务服务层（posts/friends/about/profile/media/search）
│     ├─ auth/                                # 认证（admin 用户、JWT）
│     ├─ db/                                  # SQLite + Drizzle schema/migrate/search-index
│     ├─ scripts/                             # migrate/seed/import-from-frontend
│     ├─ types/                               # API 类型
│     └─ __tests__/api.test.ts                # 后端 API 测试
├─ docs/
│  ├─ blueprint.md                            # 项目蓝图（历史规划文档）
│  ├─ content-spec.md                         # Markdown/frontmatter 协议
│  └─ ai-workflow/                            # AI 协作文档基线
│     ├─ MEMORY.md                            # 项目长期记忆
│     ├─ STOP_HOOKS.md                        # 停止点检查规则
│     ├─ README.md                            # 工作流说明与运行手册
│     └─ ARCHITECTURE.md                      # 域名/反代/端口拓扑与排障流程
└─ deploy/
   ├─ 1panel-static-deploy.md                 # 1Panel 部署指引
   ├─ nginx/1panel-static-spa-snippet.conf    # Nginx 片段（SPA + /api + /uploads）
   ├─ scripts/build-frontend-dist.sh          # 前端构建与打包脚本
   └─ artifacts/                              # 构建产物目录
```

## 2) 前端路由边界（当前契约）

- `/`
- `/posts`
- `/posts/:slug`
- `/tags`
- `/tags/:tag`
- `/archive`
- `/friends`
- `/about`
- `/admin/login`
- `/admin`
- `/404`

## 3) 后端 API 边界（当前已实现）

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

### Uploads 路径

- `GET /uploads/images/:fileName`

## 4) 运行链路（当前认知）

- 开发态：`Browser -> (可选本机反代) -> Vite:5173 -> Backend:3001`（`/api`、`/uploads` 由 Vite 代理）。
- 生产态：`Browser -> Nginx/1Panel -> SPA + Backend:3001`（`/api`、`/uploads` 由反代转发）。
- 后台入口建议使用独立子域名语义（例如 `admin.<domain>`），但后台页面仍在同一 SPA 内。

## 5) 本次清理说明（2026-04-02）

- 移除“backend scaffold/placeholder/暂不实现后台”旧描述。
- 路由边界补齐 `/admin/login` 与 `/admin`。
- API 边界改为“已实现接口”而非“规划接口”。
- 与 `docs/ai-workflow/*`（尤其 `ARCHITECTURE.md`）保持一致。
