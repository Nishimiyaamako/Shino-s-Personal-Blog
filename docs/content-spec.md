# Content Spec（v1）

> 更新日期：2026-03-18  
> 适用范围：Personal Blog 第一阶段（前端直连 Markdown）

## 1) Frontmatter 协议（强校验）

每篇文章必须包含以下 6 个字段：

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `title` | `string` | 非空 |
| `slug` | `string` | 必须匹配 `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `date` | `string` | 必须是 `YYYY-MM-DD`，且是有效日历日期 |
| `tags` | `string[]` | 至少 1 个标签；标签统一 lower-kebab-case |
| `summary` | `string` | 非空，建议 140 字以内 |
| `status` | `'draft' \| 'published'` | 草稿/发布状态，必填 |

### 合法示例

```md
---
title: "Vanilla TS 路由骨架实践"
slug: vanilla-ts-routing-notes
date: 2026-03-16
tags: [typescript, architecture]
summary: "在不引入框架的前提下，整理一套可维护的前端路由与渲染组织方式。"
status: published
---
```

## 2) 内容组织规则

- 文章目录：`frontend/src/content/posts/*.md`
- 文件命名：建议使用 `slug.md`（例如：`hello-personal-blog.md`）
- 一个文件只对应一篇文章
- 标签规范：统一 lower-kebab-case（如 `web-performance`）

## 3) 渲染与展示规则

- 文章列表仅展示 `status: published`
- 文章排序：按 `date` 倒序（新到旧）
- 第一阶段不做分页
- 详情路由：`/posts/:slug`
  - 若 slug 不存在或对应文章为 `draft`，进入 404
- Markdown 渲染链路：
  - 读取：`import.meta.glob(..., { query: '?raw', eager: true })`
  - 转换：`marked`
  - 安全清洗：`DOMPurify.sanitize(...)`

## 4) 错误处理规则

- Frontmatter 缺失或字段不合法：
  - 开发环境：在控制台输出错误并跳过该文
  - 生产环境：不让页面崩溃，非法文章不进入公开列表
- Markdown 正文为空：视为非法文章，跳过处理

## 5) 日期与时区约定

- 日期字段使用 `YYYY-MM-DD`
- 展示时按 `Asia/Shanghai` 解释并格式化
- 不使用未来发布日期作为“自动发布”机制（v1）

## 6) 非目标（v1 不做）

- 后端内容 API
- 搜索索引
- 评论系统
- 文章分页
