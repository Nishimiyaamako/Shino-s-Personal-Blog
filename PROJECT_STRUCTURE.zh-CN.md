# Shino's Bolg 项目结构说明（中文注释版）

本文档用于集中说明当前仓库中各目录与关键文件的用途。

> 为避免噪声，下方目录树默认省略 `node_modules/`、`dist/` 等本地生成产物；如需关注构建产物，会在对应目录说明中单独注明。

## 0) 维护约定

- 只要工程结构发生变化（新增 / 删除 / 重命名目录或关键文件），就同步更新本文件。
- 本文件当前状态已同步至：**2026-03-29（项目结构文档与 AI Workflow 文档对齐）**。
- 项目正式名称保持为：**`Shino's Bolg`**（按当前仓库命名保留，不自动更正为 `Blog`）。

## 1) 注释版目录树

```text
.
├─ .vscode/                                    # 本地 IDE 配置（可选）
│  └─ launch.json                              # VS Code 调试配置
├─ PROJECT_STRUCTURE.zh-CN.md                  # 本文件：项目结构中文注释总览
├─ frontend/                                   # 前端工程根目录（Vite + TypeScript + Vanilla SPA）
│  ├─ package.json                             # 前端依赖、脚本与工程元信息
│  ├─ bun.lock                                 # Bun 锁定文件
│  ├─ .gitignore                               # 前端忽略规则（如 node_modules / dist）
│  ├─ index.html                               # Vite 入口 HTML
│  ├─ tsconfig.json                            # TypeScript 编译配置
│  ├─ vite.config.ts                           # Vite 配置
│  ├─ public/                                  # 无需构建即可直接提供的静态资源
│  │  ├─ .gitkeep                              # 空目录占位
│  │  ├─ fonts/                                # 预留字体目录（当前未放入受管字体文件）
│  │  └─ images/
│  │     └─ covers/                            # 文章封面图目录
│  │        ├─ obsidian-server-sync.webp       # 《Obsidain服务器云同步》封面图
│  │        └─ steam-bugs-linux.webp           # 《Steam BUGs》封面图
│  └─ src/                                     # 前端源码
│     ├─ main.ts                               # SPA 入口；负责 App Shell、导航、路由切换与页面增强
│     ├─ assets/
│     │  ├─ .gitkeep                           # 素材占位
│     │  └─ icons/
│     │     ├─ comfyui.svg                     # 首页/内容区使用的技术图标素材
│     │     └─ elysia.svg                      # 首页/内容区使用的技术图标素材
│     ├─ components/                           # 可复用 UI 渲染片段
│     │  ├─ .gitkeep                           # 目录占位
│     │  ├─ home-intro-panel.ts                # 首页介绍面板渲染
│     │  ├─ post-list.ts                       # 文章列表/标签文章列表渲染
│     │  └─ profile-card.ts                    # 左侧个人资料卡片渲染
│     ├─ config/                               # 前端运行时配置与主题元数据
│     │  ├─ .gitkeep                           # 目录占位
│     │  ├─ site.ts                            # 站点标题、页脚、备案信息等统一配置
│     │  └─ themes.ts                          # 主题分类/主题展示配置
│     ├─ content/                              # 前端直读 Markdown 内容源
│     │  ├─ about.md                           # 关于页 Markdown 内容源
│     │  └─ posts/
│     │     ├─ .gitkeep                        # 目录占位
│     │     ├─ Arch & Endeavouros安装配置.md   # 示例/正式文章内容
│     │     ├─ LiberChant API設置.md           # 示例/正式文章内容
│     │     ├─ Obsidain服务器云同步.md         # 示例/正式文章内容
│     │     ├─ Ollama 安装&配置.md             # 示例/正式文章内容
│     │     └─ Steam BUGs.md                   # 示例/正式文章内容
│     ├─ data/                                 # 内容解析、视图模型与本地数据源
│     │  ├─ .gitkeep                           # 目录占位
│     │  ├─ about.ts                           # 关于页 Markdown/API 解析与 ViewModel 构建
│     │  ├─ friends.ts                         # 友链数据源
│     │  ├─ home-intro-panel.ts                # 首页介绍面板数据
│     │  ├─ home-tech-iconify.ts               # 首页技术栈图标数据
│     │  ├─ posts.ts                           # 文章 frontmatter 解析、筛选、排序与主题统计
│     │  └─ profile-card.ts                    # 个人资料卡片数据
│     ├─ pages/                                # 页面级渲染模块（路由页面）
│     │  ├─ .gitkeep                           # 目录占位
│     │  ├─ home.ts                            # 首页
│     │  ├─ posts.ts                           # 文章列表页
│     │  ├─ post-detail.ts                     # 文章详情页（slug）
│     │  ├─ tags.ts                            # 标签总览页
│     │  ├─ tag-detail.ts                      # 标签详情页（tag）
│     │  ├─ archive.ts                         # 归档页
│     │  ├─ friends.ts                         # 友链页
│     │  ├─ about.ts                           # 关于页
│     │  └─ not-found.ts                       # 404 页面
│     ├─ router/
│     │  ├─ .gitkeep                           # 目录占位
│     │  └─ index.ts                           # 路由表、动态参数匹配、导航配置与 404 兜底
│     ├─ styles/                               # 全局样式分层目录
│     │  ├─ .gitkeep                           # 目录占位
│     │  ├─ README.md                          # 样式分层约定与 CSS 变量使用说明
│     │  ├─ global.css                         # 样式 manifest，按层聚合其余样式文件
│     │  ├─ tokens.css                         # 全局 token、主题与 dark mode 变量
│     │  ├─ base.css                           # reset、基础元素、全局背景装饰
│     │  ├─ layout.css                         # header / nav / main / footer 与页面壳层布局
│     │  ├─ content.css                        # 通用内容页、about、friends、markdown 等样式
│     │  ├─ posts.css                          # 文章列表、标签、主题栏、TOC、浮动操作等样式
│     │  └─ motion.css                         # 动效、过渡状态与 reduced-motion 兜底
│     ├─ types/                                # 前端领域类型定义
│     │  ├─ .gitkeep                           # 目录占位
│     │  ├─ about.ts                           # 关于页 API / ViewModel / 时间线类型
│     │  ├─ content.ts                         # 文章 frontmatter 与内容类型
│     │  ├─ friend-link.ts                     # 友链项类型
│     │  ├─ home-intro-panel.ts                # 首页介绍面板类型
│     │  ├─ profile-card.ts                    # 资料卡片类型
│     │  └─ router.ts                          # 路由相关公共类型
│     └─ utils/                                # 通用工具函数
│        ├─ .gitkeep                           # 目录占位
│        ├─ date.ts                            # 日期格式化工具
│        ├─ dom-style.ts                       # 运行时读写 CSS 自定义属性工具
│        ├─ escape-html.ts                     # HTML 转义工具
│        └─ theme.ts                           # 主题 key 规范化等工具
├─ backend/                                    # 后端工程根目录（当前仍以占位 scaffold 为主）
│  ├─ package.json                             # 后端包信息占位
│  └─ src/
│     ├─ index.ts                              # 后端入口占位文件（记录后续 API 计划）
│     ├─ routes/                               # 预留 API 路由目录
│     ├─ services/                             # 预留服务层目录
│     ├─ middleware/                           # 预留中间件目录
│     ├─ types/                                # 预留后端类型目录
│     └─ utils/                                # 预留工具目录
├─ docs/
│  ├─ blueprint.md                             # 项目蓝图文档副本
│  ├─ content-spec.md                          # Markdown/frontmatter 内容协议文档
│  └─ ai-workflow/                             # AI 协作基线文档目录
│     ├─ MEMORY.md                             # 项目长期记忆（决策 / 风险 / 当前任务）
│     ├─ README.md                             # workflow 使用说明
│     └─ STOP_HOOKS.md                         # 停止点自检规则
└─ deploy/
   ├─ 1panel-static-deploy.md                  # 1Panel 静态站点部署说明
   ├─ artifacts/                               # 构建归档产物目录
   │  ├─ .gitignore                            # 制品忽略规则
   │  ├─ .gitkeep                              # 目录占位
   │  ├─ frontend-dist-*.tar.gz                # 历史前端 dist 打包产物
   │  └─ frontend-dist-latest.tar.gz           # 最新前端部署压缩包别名
   ├─ nginx/
   │  ├─ .gitkeep                              # 目录占位
   │  └─ 1panel-static-spa-snippet.conf        # Nginx SPA 刷新回退 + 缓存配置片段
   └─ scripts/
      ├─ .gitkeep                              # 目录占位
      └─ build-frontend-dist.sh                # 本地构建并打包前端 dist 的脚本
```

## 2) 前端路由边界（文档级契约）

当前前端受管路由：

- `/` 首页
- `/posts` 文章列表页
- `/posts/:slug` 文章详情页
- `/tags` 标签总览页
- `/tags/:tag` 标签详情页
- `/archive` 归档页
- `/friends` 友链页
- `/about` 关于页
- `/404` 未找到页面

## 3) 后端 / API 边界（当前状态 + 预留契约）

当前 `backend/` 仍为 scaffold，占位入口只有 `backend/src/index.ts`，尚未真正落地对外 API。

已存在或已约定的接口边界：

- `GET /api/about`
  - 返回：`{ markdown: string }`
  - 用途：关于页进入时尝试拉取远端 Markdown，失败自动回退本地 `frontend/src/content/about.md`
- `/api/health`
- `/api/stats`
- `/api/search`（暂不实现）
- `/api/comment`（暂不实现）
- `/api/admin/*`（暂不实现）

## 4) 2026-03-18 结构更新补记（AI Workflow + 内容协议）

新增关键文件（节选）：

- `docs/ai-workflow/MEMORY.md`
- `docs/ai-workflow/STOP_HOOKS.md`
- `docs/ai-workflow/README.md`
- `frontend/src/types/content.ts`
- `frontend/src/data/posts.ts`
- `frontend/src/components/post-list.ts`
- `frontend/src/utils/date.ts`
- `frontend/src/content/posts/*.md`（示例文章）

改动关键文件（节选）：

- `frontend/src/main.ts`（全局 App Shell + 导航高亮）
- `frontend/src/router/index.ts`（文章 slug 不存在时回落 404）
- `frontend/src/pages/*.ts`（占位页替换为真实主体结构）
- `docs/content-spec.md`（前端内容协议定稿）

## 5) 2026-03-20 结构更新补记（1Panel 静态部署）

新增关键文件（节选）：

- `frontend/src/config/site.ts`（站点标题、备案信息、页脚文案统一配置）
- `deploy/1panel-static-deploy.md`（1Panel 静态站点上线指引）
- `deploy/nginx/1panel-static-spa-snippet.conf`（SPA 刷新回退 + 缓存配置片段）
- `deploy/scripts/build-frontend-dist.sh`（本地构建并打包 dist）
- `deploy/artifacts/frontend-dist-latest.tar.gz`（最新部署产物别名）

改动关键文件（节选）：

- `frontend/src/main.ts`（页脚备案展示改为可配置）
- `frontend/src/styles/global.css`（备案信息行样式接入）

## 6) 2026-03-22 ~ 2026-03-27 结构更新补记（主题侧栏 / 关于页 / 样式分层）

新增关键文件（节选）：

- `frontend/src/pages/friends.ts`（友链页）
- `frontend/src/data/friends.ts`（友链数据）
- `frontend/src/types/friend-link.ts`（友链类型）
- `frontend/src/content/about.md`（关于页内容源）
- `frontend/src/data/about.ts`（关于页 Markdown/API 解析）
- `frontend/src/types/about.ts`（关于页视图模型类型）
- `frontend/src/config/themes.ts`（主题分类配置）
- `frontend/src/utils/dom-style.ts`（运行时 CSS 变量工具）
- `frontend/src/styles/README.md`（样式分层维护说明）
- `frontend/src/styles/tokens.css`
- `frontend/src/styles/base.css`
- `frontend/src/styles/layout.css`
- `frontend/src/styles/content.css`
- `frontend/src/styles/posts.css`
- `frontend/src/styles/motion.css`
- `frontend/src/assets/icons/comfyui.svg`
- `frontend/src/assets/icons/elysia.svg`
- `frontend/public/images/covers/*.webp`（文章封面图）

改动关键文件（节选）：

- `frontend/src/pages/posts.ts`（主题筛选与列表工具栏）
- `frontend/src/pages/post-detail.ts`（详情页正文与返回交互）
- `frontend/src/router/index.ts`（新增 `/friends` 路由与导航项）
- `frontend/src/main.ts`（右侧主题栏 / TOC / 关于页 API fallback / 页面动效增强）
- `frontend/src/styles/global.css`（改为样式 manifest）

## 7) 2026-03-29 结构更新补记（文档同步）

本轮主要进行结构与协作文档对齐，未新增业务代码目录；同步内容包括：

- `PROJECT_STRUCTURE.zh-CN.md` 更新为当前真实仓库结构
- 路由边界补充 `/friends`
- API 契约补充 `GET /api/about -> { markdown: string }`
- 文档中明确项目正式名称为 `Shino's Bolg`
