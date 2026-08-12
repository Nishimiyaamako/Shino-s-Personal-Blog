# Quality Guidelines

> 前端代码质量规范与质量门。

## Overview

无 ESLint/Prettier/Biome 配置，格式约定靠纪律。质量门为 `cd frontend && bun run typecheck && bun run test && bun run build`。测试框架为 Vitest 4 + happy-dom（52 用例，见 `testing.md`）。

## Forbidden Patterns

- **渲染函数内做事件绑定/副作用**：页面必须纯渲染，交互走 Features 层 hydration
- **组件内直接 fetch API**：数据通过 `data/` 层包装，组件只接收 typed 数据
- **引入前端框架或状态库**（React/Vue/Svelte、Redux 等）：保持 Vanilla 模式
- **新增 `window.prompt()`/`window.confirm()`**：一律禁用（2026-08 已全量清除）；破坏性确认与未保存丢弃提示统一用样式化 dialog（`confirmAdminAction`，见 `features/admin/shared.ts`）
- **手动改 `global.css` 级联顺序之外新增样式入口**：样式必须从 manifest 级联导入
- **路由表外挂页面**：新页面必须在 `router/index.ts` 的 `ROUTE_RECORDS` 注册
- **静态路由排在参数路由之前**：`/blog/:slug` 段数与 `/blog/tags`、`/blog/archive` 相同，参数路由在前会截胡静态路由（2026-08 真实 bug，测试锁定）
- **新增旧路径硬编码链接**（`/posts`、`/tags`、`/archive`）：博客系链接一律 `/blog` 前缀

## Required Patterns

- **strict 模式**：所有新代码通过 `tsc --noEmit`
- **PageRenderer 签名**：`(context: PageRenderContext) => string`
- **setup 函数返回 teardown**：`(() => void) | null`，页面切换时清理
- **API 统一走 `data/api.ts`**：typed `fetchJson<T>` + Bearer 头（`getAdminAuthHeaders()`）
- **token 存储**：`localStorage['shino.admin.token']`（勿改动键名）
- **导入顺序**：types → config/constants → data → components → features；样式只在入口导入
- **格式**：无分号、单引号、2 空格缩进
- **样式命名**：公开 kebab-case；admin 加 `admin-` 前缀

## Testing Requirements

- 前端测试框架：Vitest 4 + happy-dom（见 `testing.md`）；核心逻辑新增/改动需补 `*.test.ts`
- 改动后至少：`bun run typecheck && bun run test` 通过 + 手动验证（页面渲染、hydration 行为、admin 关键流程）
- 若添加测试：优先 admin 关键流冒烟测试

## Code Review Checklist

- [ ] 页面/行为分离正确（无渲染函数副作用）
- [ ] API 调用走 data 层，类型镜像同步
- [ ] 未引入新框架/库
- [ ] 样式遵循 manifest 级联
- [ ] admin 破坏性操作有确认交互
- [ ] 通过 typecheck 与 build
