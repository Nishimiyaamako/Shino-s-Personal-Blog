<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

---

# Shino's Bolg 工作区治理

> Trellis 块（上方）由 trellis update 管理；本块为工作区治理内容，与 Trellis 块共存。

本仓库是 **Shino's Bolg**（注意：Bolg 为有意拼写，不得自动纠正）个人博客全栈项目：`frontend/`（Vite + Vanilla TS SPA）+ `backend/`（Rust(Axum+Postgres) 单一 crate）+ `deploy/`（systemd + nginx 运维资产）。开始任何任务前，先读 `.trellis/workflow.md` 与 `.trellis/spec/` 对应分层规范；本文档定义结构地图与维护纪律。

## 结构地图

| 路径 | 放什么 | 何时读 |
| --- | --- | --- |
| `AGENTS.md` | agent 读规则：结构地图、查询机制、维护纪律、自检清单 | 所有任务开始时 |
| `.trellis/` | Trellis 工作流目录（workflow.md / spec/ / tasks/ / workspace/） | 任务驱动、写代码前读对应层 spec |
| `.trellis/spec/architecture.md` | 系统架构总览 | 涉及跨层改动时 |
| `.trellis/spec/tech-stack.md` | 技术栈与环境变量速查 | 查依赖、环境时 |
| `.trellis/spec/backend/` | 后端规范（api / directory-structure / database / error-handling / quality / logging / testing） | 后端开发时 |
| `.trellis/spec/frontend/` | 前端规范（directory-structure / component / state-management / type-safety / quality / testing） | 前端开发时 |
| `docs/conventions.md` | 约定总纲（frontmatter schema、边界规则、自检清单） | 所有文档作者 |
| `docs/kb/` | 知识文档（deploy-ops / integrations） | 查运维、集成时 |
| `deploy/` | 部署资产：systemd 单元 / scripts / nginx 模板 / 手册入口（手册正文见 docs/kb/deploy-ops.md） | 部署运维时 |
| 根 `llms.txt` | 文件系统索引，pre-commit 钩子自动重生成 | 快速定位文件时 |
| `.githooks/` + `tools/` | 提交钩子与索引生成脚本 | 提交时自动触发 |

> 结构地图只到目录级，不列文件清单；文件级清单以 `git ls-files` 与根 `llms.txt` 为准。

## 文件查询机制（五层，一句话版）

长任务找文件按五层决策树：L1 读本文件结构地图 → L2 `git ls-files` 权威清单 → L3 根 `llms.txt` 生成索引 → L4 grep/Read 原生检索 → L5 RAGFlow KB 语义兜底（本项目未启用知识同步，跳过）。

## 维护纪律

- `llms.txt` 由 pre-commit 钩子自动重生成，禁止手改。
- `llms.txt` 首次生成（未跟踪）时钩子不会自动 add，需手动 `git add llms.txt` 一次。
- 提交前在仓库根运行自检三命令（见文末自检清单）。
- 克隆后需执行 `git config core.hooksPath .githooks`，否则钩子不生效。
- 后端 `.env`、`backend/rust/target/` 均不入库（.gitignore 兜底）。

## 凭据红线

任何密码、私钥、令牌一律不得写入任何文档。需要引用凭据位置时使用占位写法 `<凭据位置>`，不写实际值。此条为硬红线，适用于本仓库所有文件。

## 边界规则

- 环境事实与操作手册归 `docs/`；计划与任务归 `.trellis/tasks/`；一次性内容不落 `docs/`，同一内容不得两处并存。
- 部署手册正文集中在 `docs/kb/deploy-ops.md`；`deploy/` 只保留脚本/模板等可执行资产与指向手册的链接。
- 旧协作文档（CLAUDE.md、.planning/、plans/）已拆分归纳进 `.trellis/spec/` 与 `docs/`，不得重新引入。
- `.opencode/` 不维护：Trellis 平台适配已全局化于 `~/.config/opencode/`，`trellis init` 生成的项目副本会覆盖全局自定义，init 后立即删除。

## 待核验标记

未确认的事实必须标注统一格式，不得臆造：

> ⚠ 待核验：<事项>（需 <核验方式>；来源：<会话id或文件>）

未决的待核验标记不得随文档提交入库。

## 自检清单

提交前在仓库根运行：

```
grep -rn '⚠ 待核验' . --include='*.md'
grep -rnE '(password|passwd|api[_-]?key|token|secret|private[_-]?key)[[:space:]]*[:=]' . --include='*.md'
grep -rnE 'BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}' . --include='*.md'
git config core.hooksPath
```

期望：前两条输出为空（或仅为 `<凭据位置>` 占位与正文合法引用），第三、四条无误；`git config core.hooksPath` 应返回 `.githooks`。

## 知识自动入库

知识自动入库：本工作区已提交的文档由 kb-sync 自动同步进 RAGFlow 知识库（git 提交 = 审核通过，回滚 = git revert）；管理用 kb-manage skill；质量标准见 /home/shino/workspace/ragflow-sync/docs/kb-standard.md
