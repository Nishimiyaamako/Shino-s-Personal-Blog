# STOP_HOOKS.md（Shino's Bolg）

> Updated on 2026-04-06.
> 说明：这是 Codex 工作流约定，不是 Claude 原生 hooks 配置。

## 0) 全局策略

- 自动化强度：中等自动化（自动检查 + 报告，不无限循环修复）。
- 工具调用安全闸门：启用 `tool-stop-safety-guard`，阻断同参重试循环与无效参数重放。
- 输出契约：每个 hook 执行后都输出：
  - `Checks Run`
  - `Findings`
  - `Next Action`
- 默认质量闸门命令：`cd backend && bun run typecheck && bun run test && bun run build && cd ../frontend && bun run typecheck && bun run build`

---

## 1) Hook 定义

### Hook ID: `plan-stop-audit`

- **Trigger**：计划输出后、进入实现前。
- **Condition**：本次任务包含可执行计划。
- **Action**：检查目标、边界、验收、风险、回滚五项是否齐全。
- **On Fail**：先补计划，不直接进入编码。
- **Output Contract**：必须输出 `Checks Run / Findings / Next Action`。

### Hook ID: `frontend-preflight-skill-stack`

- **Trigger**：进入实现前且任务命中 frontend 改动。
- **Condition**：本次任务会修改 `frontend/` 下任意受管文件（代码/样式/资源/配置/文档）。
- **Action**：默认先声明并应用技能链 `frontend-design -> harden -> polish`；若用户显式点名其他 skill，则按用户指定执行，不强行追加默认链。
- **On Fail**：显式输出 `SKIP` 原因并继续任务，不阻断实现流程。
- **Output Contract**：必须输出 `Checks Run / Findings / Next Action`。

### Hook ID: `tool-stop-safety-guard`

- **Trigger**：编码执行阶段（每次 tool call 前后）。
- **Condition**：本轮任务发生工具调用，或最近一次工具调用返回错误。
- **Action**：执行以下规则，不允许省略：
  - 为每次工具调用生成签名：`<tool_name>::<normalized_args>`。
  - 同一签名连续失败达到 2 次：停止自动重试，向用户给出 2-3 个下一步选项。
  - `read_file` 禁止读取 `.` 或任何目录路径；若目标是目录，必须切换 `list_files`。
  - 当错误包含 `missing nativeArgs` 或 `Required values not set`：仅允许“补全参数后重试 1 次”；再次失败必须停机等待用户决策。
  - 当错误提示 `Use list_files tool instead`：下一次必须调用 `list_files`，不得再次 `read_file`。
  - 文件超过 2000 行时仅允许分片读取，且 `offset` 必须递增，不得重复回到 `offset=1`。
  - 连续 3 次工具调用未产生新产物（文件改动/有效读取/有效结果）时，进入 `stall mode`：汇总错误 + 提供选项 + 等待用户选择。
- **On Fail**：立即进入 `stall mode`，输出错误摘要和下一步选项，不直接继续执行。
- **Output Contract**：必须输出 `Checks Run / Findings / Next Action`。

### Hook ID: `code-stop-typecheck`

- **Trigger**：编码收尾前。
- **Condition**：命中主代码目录改动。
- **Action**：执行 `cd backend && bun run typecheck && bun run test && bun run build && cd ../frontend && bun run typecheck && bun run build`。
- **On Fail**：输出错误摘要、修复建议、是否需人工决策；不无限重试。
- **Output Contract**：必须输出 `Checks Run / Findings / Next Action`。

### Hook ID: `delivery-stop-domain-port-chain`

- **Trigger**：最终交付前。
- **Condition**：任务涉及任一项：启动方式、反代、域名、端口、API 基地址、部署文档。
- **Action**：显式核对并写出以下链路（至少一条 public 与一条 admin）：
  - 入口位置（例如 `https://<domain>/` 与 `https://<domain>/admin/login`）
  - 反代层（Vite dev proxy / Nginx / Caddy / 1Panel）
  - 上游服务与端口（`frontend:5173`、`backend:3001`）
  - 登录链路关键点（`/admin/login` 与 `POST /api/admin/auth/login`）
- **On Fail**：交付前先补齐链路说明，不直接结束任务。
- **Output Contract**：必须输出 `Checks Run / Findings / Next Action`。

### Hook ID: `task-stop-memory-sync`

- **Trigger**：任务完成前最后一步。
- **Condition**：出现新决策/新风险/约束更新/下一步变更。
- **Action**：回写 `MEMORY.md`（区块 3/4/5/6），并保持前 200 行高信噪比。
- **On Fail**：显式标注 memory sync 未完成及原因。
- **Output Contract**：必须输出 `Checks Run / Findings / Next Action`。

---

## 2) 执行日志模板

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

## 3) 域名/端口链路核对模板（用于 `delivery-stop-domain-port-chain`）

```md
### Route Chain Check
- Public Entry: <host + path>
- Admin Entry: <host + path>
- API Login Endpoint: POST /api/admin/auth/login

### Hop Mapping
- <host/path> -> <proxy> -> <upstream service:port>
- <host/path> -> <proxy> -> <upstream service:port>

### Conclusion
- [PASS|FAIL] 能否明确回答“请求从哪个域名进、被谁代理到哪里”
```

## 4) Tool Safety Guard 模板（用于 `tool-stop-safety-guard`）

```txt
[Tool Safety Guard - RooCode]
1) For every tool call, build a signature key: <tool_name>::<normalized_args>.
2) If the same signature fails twice in a row, STOP retries and ask user with 2-3 options.
3) Never call read_file on "." or any directory path. Use list_files first.
4) If tool error contains "missing nativeArgs" or "Required values not set":
   - reconstruct complete required args once
   - retry once only
   - on second failure, stop and ask user.
5) If tool error says "Use list_files tool instead", next call must be list_files (not read_file).
6) For files > 2000 lines, use slice reads with increasing offset; do not reset to offset=1 repeatedly.
7) If no new artifact is produced after 3 tool calls, enter "stall mode":
   - summarize last errors
   - present next action options
   - wait for user choice.
```
