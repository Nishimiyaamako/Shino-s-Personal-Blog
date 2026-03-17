# Personal Blog 项目结构说明（中文注释版）

本文档用于集中说明当前 v0 框架下每个目录和文件的用途。

## 0) 维护约定

- 只要工程结构发生变化（新增 / 删除 / 重命名目录或关键文件），就同步更新本文件。
- 本文件当前状态已同步至：**2026-03-17（新增动态背景换图与自动提色主题引擎）**。

## 1) 注释版目录树

```text
.
├─ .vscode/                                # 本地 IDE 配置（可选）
│  └─ launch.json                          # VS Code 调试配置
├─ # Personal Blog.md                         # 原始项目蓝图文档（保留）
├─ PROJECT_STRUCTURE.zh-CN.md                 # 本文件：项目结构中文注释总览
├─ frontend/                                  # 前端工程根目录
│  ├─ package.json                            # 前端包信息（依赖、脚本）
│  ├─ bun.lock                                # Bun 锁定文件（依赖版本快照）
│  ├─ node_modules/                           # 依赖安装目录（本地生成，通常不纳入版本控制）
│  │  └─ .bin/                                # 本地可执行脚本（如 vite、rollup、tsc）
│  ├─ dist/                                   # 前端构建产物目录（本地生成）
│  │  ├─ index.html                           # 构建后的入口 HTML
│  │  ├─ assets/                              # 构建后的静态资源（文件名带 hash）
│  │  └─ .gitkeep                             # 占位文件（若存在）
│  ├─ .gitignore                              # 前端忽略规则（node_modules/dist 等）
│  ├─ index.html                              # Vite 入口 HTML
│  ├─ tsconfig.json                           # TypeScript 编译配置
│  ├─ vite.config.ts                          # Vite 配置文件
│  ├─ public/                                 # 前端静态资源目录（无需构建直接提供）
│  │  ├─ .gitkeep                             # 空目录占位，确保 Git 跟踪目录
│  │  ├─ friends/                             # 友链页头像资源
│  │  │  ├─ astro.svg                         # 友链头像占位（A）
│  │  │  ├─ bun.svg                           # 友链头像占位（B）
│  │  │  └─ vercel.svg                        # 友链头像占位（V）
│  │  ├─ 神椿.png                              # 首页背景图静态资源（暖色调基准）
│  │  └─ 今汐-1.jpg                            # 首页背景图静态资源（动态换图候选）
│  └─ src/                                    # 前端源码目录
│     ├─ main.ts                              # 前端应用入口（SPA 启动、导航、渲染）
│     ├─ assets/
│     │  └─ .gitkeep                          # 图片、字体、图标等素材占位
│     ├─ components/
│     │  └─ .gitkeep                          # 可复用 UI 组件占位
│     ├─ pages/                               # 页面级渲染模块（路由页面）
│     │  ├─ .gitkeep                          # 目录占位
│     │  ├─ home.ts                           # 首页占位页
│     │  ├─ posts.ts                          # 文章列表页（自动扫描 Markdown）
│     │  ├─ post-detail.ts                    # 文章详情页（按 slug 渲染 Markdown）
│     │  ├─ tags.ts                           # 标签总览页占位
│     │  ├─ tag-detail.ts                     # 标签详情页占位（tag）
│     │  ├─ archive.ts                        # 归档页占位
│     │  ├─ friends.ts                        # 友链页（首版本地数据渲染）
│     │  ├─ about.ts                          # 关于页占位
│     │  └─ not-found.ts                      # 404 页面占位
│     ├─ router/
│     │  ├─ .gitkeep                          # 目录占位
│     │  └─ index.ts                          # 路由表、动态参数匹配与 404 兜底
│     ├─ styles/
│     │  ├─ .gitkeep                          # 目录占位
│     │  ├─ shell.css                         # 公共壳层样式（header/nav/content 基线）
│     │  ├─ shell.practice.css                # 公共壳层练习版（分区 TODO + 中文注释）
│     │  └─ shell.onboard.css                 # 首页引导版极简样式（基于背景图提取暖色）
│     ├─ theme/
│     │  └─ dynamic-theme.ts                  # 动态主题引擎（换图避重 + Canvas 提色 + 对比度兜底）
│     ├─ content/                             # 前端侧内容组织目录（Markdown）
│     │  ├─ posts/
│     │  │  ├─ .gitkeep                       # 目录占位
│     │  │  └─ Arch & Endeavouros安装配置.md  # 测试文章（Frontmatter + 正文）
│     │  └─ pages/
│     │     └─ .gitkeep                       # 静态页面 Markdown 占位
│     ├─ data/
│     │  ├─ .gitkeep                          # 本地数据缓存/映射占位
│     │  ├─ friends.ts                        # 友链本地数据（前端本地维护）
│     │  └─ posts.ts                          # Markdown 扫描/解析后输出文章数据
│     ├─ utils/
│     │  ├─ .gitkeep                          # 目录占位
│     │  └─ escape-html.ts                    # HTML 转义工具（动态参数输出安全）
│     ├─ types/
│     │  ├─ .gitkeep                          # 目录占位
│     │  └─ router.ts                         # 路由相关公共类型定义
│     └─ config/
│        └─ .gitkeep                          # 前端站点配置占位
├─ backend/                                   # 后端工程根目录（Elysia 最小 API）
│  ├─ package.json                            # 后端包信息（依赖与运行脚本）
│  ├─ bun.lock                                # 后端 Bun 锁定文件（依赖版本快照）
│  ├─ .gitignore                              # 后端忽略规则（node_modules）
│  └─ src/
│     ├─ index.ts                             # 后端入口（/api/health /api/stats）
│     ├─ routes/
│     │  └─ .gitkeep                          # API 路由占位
│     ├─ services/
│     │  └─ .gitkeep                          # 服务层占位
│     ├─ middleware/
│     │  └─ .gitkeep                          # 中间件占位
│     ├─ types/
│     │  └─ .gitkeep                          # 类型定义占位
│     └─ utils/
│        └─ .gitkeep                          # 工具函数占位
├─ docs/
│  ├─ blueprint.md                            # 项目蓝图副本（复制自 # Personal Blog.md）
│  ├─ content-spec.md                         # Markdown 内容规范（frontmatter/自动接入）
│  └─ ai-workflow/                            # AI 协作流程文档（记忆文件 + 停止点钩子）
│     ├─ MEMORY.md                            # 项目长期记忆主文件（前 200 行高信噪比）
│     ├─ STOP_HOOKS.md                        # Stop Hooks 规则（Codex 工作流约定版）
│     └─ README.md                            # 使用手册：流程回路、触发条件、收尾模板
└─ deploy/
   ├─ nginx/
   │  └─ .gitkeep                             # Nginx 配置占位
   └─ scripts/
      └─ .gitkeep                             # 部署脚本占位
```

## 2) 前端路由边界（文档级契约）

当前预留路由：

- `/` 首页
- `/posts` 文章列表页
- `/posts/:slug` 文章详情页
- `/tags` 标签总览页
- `/tags/:tag` 标签详情页
- `/archive` 归档页
- `/friends` 友链页
- `/about` 关于页
- `/404` 未找到页面

## 3) 后端 API 边界（文档级契约）

第一阶段预留基础接口：

- `/api/health`
- `/api/stats`

后续扩展接口（暂不实现）：

- `/api/search`
- `/api/comment`
- `/api/admin/*`
