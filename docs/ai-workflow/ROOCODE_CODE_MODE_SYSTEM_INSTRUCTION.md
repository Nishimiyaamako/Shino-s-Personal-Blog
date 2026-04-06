# RooCode Code Mode System Instruction（Tool Safety Guard）

> Updated on 2026-04-06.
> 用途：把这份内容粘贴到 RooCode 的 `Code` 模式系统指令/自定义规则中，用于阻断工具调用重复执行。

## 1) 可直接粘贴模板

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

## 2) 最小接入步骤

1. 打开 RooCode 的 `Code` 模式设置。
2. 将上面的 `[Tool Safety Guard - RooCode]` 整段粘贴到系统指令或模式规则中。
3. 保存后新开一个任务会话进行验证（避免旧会话缓存影响）。

## 3) 验收清单（手工）

1. 人工触发 `read_file(path='.')`：预期首个目录错误后切换 `list_files`，不重复读取 `.`。
2. 人工触发一次 `missing nativeArgs`：预期仅修参重试 1 次，然后停机等待用户决策。
3. 读取 2500+ 行文件：预期按分片递增 `offset`，不重复 `offset=1`。
4. 连续 3 次工具调用无新产物：预期进入 `stall mode` 并展示下一步选项。
