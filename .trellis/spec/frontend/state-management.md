# State Management

> 前端状态管理约定（模块级缓存，无集中 store）。

## Overview

无集中状态管理库（无 Redux/Zustand/Pinia）。状态按数据域分散在 `data/` 各模块的模块级可变变量中，通过"指纹变化检测"驱动重渲染。

## Local vs Global State

- **模块级缓存**：每个 data 模块管理自己的缓存（`remotePublishedPostCache`、`remotePublishedPostFingerprint`、`remoteSiteConfigOverride` 等）
- **页面内状态**：渲染函数内局部变量，页面切换即丢弃
- **跨页面共享**：通过 data 层模块缓存（如文章列表缓存供 posts/tags/archive 多页复用）

## Server State

- API 调用后更新模块缓存
- **指纹变化检测**：`buildPostFingerprint()` 从关键字段（title + slug + contentHTML + tags 等）构建确定性字符串，对比本地缓存指纹，变化才触发重新渲染——避免远程数据未变时的无效重渲染
- 适用于：`data/posts.ts`（文章详情）、`data/site-config.ts`（站点配置覆盖）

## Derived State

- 本地数据变换（标签统计、归档时间线、主题统计）在各 data 模块内计算导出

## SPA 导航状态

- `main.ts` 使用 `window.history` + 自定义 `__appNavIndex` 状态键
- `popstate` 监听驱动重渲染
- Feature setup 函数返回 teardown，页面切换时清理旧页面监听（cleanup old, setup new）

## Admin 面板状态

- **dirty tracking**：`Set<DirtyScope>`（`features/admin/dashboard.ts`）跟踪哪些表单面板有未保存改动；`beforeunload` 守卫警告关闭；`[data-role="admin-unsaved-status"]` 显示未保存徽标
- **懒初始化**：admin 子模块在首次切换到对应 tab 时才初始化

## 约束

- 禁止引入全局 store 库；保持模块级缓存 + 指纹模式
- 新增数据域时：缓存变量 + 指纹函数 + 更新函数放同一 data 模块，不要散落
