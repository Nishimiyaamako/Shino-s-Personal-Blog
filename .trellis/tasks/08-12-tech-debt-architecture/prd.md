# 技术债清理（二）：main.ts 拆分 / 类型契约 / 客户端 hljs

## Goal

处理仓库文档"已知技术债务"章节中三条可实施项：① 单体 `main.ts`（3426 行）按动效/外壳/页面增强三刀拆分；② 前后端类型重复定义的同步防线加固；④ 客户端代码高亮（替代服务端 syntect 方案）。全程不改变 API 契约与页面行为。第 ③ 条（Rust 响应时间戳）经核验后判定**关闭**（见 Decisions）。

## Background

- 2026-08-12 主会话对四条债务逐项核验，实测结论：
  - **main.ts（3426 行）**：L18-484 外壳渲染（renderApp/renderNavigation/header drawer/footer/TOC rail/主题 rail/navigateTo，~380 行）；L486-849 header drawer 交互 + `setupPageEnhancements` 编排（~360 行）；L850-2000 动效系统（selector 表 + 11 个 setup\*Motion，~1150 行）；L2001-3426 页面增强（TOC、代码复制、标签云、日期排序、主题过滤、归档 reveal、友链复制）+ 全局事件代理（~1400 行）。项目已有 `pages/`、`features/`、`components/`、`utils/` 分层（spec/frontend/directory-structure.md），main.ts 是唯一单体文件。
  - **类型重复**：`models.rs`（379 行）全量 `#[serde(rename_all = "camelCase")]` 且带"对应 TS xxx"注释；`types/api.ts`（121 行）+ `content.ts`（63 行）等分层镜像。当前形状对齐（pageSize 两端一致），属维护成本债非 bug。spec/type-safety.md:11,24,30 已承认此债务并约定手动镜像规则。
  - **时间戳（关闭）**：`now_iso()` = `to_rfc3339_opts(Millis)`，注释写明对齐 JS `toISOString()`，且同时用于 `published_at`；前端不消费 `/health` 字段。秒级只是旧 Elysia 实现历史。统一格式是合理现状，改动反而引入不一致。
  - **syntect（改方向）**：`markdown.rs:79-85` 已输出 `<pre data-language="x"><code class="hljs language-x">…</code></pre>`（为 hljs 准备的形态），但前端无任何 hljs 依赖，class 无人消费，代码块现为纯转义文本。文档原方向"引入 syntect"存在 syntect→hljs 类名映射不兼容的坑，改选**客户端 hljs 消费现有标记**。
- 与已存在任务 `08-12-tech-debt-cleanup`（文档漂移/空密码/脚本/依赖/测试框架落地）范围不重叠，各自独立。

## Requirements

- 父任务为任务地图持有者：三个子任务独立可交付、独立验收，见 Task Map。
- 子任务间唯一顺序约束：`client-hljs` 依赖 `main-split` 完成（hljs 挂接点落在拆分后的 `features/post-detail.ts` 上，避免双任务并发改同一大文件）。`type-contract` 与另外两者无依赖，可并行。
- 质量门（frontend）：`bun run typecheck && bun run build && bun test`；后端（type-contract）：`cargo test`。

## Task Map

| 子任务 | slug | 交付物 | 规划工件 |
| --- | --- | --- | --- |
| main.ts 拆分 | `08-12-main-split` | 动效→features/motion.ts、外壳→components/shell.ts、页面增强按页分发、main.ts 收尾 bootstrap | prd + design + implement |
| 类型契约加固 | `08-12-type-contract` | api_compat 键集断言 + 前端夹具测试（测试防线，不改生产代码） | prd + design |
| 客户端 hljs | `08-12-client-hljs` | highlight.js core + 按需语言，挂接渲染管线消费现有标记 | prd |

## Cross-Child Acceptance

- 三个子任务各自验收通过，且 `bun run typecheck && bun run build && bun test`、`cargo test` 全绿。
- main.ts 拆分后页面行为与拆分前一致（冒烟清单见 main-split implement.md）。
- spec 更新：type-safety.md 镜像同步规则如有演进需同步；directory-structure.md 中 main.ts 描述与拆分后现状一致。

## Out of Scope

- 第 ③ 条时间戳（关闭，理由见 Background）。
- 服务端 syntect 高亮方案。
- utoipa + openapi-typescript 全量落地（仅评估，不实施）。
- `08-12-tech-debt-cleanup` 任务范围内各项。

## Decisions

- 2026-08-12（本会话）：第 ③ 条（时间戳）核验后关闭，不实施。syntect 方向否决，改客户端 hljs。范围取 ①+②+④，三个子任务独立排期。
