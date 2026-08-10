---
type: conventions
updated: 2026-08-10
---

# Shino's Bolg 仓库约定

本文档定义本仓库的文档组织、frontmatter schema、命名规则、边界规则、凭据红线、待核验标记约定、文件查询机制与自检清单。本仓库是 Shino's Bolg 个人博客全栈代码项目，采用 Trellis harness 驱动任务。所有新增或修改的文档必须遵守本文档；本文档是 AGENTS.md 的约定依据。

## ① 目录职责表

| 路径 | 放什么 | 何时读 |
| --- | --- | --- |
| `AGENTS.md` | agent 读规则：结构地图、查询机制、维护纪律、自检清单 | 所有 agent 任务开始时 |
| 根 `llms.txt` | 文件系统索引（type/updated/摘要），pre-commit 钩子自动重生成 | 快速定位文件时 |
| `docs/conventions.md` | 本文件：仓库约定总纲 | 所有文档作者 |
| `docs/kb/` | 知识文档（运维手册、集成清单） | 查运维、集成时 |
| `.githooks/` | 提交钩子（pre-commit 重生成 llms.txt） | 提交时自动触发 |
| `tools/` | 脚本（gen-file-index.sh 等） | 运行索引生成时 |
| `.trellis/` | Trellis 工作流目录（config.yaml / workflow.md / spec/ / tasks/ / workspace/），已入库跟踪；不入 llms.txt | Trellis 任务驱动时 |
| `deploy/` | 部署资产：scripts / nginx 模板 / artifacts（文档正文集中在 docs/kb/deploy-ops.md） | 部署运维时 |

> 结构地图只到目录级，不列文件清单；文件级清单以 `git ls-files` 与根 `llms.txt` 为准。

## ② frontmatter schema

docs/ 下的 Markdown 文档必须以 `---` 开头并携带 YAML frontmatter。固定 schema：

| 键 | 取值 | 必填 |
| --- | --- | --- |
| `type` | `conventions` / `kb-ops` | 所有 docs/ 文档必填 |
| `status` | `draft` / `active` / `archived` | 可选，默认 `active` |
| `updated` | `YYYY-MM-DD` | **必填** |

- `type: conventions`：约定类文档（如本文件）。
- `type: kb-ops`：运维/知识操作手册（docs/kb/ 下）。
- `updated` 最近更新日期，任何文档修改后必须同步更新。

`.trellis/spec/` 下规范文档为 Trellis spec 格式（标题 + 指南目录），不要求 frontmatter，且不入 llms.txt 索引。

## ③ 文件查询机制（五层）

长任务找文件按五层决策树：L1 读 AGENTS.md 结构地图（目录级稳定、字节稳定置首）→ L2 `git ls-files` 权威清单 → L3 根 `llms.txt` 生成索引 → L4 grep/Read 原生检索 → L5 RAGFlow KB 语义兜底（本项目未启用知识同步，跳过）。

## ④ 边界规则

- 环境事实与操作手册归 `docs/kb/`；计划与任务归 `.trellis/tasks/`；一次性内容不落 `docs/`，同一内容不得两处并存。
- 部署手册正文集中在 `docs/kb/deploy-ops.md`；`deploy/` 只保留脚本/模板等可执行资产与指向手册的链接。
- 旧协作文档（CLAUDE.md、.planning/、plans/、docs/ARCHITECTURE.zh-CN.md）已拆分归纳进 `.trellis/spec/` 与 `docs/`，不得重新引入。

## ⑤ 凭据红线

任何密码、私钥、令牌一律不得写入任何文档。需要引用凭据位置时使用占位写法 `<凭据位置>`，不写实际值。此条为硬红线，适用于本仓库所有文件。

## ⑥ 待核验标记

未确认的事实必须标注统一格式，不得臆造：

> ⚠ 待核验：<事项>（需 <核验方式>；来源：<会话id或文件>）

未决的待核验标记不得随文档提交入库。

## ⑦ 自检清单

提交前在仓库根运行：

```
grep -rn '⚠ 待核验' . --include='*.md'
grep -rnE '(password|passwd|api[_-]?key|token|secret|private[_-]?key)[[:space:]]*[:=]' . --include='*.md'
grep -rnE 'BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}' . --include='*.md'
git config core.hooksPath
```

期望：前两条输出为空（或仅为 `<凭据位置>` 占位与正文合法引用），第三、四条无误；`git config core.hooksPath` 应返回 `.githooks`。
