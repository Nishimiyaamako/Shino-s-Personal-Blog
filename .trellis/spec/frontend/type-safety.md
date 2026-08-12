# Type Safety

> 前端类型约定（strict TypeScript，无校验库）。

## Overview

`tsconfig.json` strict 模式（`strict: true`，ES2022，lib ES2022+DOM+DOM.Iterable，types `["vite/client"]`）。无运行时校验库（无 Zod 等），类型注释即文档（无 JSDoc/TSDoc）。

## Type Organization

- **API 响应类型**：`types/api.ts`（独立镜像后端类型，已知债务——前后端独立维护，见 architecture.md）
- **领域类型**：`types/content.ts`（文章/标签）、`types/profile-card.ts`、`types/friend-link.ts`、`types/about.ts`
- **路由类型**：`types/router.ts`（`RouteRecord`、`PageRenderContext`、`PageRenderer`）

## Patterns

- **API 包装泛型**：`fetchJson<T>(url, init)` 返回 typed 响应，响应 `response.json()` 后 `as T` 断言
- **严格函数签名**：页面渲染函数统一 `PageRenderer` 签名；feature setup 返回 `(() => void) | null`
- **DOM 定位**：类型安全靠 `data-role` 属性 + `querySelector` 后手动断言

## Validation

- 无运行时校验库；依赖 TypeScript 编译期检查
- 与服务端镜像类型同步：**修改后端 `models.rs` 时务必同步前端 `types/*.ts`**（手动同步规则）
- **契约测试防线（2026-08-12 落地）**：`backend/rust/tests/api_compat.rs::public_response_shapes_match_frontend_types_contract` 断言公开端点响应键集 ⊆ 契约；`frontend/src/__fixtures__/contract.test.ts` + `__fixtures__/*.json` 断言契约键 ⊆ 夹具。**改后端字段流程**：更新 `models.rs` → 同步 `tests/api_compat.rs` 契约 + `__fixtures__/*.json` + `types/*.ts` → 两端测试全绿（`cargo test` / `bun run test`）。契约中以 null 占位的键 = 前端未声明的无害多余键（如公开响应的 `id`/`publishedAt`、profile contact 的 `id`/`displayOrder`、friend-link 的 `id`/`enabled`/`displayOrder`）。

## 约束

- 保持 strict 模式通过（`bun run typecheck`）
- 不引入校验库；API 层统一 `fetchJson<T>` 泛型
- 共享类型重构（packages/shared-types）为已知债务方向，未落地前按镜像同步规则维护
