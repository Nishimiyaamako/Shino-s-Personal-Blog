# AI Workflow（Memory Files + Stop Hooks）

这套文档把“会忘、靠反复提醒”的 AI 协作模式，升级为“有记忆、会自检”的工作流。

## 1) 文件说明

- `MEMORY.md`：项目长期记忆主文件（前 200 行高信噪比区）。
- `STOP_HOOKS.md`：Stop Hooks 规则（Codex 工作流约定版）。
- `README.md`：使用手册与演练指南（本文件）。

## 2) 标准工作回路

```text
需求 -> 计划 -> plan-stop-audit -> 实施 -> code-stop-typecheck -> task-stop-memory-sync -> 交付
```

### 阶段说明

1. **需求阶段**：先读 `MEMORY.md` 前 200 行，避免重复踩坑。
2. **计划阶段**：输出计划后执行 `plan-stop-audit`，补齐缺项再动手。
3. **实施阶段**：编码完成后执行 `code-stop-typecheck`。
4. **收尾阶段**：执行 `task-stop-memory-sync`，更新决策/风险/下一步。

## 3) 触发条件（什么时候跑 typecheck）

### 运行 `code-stop-typecheck`

- 变更命中：
  - `frontend/src/**`
  - `frontend/*.ts`
  - `frontend/tsconfig.json`
- 推荐命令顺序：
  1) `bun run --cwd frontend typecheck`
  2) `cd frontend && bun run typecheck`（兼容写法）
  3) `npm --prefix frontend run typecheck`（bun 不可用时）

### 可跳过 `code-stop-typecheck`

- 仅改 `docs/**` 且无源码变更。
- 仅改本目录流程文档。

> 跳过时也要输出 `Checks Run / Findings / Next Action`，并注明跳过原因。

## 4) 任务收尾模板（复制即用）

```md
### Checks Run
- [PASS|FAIL|SKIP] plan-stop-audit
- [PASS|FAIL|SKIP] code-stop-typecheck
- [PASS|FAIL|SKIP] task-stop-memory-sync

### Findings
- 本次关键决策：
- 本次新增风险：
- 本次验证结果：

### Next Action
- 立即下一步：
- 是否需要人工决策：
```

## 5) 快速演练（对应测试场景）

1. **计划场景**：先故意漏掉验收标准，确认 `plan-stop-audit` 能识别缺项。
2. **代码场景（通过）**：改一个 `frontend/src` 文件并通过 typecheck。
3. **代码场景（失败）**：制造一个 TS 错误，验证失败输出是否有修复建议。
4. **文档场景**：只改 `docs/`，确认 typecheck 被 `SKIP` 且有理由。
5. **记忆边界场景**：让 MEMORY 逼近 200 行，验证旧条目能下沉归档区。

## 6) 维护原则（一句话版）

- 记忆要短、准、可执行；  
- Hooks 要稳定、可复现、可解释；  
- 失败要可诊断，不要盲目自动重试。
