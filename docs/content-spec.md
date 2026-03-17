# Content Spec（Markdown 内容规范）

## 1) 文章放置路径

- 文章文件目录：`frontend/src/content/posts/`
- 文件后缀：`.md`
- 接入方式：构建期自动扫描（`import.meta.glob`）

> 结论：后续新增文章时，放入上述目录并写好 frontmatter，即可自动出现在 `/posts` 与 `/posts/:slug`。

---

## 2) Frontmatter 规范（必填）

> 当前解析器使用**简化 YAML 子集**（浏览器端实现），请避免复杂语法。

每篇文章必须包含以下字段：

```yaml
---
title: string
slug: string
date: YYYY-MM-DD
tags:
  - string
  - string
summary: string # 推荐填写，不填会自动生成摘要
---
```

### 字段说明

- `title`：文章标题，页面展示与 SEO 基础字段。
- `slug`：URL 唯一标识，生成详情页路径 `/posts/:slug`。
- `date`：发布日期，格式必须为 `YYYY-MM-DD`，用于排序。
- `tags`：标签数组，至少 1 项。
- `summary`：文章摘要（可选，缺省时由正文自动截取）。

### 解析器支持范围（重要）

- 支持：单行键值（`key: value`）、`tags` 列表（`- item`）。
- 支持：`tags: [a, b]` 这种简单行内列表。
- 不支持：嵌套对象、多行复杂字符串、锚点/别名等完整 YAML 高级语法。

### 可选扩展字段

- `dateCreate`
- `dateUpdate`
- 其他业务扩展字段（会被保留但不参与当前渲染逻辑）

---

## 3) 校验与容错规则

扫描文章时若命中以下情况，会跳过该文件并输出告警：

- 缺少任一必填字段（`title/slug/date/tags`）
- `date` 非 `YYYY-MM-DD`
- `tags` 不是非空字符串数组
- `slug` 与已有文章重复

> 页面不会因单篇异常文章崩溃；异常文件仅不展示。

---

## 4) 渲染规则

- 文章列表页 `/posts`
  - 自动读取全部合规文章
  - 按 `date` 倒序展示
- 文章详情页 `/posts/:slug`
  - 按 `slug` 精确匹配
  - Markdown 正文使用解析器转换为 HTML 渲染

---

## 5) 与后端兼容建议

当前静态字段与未来后端 Post DTO 保持一致核心字段：

- `title`
- `slug`
- `date`
- `tags`
- `summary`
- `content`

这样后续从“本地 Markdown 数据源”切换到“后端 API/数据库”时，页面层可最小改动。
