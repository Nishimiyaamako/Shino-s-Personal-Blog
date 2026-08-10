# 工作区标准整理：拆分归纳旧工作流文档到 Trellis 结构

## Goal

将本项目遗留的多种工作流协作文档（CLAUDE.md、.planning/codebase/、plans/、docs/ARCHITECTURE.zh-CN.md、deploy/ 手册）按当前标准工作区形态（参照 OpenCode_Setting：AGENTS.md + .trellis harness + docs/ 知识文档 + llms.txt 自动索引）重新拆分归纳，删除旧文件，使项目具备统一的 agent 工作环境。

## Background

- 项目现状：frontend/（Vite + TS Vanilla SPA）+ backend/（Elysia + Drizzle + SQLite + JWT）+ deploy/（1Panel 运维资产）+ 五类旧工作流文档（约 2580 行）。
- 已执行：`trellis init --opencode -y -u Nishimiyaamako` 生成 `.trellis/` 骨架、模板 spec、AGENTS.md（Trellis 块）；`.opencode/` 被 .gitignore 忽略不入库。
- 旧文档内容有部分重复（ARCHITECTURE.zh-CN 与 .planning/ARCHITECTURE 内容重叠），需要合并去重。

## Requirements

1. **结构目标**（与 OpenCode_Setting 同形态）：
   - `AGENTS.md`：Trellis 块（已生成，保留）+ 工作区结构地图、文件查询机制（五层）、维护纪律、凭据红线、边界规则、自检清单。
   - `.trellis/spec/`：guides/backend/frontend 三层分层 spec，用真实代码库内容填充（非占位模板），结构对齐 trellis-spec-bootstrap 标准。
   - `docs/`：conventions.md（约定总纲）+ kb/（运维/集成知识文档）。
   - `llms.txt` + `.githooks/pre-commit` + `tools/gen-file-index.sh`：自动文件索引。
   - `.gitignore`：补充 .omo/ 等运行时目录；`git config core.hooksPath .githooks`。
2. **旧文档映射**（用户已确认）：
   - `CLAUDE.md` → 概览/命令 → AGENTS.md；路由/API 地图 → `.trellis/spec/backend/api.md`。
   - `.planning/codebase/ARCHITECTURE.md` + `docs/ARCHITECTURE.zh-CN.md` → 合并去重 → `.trellis/spec/architecture.md`。
   - `.planning/codebase/STRUCTURE.md` → 拆为 spec/backend/directory-structure.md + spec/frontend/directory-structure.md。
   - `.planning/codebase/CONVENTIONS.md` → 拆为 spec/backend/conventions.md + spec/frontend/conventions.md。
   - `.planning/codebase/STACK.md` → 并入 spec/architecture.md 或独立 tech-stack.md。
   - `.planning/codebase/TESTING.md` → spec/backend/testing.md + spec/frontend/testing.md。
   - `.planning/codebase/CONCERNS.md` → 有效内容（安全/质量）并入 spec 对应章节，其余作为分析快照丢弃。
   - `.planning/codebase/INTEGRATIONS.md` → `docs/kb/integrations.md`。
   - `plans/admin-redesign.md` → 已实施设计稿，删除（git 历史可恢复）。
   - `deploy/*.md` 手册 → 归纳为 `docs/kb/deploy-ops.md`；deploy/scripts + deploy/nginx 保留原位。
   - 旧文件全部删除：CLAUDE.md、.planning/、plans/、docs/ARCHITECTURE.zh-CN.md。
3. **新增文档**：docs/conventions.md（约定总纲：目录职责、schema、查询机制、KB 规则、自检清单）。

## Constraints

- 凭据红线：任何密码/私钥/令牌不得写入文档；backend/.env 不入库（.gitignore 兜底）；引用凭据位置用 `<凭据位置>` 占位。
- spec 内容必须基于真实代码库（读取现有源码/文档后编写），不得留占位符。
- llms.txt 为生成产物，禁止手改。
- 不启用 RAGFlow 知识同步（本项目为代码项目，非文档工作区）。
- 待核验事实标注 `⚠ 待核验：<事项>`，未决标记不得随提交入库。

## Acceptance Criteria

- [ ] 旧文档（CLAUDE.md、.planning/、plans/、docs/ARCHITECTURE.zh-CN.md）已删除，git 历史可追溯。
- [ ] `.trellis/spec/` 下 guides/backend/frontend 均为真实内容（无 "To fill" 占位），含 backend/api.md、architecture.md、backend+frontend 的 directory-structure/conventions/testing。
- [ ] AGENTS.md 含结构地图、五层查询机制、维护纪律、凭据红线、边界规则、自检清单。
- [ ] docs/conventions.md、docs/kb/deploy-ops.md、docs/kb/integrations.md 存在且内容完整。
- [ ] tools/gen-file-index.sh + .githooks/pre-commit 就位，`git config core.hooksPath` 返回 .githooks；llms.txt 自动生成且只含新结构文件。
- [ ] 自检三命令通过：无 ⚠ 待核验、无凭据泄漏（仅 `<凭据位置>` 占位）、hooksPath 正确。
- [ ] 全部内容已提交（含删除），git 工作区干净。
