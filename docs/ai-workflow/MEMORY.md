# MEMORY.md（Codex 工作流记忆主文件）

> 目标：把“长期记忆”压缩成前 200 行的高信噪比简报。  
> 规则：只保留会影响当前与下一步决策的信息；历史细节下沉到文末归档区。  
> 日期格式：`YYYY-MM-DD`。

## 0) 维护约定（前 200 行工作区）

- 本文件前 200 行是默认上下文区，必须高密度、可执行、可追踪。
- 每次任务收尾至少更新：**关键决策 / 已踩坑 / 当前任务 / 最近更新**。
- 若前 200 行超预算：优先保留“约束与决策”，把旧记录迁移到文末归档区。
- 不写空泛复述；只写“会改变实现选择或验收结果”的事实。

### 结构与预算（总计 ≤ 200 行）

| 区块 | 预算 |
| --- | --- |
| 1) 项目快照 | ≤ 25 行 |
| 2) 不可违反约束 | ≤ 35 行 |
| 3) 关键决策 | ≤ 55 行 |
| 4) 已踩坑与回归风险 | ≤ 40 行 |
| 5) 当前任务与下一步 | ≤ 35 行 |
| 6) 最近更新记录 | ≤ 10 行 |

---

## 1) 项目快照（预算 ≤ 25 行）

- 仓库：`Personal Blog`
- 当前阶段：v0 骨架期（静态内容优先，后端能力占位）
- 前端：`Vite + TypeScript + Vanilla SPA`（`frontend/`）
- 后端：`Elysia.js` 最小 API 已落地（`/api/health`、`/api/stats`、`/api/friends`）
- 前端入口：`frontend/src/main.ts`
- 样式入口现状：`main.ts` 默认引入 `frontend/src/styles/shell.onboard.css`（背景图直出 + 极简暖色基线）
- 内容入口现状：`frontend/src/data/posts.ts` 负责扫描 `src/content/posts/*.md` 并产出文章集合
- 路由入口：`frontend/src/router/index.ts`
- 安全工具：`frontend/src/utils/escape-html.ts`
- 文档基线：`docs/blueprint.md`、`PROJECT_STRUCTURE.zh-CN.md`
- 新增流程文档目录：`docs/ai-workflow/`

## 2) 不可违反约束（预算 ≤ 35 行）

- 路由契约必须持续可用：`/`、`/posts`、`/posts/:slug`、`/tags`、`/tags/:tag`、`/archive`、`/friends`、`/about`、`/404`。
- `ROUTE_RECORDS` 必须保留 `/404` 兜底，否则 `getNotFoundRoute()` 会抛错。
- 动态路由参数输出到 HTML 前必须转义：统一使用 `escapeHtml()`。
- 友链外链必须使用 `target="_blank"` + `rel="noopener noreferrer"`，并限制为 http/https 协议。
- Markdown frontmatter 现行必填：`title`、`slug`、`date(YYYY-MM-DD)`、`tags(string[])`。
- Markdown `slug` 必须唯一；重复或 frontmatter 不合规的文章应被跳过并输出告警，不得导致页面崩溃。
- 当前不引入额外质量工具（ESLint/Prettier/Biome）；质量闸门先基于现有 `typecheck/build`。
- Stop Hooks 策略为“中等自动化”：自动检查 + 报告，不做无限自修复循环。
- MEMORY 维护遵循“前 200 行优先”；归档信息不得挤占核心上下文区。
- 文档与注释默认中文，必要时可补英文镜像但不替代中文主版本。
- 工程结构变化时需同步 `PROJECT_STRUCTURE.zh-CN.md`。

## 3) 关键决策（预算 ≤ 55 行）

- 决策：采用 **Codex 工作流约定版** Memory + Stop Hooks，不依赖 Claude 原生配置文件。
- 决策：流程文件统一放在 `docs/ai-workflow/`，避免污染根目录。
- 决策：记忆文件采用固定六段结构 + 行数预算，而非自由笔记。
- 决策：任务收尾强制执行“memory sync”（更新决策/风险/下一步）。
- 决策：代码检查钩子仅在命中前端改动时触发，命令顺序：
  1) `bun run --cwd frontend typecheck`
  2) 若需兼容旧写法，可用 `cd frontend && bun run typecheck`
  3) bun 不可用时回退 `npm --prefix frontend run typecheck`
- 决策：计划输出后先执行 `plan-stop-audit`，检查目标、边界、验收、风险、回滚五项。
- 决策：所有 stop hook 输出统一三段：`Checks Run` / `Findings` / `Next Action`。
- 决策：失败时输出“错误摘要 + 修复建议 + 是否需人工决策”，不进入无穷重试。
- 决策：全站继续使用静态背景图 `/神椿.png` 直出（`center/cover`），以 `background-color` 做加载失败兜底。
- 决策：友链页首版使用前端本地数据渲染（字段对齐后端），后续再切换 `/api/friends` 请求。
- 决策：文章列表与详情改为构建期自动扫描 `src/content/posts/*.md`，新增文章无需改路由与页面代码。
- 决策：Markdown 渲染链路改为“内置 frontmatter 解析器 + marked”，避免浏览器端引入 Node-only 解析库。

## 4) 已踩坑与回归风险（预算 ≤ 40 行）

- 风险：记忆内容过载会导致真正关键约束被淹没（尤其在前 200 行内）。
  - 防护：新信息写入前先判断“是否改变实现选择”；否则下沉归档。
- 风险：只写结论不写约束来源，后续容易误改。
  - 防护：关键决策必须附最小上下文（影响面/触发条件）。
- 风险：typecheck 仅覆盖 TS 类型问题，不覆盖格式与潜在运行时逻辑。
  - 防护：报告中明确“已检查范围”与“未覆盖范围”。
- 风险：错误的 bun 参数顺序可能导致“看似执行、实则未检查”。
  - 防护：统一采用 `bun run --cwd frontend typecheck`（已验证可执行）。
- 风险：纯文档改动误触发代码检查，造成噪音。
  - 防护：在 hook 条件中按路径过滤（`frontend/src/**` 等）。
- 风险：友链外链若未做协议限制，可能出现 `javascript:` 等危险 href。
  - 防护：渲染前统一校验 URL，仅允许 `http/https`，非法值降级为不可点击状态。
- 风险：前端与后端友链字段不一致会导致后续切换接口时回归问题。
  - 防护：本地数据结构与 `/api/friends` 响应字段保持完全同构（id/name/url/description/avatar）。
- 风险：Markdown frontmatter 不规范（缺字段/日期格式错/slug 重复）会让文章“消失”。
  - 防护：在扫描时输出明确告警，并在 `docs/content-spec.md` 固化必填规范与示例模板。
- 风险：浏览器端误引入 Node-only 内容解析库会导致首屏脚本崩溃（页面只剩背景）。
  - 防护：内容解析依赖优先选择浏览器兼容实现；新增依赖时先验证 build 产物无 Node external 桥接。
- 风险：Markdown 原文含 HTML 时会被直接渲染，若来源不可信会有注入风险。
  - 防护：当前仅允许仓库内受信内容；若后续开放用户输入，需引入 HTML sanitize 流程。

## 5) 当前任务与下一步（预算 ≤ 35 行）

- 当前任务：落地 Markdown 自动接入链路（扫描目录即出现在列表与详情）。
- 本轮最小交付：
  - 前端新增 `posts` 数据加载模块，自动解析 `src/content/posts/*.md`。
  - `/posts` 与 `/posts/:slug` 切换到真实 Markdown 数据渲染（非占位）。
  - 建立 `docs/content-spec.md` frontmatter 规则并接入测试文章。
- 下一步候选：
  1) 为文章详情补充目录、上一篇/下一篇导航与代码高亮主题。
  2) 将 `PostItem` 抽象成前后端共用 DTO，准备从静态源切换到数据库 API。
  3) 在内容 CI 中加入 frontmatter 校验，提前拦截不合规 Markdown。

## 6) 最近更新记录（预算 ≤ 10 行）

- 2026-03-15：初始化 Memory 结构（六段预算 + 200 行纪律）。
- 2026-03-15：写入首版项目快照、约束、决策、风险与下一步。
- 2026-03-15：对齐 Codex 工作流版 Stop Hooks 设计（中等自动化）。
- 2026-03-16：新增全站静态背景基线（`/神椿.png` + 渐变兜底）并固定为默认样式入口。
- 2026-03-16：新增前端 `/friends` 页面与导航入口，友链首版采用本地数据渲染。
- 2026-03-16：后端落地 Elysia 最小接口，新增 `GET /api/friends` 占位返回。
- 2026-03-16：背景策略调整为图片直出（移除背景叠层），友链改为整卡可点击跳转。
- 2026-03-16：新增 Markdown 自动扫描链路（`gray-matter + marked`），文章支持“放文件夹即接入”。
- 2026-03-16：修复空白页：移除 `gray-matter`，改用浏览器内置 frontmatter 解析器并保留 `marked`。

---

## Archive（200 行外历史区，不默认注入）

> 仅存放历史记录与低频细节。进入新阶段时可将旧决策迁移到此区。  
> 使用建议：每条归档记录包含日期、背景、结论、是否仍有效。
