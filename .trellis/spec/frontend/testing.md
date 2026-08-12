# Frontend Testing

> 前端测试约定（Vitest 已落地，2026-08-12 技术债清理）。

## Test Framework

- **Vitest 4 + happy-dom**：`frontend/vitest.config.ts`（environment: happy-dom，include `src/**/*.test.ts`）
- 运行：`bun run test`（vitest run）；`local-verify.sh` 已挂接（步骤 5/6）
- 依赖：`vitest`、`happy-dom`（devDependencies）

## 测试覆盖现状（52 用例）

| 模块 | 覆盖点 |
| --- | --- |
| `src/utils/search.test.ts` | searchPosts 排序/过滤/limit/高亮、fuzzySearchPosts |
| `src/router/index.test.ts` | resolveRoute 静态/参数/编码/fallback、resolveAdminModule、isAdminPathname |
| `src/features/admin/shared.test.ts` | confirmAdminAction（确认/取消/Escape/单次 settle）、splitTags、contacts 序列化往返、generateSlug、readPostFormPayload、renderMarkdownPreviewHtml（DOMPurify 净化）、renderAdminPostList/FriendList |
| `src/data/site-config.test.ts` | loadSiteConfig 默认值/拷贝、applyRemoteSiteConfig normalize/指纹去重 |
| `src/__fixtures__/contract.test.ts` | API 契约镜像：夹具键集 ⊆ 契约键集（7 组，对应后端 api_compat 契约测试） |

## 新增测试指引

- 优先级：admin 关键流（登录、文章保存/加载）→ 路由解析 → 纯函数（utils、指纹函数）
- 纯逻辑函数（无 DOM）测试优先；DOM 交互用 happy-dom 直接构造/事件模拟
- 测试文件与被测文件同目录（`*.test.ts`），typecheck 由 `tsc --noEmit`（include: src）覆盖

## 质量门

- 最低要求：`cd frontend && bun run typecheck && bun run test && bun run build` 通过
- 仓库级：`./deploy/scripts/local-verify.sh`（含前端 build + test）
- 手动回归：公开页面渲染、admin 登录/保存/发布流程、上传、搜索

## 约束

- 不引入重型 E2E 框架（Playwright/Cypress）——个人博客项目体量不符，除非明确需求
- 禁止引入 `window.confirm`：统一用 `confirmAdminAction`（`features/admin/shared.ts` 样式化 dialog）
