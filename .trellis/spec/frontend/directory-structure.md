# Directory Structure

> 前端代码组织方式（Vite + Vanilla TypeScript SPA）。

## Overview

前端为无框架 SPA：手动路由 + DOM 渲染。核心分层：**Pages（纯渲染函数）→ Features（运行时行为）→ Data（API + 缓存）**，样式按关注点拆分 CSS。页面渲染与行为绑定严格分离（PageRenderer 模式 + hydration）。路由结构：`/` 为 landing 页，博客全家族在 `/blog` 前缀（`/blog`、`/blog/:slug`、`/blog/tags`、`/blog/tags/:tag`、`/blog/archive`），`/friends`、`/about` 独立，`/admin/*` 为后台。

## Directory Layout

```
frontend/
├── index.html              # HTML 入口
├── vite.config.ts          # Vite 配置（dev 代理 /api /uploads → :3001）
├── tsconfig.json           # strict, ES2022, lib: ES2022+DOM, types: ["vite/client"]
├── package.json / bun.lock
├── public/images/          # 静态资源（图标、默认头像）
└── src/
    ├── main.ts             # bootstrap：外壳渲染调用 + 页面增强表 + 全局事件代理（~260 行，见 shell/motion/features）
    ├── router/index.ts     # 路由表 (ROUTE_RECORDS) + 路由解析
    ├── pages/              # 页面模板（纯函数，返回 HTML 字符串）
    │   ├── landing.ts / posts.ts / post-detail.ts / tags.ts / tag-detail.ts
    │   ├── archive.ts / friends.ts / about.ts
    │   ├── admin.ts（后台壳）/ admin-login.ts / not-found.ts
    ├── features/           # 运行时行为绑定（渲染后挂载 DOM，返回 cleanup）
    │   ├── admin.ts        # 管理功能入口（barrel）
    │   ├── public-runtime.ts
    │   ├── motion.ts       # 动效系统（selector 表 + 时序常量 + setup*Motion + postCardMotionHandle）
    │   ├── post-detail.ts  # 文章详情增强（TOC/代码复制/返回按钮）+ hljs 高亮
    │   ├── tags.ts / posts.ts / archive.ts / friends.ts  # 对应宿主页增强
    │   └── admin/          # login / dashboard / posts / friends / media
    │       ├── site-settings / content-settings / shared / avatar-crop
    ├── data/               # API 调用 + 客户端数据编排 + 指纹缓存
    │   ├── api.ts          # 所有 fetch 包装 + Token 管理
    │   ├── posts.ts / about.ts / friends.ts / profile-card.ts / site-config.ts
    │   └── platform-presets.ts
    ├── components/         # 可复用 UI 组件
    │   ├── post-list.ts / profile-card.ts
    │   ├── shell.ts        # 应用外壳（renderApp/导航/页头/页脚/history 索引/navigateTo/增强钩子）
    ├── __fixtures__/       # API 契约镜像夹具（对应 tests/api_compat.rs 契约测试）
    ├── types/              # 前端类型定义（router / content / api / profile-card / friend-link / about）
    ├── config/             # 站点配置、主题色板
    │   ├── site.ts / themes.ts
    ├── utils/              # 纯工具函数（date / escape-html / search / tag-color / theme / dom-style）
    └── styles/             # CSS 按关注点组织
        ├── global.css      # manifest 入口（级联导入 tokens→base→layout→components→pages→admin→motion）
        ├── tokens.css      # 设计令牌（CSS 自定义属性）
        ├── base.css / layout.css / motion.css
        ├── components/     # buttons / cards / forms / markdown / post-card / post-toc / profile-card / search-modal / tag-system / theme-filter
        ├── pages/          # about / archive / friends
        └── admin/          # admin-core.css / admin-forms.css
```

## Module Organization

- **新增页面**：`pages/<name>.ts` 导出 `render<Name>Page(context)` 纯函数，在 `router/index.ts` 的 `ROUTE_RECORDS` 注册
- **新增交互**：`features/<name>.ts` 导出 `setup<Name>(options)` 挂载 DOM 事件，返回 `(() => void) | null` teardown
- **新增 API 调用**：`data/api.ts` 加 typed fetch 包装；专用数据模块放 `data/<domain>.ts`
- **新增样式**：按关注点放 `styles/components/`（组件级）或 `styles/pages/`（页面级），在 `global.css` 级联导入

## Naming Conventions

- 文件：kebab-case（`post-list.ts`、`site-config.ts`）
- 函数：camelCase（`renderHomePage()`、`setupAdminDashboard()`）
- 类型/接口：PascalCase（`PageRenderContext`、`RouteRecord`）
- CSS 类：公开 kebab-case（`post-card`）；admin 专用加 `admin-` 前缀（`admin-panel`）
- DOM 属性：`data-role` 用于 JS 定位（`data-role="admin-logout"`）；`data-*` 用于状态（`data-panel="posts"`）

## Examples

- 页面纯函数 + feature 绑定分离：`frontend/src/pages/landing.ts` + `frontend/src/features/public-runtime.ts`
- 管理后台聚合：`frontend/src/features/admin/dashboard.ts`（模块懒初始化 + dirty tracking）
