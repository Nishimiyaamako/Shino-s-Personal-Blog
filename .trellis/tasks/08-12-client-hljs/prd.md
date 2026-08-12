# 客户端 hljs 代码高亮：消费现有 hljs 标记

## Goal

前端引入 highlight.js（core + 按需语言子集），在拆分后的 `features/post-detail.ts` 代码块遍历点挂接 `hljs.highlightElement`，消费后端 `markdown.rs` 已输出的 `<pre data-language><code class="hljs language-x">` 标记。后端零改动。

## Background

- 后端 markdown.rs:79-85 已输出 `class="hljs language-{lang}"`（为 hljs 设计的形态），但前端无任何 hljs 依赖，class 无人消费，代码块目前是纯转义文本。
- 原文档方向"服务端 syntect"存在 syntect→hljs 类名映射不兼容的坑（syntect 输出自有 class scheme/内联色，与 hljs 主题 CSS 不兼容），否决；改客户端 hljs。
- hljs 仅处理纯文本输入，不重解析 HTML（对转义内容安全）。
- 依赖 `main-split` 完成后的 `features/post-detail.ts` 结构（hljs 挂接点与代码复制按钮同一遍历点）。

## Requirements

1. `bun add highlight.js`；入口注册 core + 按需语言子集（站点常见语言：js/ts/rust/json/bash/html/css 起步，按内容扩展）。
2. 挂接点：`features/post-detail.ts` 中 `setupPostDetailCodeBlockCopy` 的同一 `pre code` 遍历处，对 `code.hljs` 调 `hljs.highlightElement`（hljs 自带 `data-highlighted` 去重）。
3. 后端 `markdown.rs` 零改动；非 post-detail 页面的代码块不处理（现状即仅文章详情有 markdown 渲染）。
4. 渐进增强：无 JS 时保持纯转义文本；hljs 失败不影响页面（try/catch）。

## Acceptance Criteria

- [ ] 文章详情代码块出现语法高亮（class/颜色生效，主题跟随站点色板不强制，hljs 默认主题即可）
- [ ] 动态路由切换后（SPA 导航到另一篇文章）高亮正常（无重复高亮/报错）
- [ ] 代码复制按钮与高亮共存（遍历点合并后复制仍正常）
- [ ] `bun run typecheck && bun run build && bun test` 全绿
- [ ] build 体积对比基线记录（main-split 完成时体积 vs 本次体积）

## Notes

- 语言子集先小后大：注册过多语言会膨胀 bundle，后续按站点实际内容增量加。
- hljs CSS：引入 core styles 或站点自有高亮配色（tokens.css 挂色）——实施时选其一，记录决策。
