# STOP_HOOKS.md（Codex 工作流约定版）

> 说明：这是“流程约定”，不是 Claude 原生 hooks 配置文件。  
> 目标：在关键停止点自动执行最小自检，减少漏项与上下文漂移。

## 0) 全局策略

- 自动化强度：**中等自动化**（自动检查 + 报告，不无限循环修复）。
- 输出契约：每次 hook 执行后必须输出三段：
  - `Checks Run`
  - `Findings`
  - `Next Action`
- 路径过滤：仅命中代码改动时触发代码检查；纯文档改动可跳过并说明原因。
- 命令优先级：优先 bun，缺失时回退 npm。

---

## 1) Hook 定义

### Hook ID: `plan-stop-audit`

- **Trigger**：完成开发计划后、进入实现前。
- **Condition**：本次回复包含可执行计划（任务分解、验收思路等）。
- **Action**：
  1) 检查目标是否明确（Goal / Success Criteria）。
  2) 检查边界是否明确（In/Out Scope）。
  3) 检查验收是否可测（测试场景是否覆盖主路径与失败路径）。
  4) 检查风险与回滚是否存在（至少一条风险处理策略）。
  5) 若有缺项，先补计划再进入实现。
- **On Fail**：输出缺失项清单与补全建议，不直接开始编码。
- **Output Contract**：
  - `Checks Run`: 列出 5 项审计点及通过/失败状态
  - `Findings`: 具体缺失项（如“缺少回滚策略”）
  - `Next Action`: 明确“补计划”或“进入实现”

### Hook ID: `code-stop-typecheck`

- **Trigger**：实现阶段准备收尾时（提交结果前）。
- **Condition**：改动命中以下任一范围：
  - `frontend/src/**`
  - `frontend/*.ts`
  - `frontend/tsconfig.json`
- **Action**：
  1) 执行 `bun run --cwd frontend typecheck`
  2) 若需要兼容旧写法，执行 `cd frontend && bun run typecheck`
  3) 若 bun 不可用，执行 `npm --prefix frontend run typecheck`
  4) 记录执行命令、退出码、关键报错位置（如有）
- **On Fail**：
  - 不进入无限自动修复；
  - 输出“错误摘要 + 建议修复步骤 + 是否需要人工决策”；
  - 若失败原因与本次改动无关，也要标注“历史债务/环境问题”。
- **Output Contract**：
  - `Checks Run`: 实际运行命令与结果
  - `Findings`: 通过/失败 + 关键错误摘要
  - `Next Action`: 修复建议或继续交付说明

### Hook ID: `task-stop-memory-sync`

- **Trigger**：任务完成前的最后一步（结果发布前）。
- **Condition**：本次任务存在任一项：
  - 新决策
  - 新风险
  - 约束更新
  - 下一步计划变化
- **Action**：
  1) 更新 `MEMORY.md` 的区块 3/4/5/6。
  2) 如前 200 行接近超限，优先保留约束与新决策，旧项下沉归档区。
  3) 写入当天更新时间（`YYYY-MM-DD`）。
- **On Fail**：
  - 若无法确定写入位置，至少在“当前任务与下一步”登记未决项；
  - 在输出中显式标注“memory sync 未完成”及原因。
- **Output Contract**：
  - `Checks Run`: 列出更新了哪些区块
  - `Findings`: 本次新增/调整的记忆条目
  - `Next Action`: 下次任务开始前需要先读的内容

---

## 2) 执行日志模板（可复用）

```md
### Checks Run
- [PASS|FAIL|SKIP] Hook ID: <id>
- Command: <command or N/A>

### Findings
- <关键结果 1>
- <关键结果 2>

### Next Action
- <立即动作>
- <是否需要人工确认>
```

## 3) 跳过规则（避免噪音）

- 仅改动 `docs/**`：`code-stop-typecheck` 可 `SKIP`，但必须注明“文档改动，未触发代码检查”。
- 仅改动流程文档（如本目录）：允许跳过类型检查。
- 任一源代码变更：不得跳过 `code-stop-typecheck`。
