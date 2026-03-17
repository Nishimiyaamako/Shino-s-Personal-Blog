---
title: "Vanilla TS 路由骨架实践"
slug: vanilla-ts-routing-notes
date: 2026-03-16
tags: [typescript, architecture]
summary: "在不引入框架的前提下，整理一套可维护的前端路由与渲染组织方式。"
status: published
---

这篇记录下我在 Vanilla TS SPA 骨架中的几个实践点：

## 1) 路由匹配与参数解码

- 支持静态路径和动态参数路径；
- 动态参数统一做 URL decode；
- 未命中路径统一进入 404 兜底。

## 2) 页面渲染职责

页面模块只关注“页面内容”，
全局布局（header/main/footer）统一在入口层完成。

## 3) 内容安全

Markdown 渲染后的 HTML 必须经过 sanitize：

```ts
const unsafeHtml = marked.parse(markdown);
const safeHtml = DOMPurify.sanitize(unsafeHtml);
```

这样可以有效减少 XSS 风险。
