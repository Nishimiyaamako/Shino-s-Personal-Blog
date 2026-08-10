# Implement: 执行清单

## 前置

- [x] trellis init --opencode -y -u Nishimiyaamako（.trellis/ 骨架 + AGENTS.md Trellis 块 + .opencode/ 已忽略）
- [x] task.py create（本任务，已激活）

## Phase 2 执行

1. 通读旧文档原文（CLAUDE.md 剩余部分、.planning/codebase/*、docs/ARCHITECTURE.zh-CN.md、deploy/*.md），提取事实（端口/路由/API/表结构/命令/约定/测试方式/运维步骤）。
2. 填充 spec：
   - spec/architecture.md（合并两份 ARCHITECTURE，去重，中文正文）
   - spec/tech-stack.md（STACK.md 内容）
   - spec/backend/api.md（CLAUDE.md 路由/API 表）
   - spec/backend/directory-structure.md（STRUCTURE 后端部分 + 实际目录）
   - spec/backend/conventions.md（CONVENTIONS 后端部分）
   - spec/backend/testing.md（TESTING 后端部分）
   - spec/backend/database-guidelines.md、error-handling.md、logging-guidelines.md（模板 → 按实际代码填充或按实际情况删除多余模板项）
   - spec/frontend/directory-structure.md、conventions.md、testing.md 同上
   - spec 各 index.md 更新（去掉 To fill，改为真实指南清单）
3. 写 AGENTS.md 治理块（TRELLIS:END 之后）：结构地图、五层查询、维护纪律、凭据红线、边界规则、自检清单。
4. 写 docs/conventions.md（约定总纲，裁剪自 OpenCode_Setting）。
5. 写 docs/kb/deploy-ops.md（归纳 deploy/*.md 手册）与 docs/kb/integrations.md（INTEGRATIONS.md）。
6. 复制 tools/gen-file-index.sh + .githooks/pre-commit，适配头部注释与仓库名；chmod +x。
7. 追加 .gitignore（.omo/、node_modules 已有 backend/frontend 各自 gitignore 则根部只补 .omo/）；确认 .trellis/.gitignore 覆盖运行时。
8. 删除旧文件：CLAUDE.md、.planning/、plans/、docs/ARCHITECTURE.zh-CN.md。
9. git config core.hooksPath .githooks。

## 验证

- [ ] grep -rn '⚠ 待核验' . --include='*.md'（空）
- [ ] grep -rnE '(password|passwd|api[_-]?key|token|secret|private[_-]?key)[[:space:]]*[:=]' . --include='*.md'（仅 `<凭据位置>` 占位）
- [ ] grep -rnE 'BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}' . --include='*.md'（空）
- [ ] git config core.hooksPath == .githooks
- [ ] llms.txt 由钩子自动重生成，条目 = docs/** + README.md（无 README 则仅 docs/**）
- [ ] spec 无 "To fill"/"TBD" 占位
- [ ] git status 干净（除拟提交变更）

## 提交

- 提交 1：feat(workspace): 建立 Trellis 标准工作区结构（spec/docs/AGENTS/hooks/索引工具/gitignore）
- 提交 2：refactor(workspace): 删除旧工作流文档（CLAUDE.md/.planning/plans/ARCHITECTURE.zh-CN.md）

## 回滚点

- 提交前：git restore 全部删除文件即可恢复。
- 提交后：git revert <commit>。
