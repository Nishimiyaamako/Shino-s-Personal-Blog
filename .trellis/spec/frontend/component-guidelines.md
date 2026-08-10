# Component Guidelines

> 前端组件约定（Vanilla TS，无框架）。

## Overview

本项目无 React/Vue 等组件框架。"组件"是返回 HTML 字符串的渲染函数 + 可复用片段：
- **Pages**（`pages/`）：整页渲染，纯函数，无副作用
- **Components**（`components/`）：可复用渲染片段（`post-list.ts`、`profile-card.ts`）

## Component Patterns

**页面组件（PageRenderer）**：
```ts
type PageRenderer = (context: PageRenderContext) => string
```
- 无副作用、无事件绑定、无闭包状态
- 所有交互逻辑通过 Features 层 hydration 挂载

**可复用片段**：
- 接收 typed 数据参数（如 posts 数组），返回 HTML 字符串
- 不直接调用 API；数据由上层（page render / feature）传入

## Props / Data Passing

- 显式 typed 参数，不用全局变量传数据
- 渲染上下文统一为 `PageRenderContext`（params + pathname），定义于 `types/router.ts`

## Composition

- 页面模板内嵌组件函数调用（模板字符串拼接）
- 管理后台壳（`pages/admin.ts`）聚合 7 个管理面板模板（已知单体债务，见 architecture.md）

## Accessibility / 交互

- 事件绑定不放在组件内，放 Features 层（`data-role` 属性定位 DOM）
- 管理后台表单使用成对 error/success 元素：`[data-role="admin-post-error"]` / `[data-role="admin-post-success"]`，默认 `hidden`，通过切换 `hidden` + `textContent` 显示消息

## 约束

- 禁止引入组件框架；新增 UI 一律按"渲染函数 + feature 绑定"模式
- 新增页面/片段先检查 `components/` 是否已有可复用部分
