# Frontend Development Guidelines

> 前端开发规范（Vite + Vanilla TypeScript SPA）。

## Overview

前端为无框架 SPA：手动路由 + DOM 渲染。核心架构：**Pages（纯渲染函数）→ Features（hydration 行为绑定）→ Data（API 包装 + 指纹缓存）**，样式按关注点组织（global.css manifest 级联）。

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Architecture](../architecture.md) | 系统架构总览（跨层） |
| [Directory Structure](./directory-structure.md) | 目录组织与模块规则 |
| [Component Guidelines](./component-guidelines.md) | 渲染函数组件模式 |
| [State Management](./state-management.md) | 模块级缓存 + 指纹变化检测 |
| [Type Safety](./type-safety.md) | strict 类型 + 镜像类型同步 |
| [Quality Guidelines](./quality-guidelines.md) | 禁止模式、必需模式、审查清单 |
| [Testing](./testing.md) | 前端测试现状与指引 |
| [Tech Stack](../tech-stack.md) | 技术栈与环境变量 |

## 核心约定（速查）

- **PageRenderer 模式**：页面 = 纯函数返回 HTML 字符串；交互全部走 Features 层
- **指纹变化检测**：数据变化判断基于内容指纹，不无脑重渲染
- **API 统一走 `data/api.ts`**：typed `fetchJson<T>` + Bearer token
- **样式 manifest**：`global.css` 级联导入 tokens → base → layout → components → pages → admin → motion
- **质量门**：`cd frontend && bun run typecheck && bun run build`

## 文档语言

- 本 spec 目录内容以中文为主（项目已有中文文档惯例），代码标识符保持英文
