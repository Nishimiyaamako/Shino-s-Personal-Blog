# MEMORY.md（Shino's Bolg）

> Updated on 2026-04-02.
> 目标：把会影响实现决策的关键信息压缩在前 200 行。

## 0) 维护约定（前 200 行工作区）

- 前 200 行只保留“会影响实现与验收”的信息。
- 每次任务收尾至少更新：关键决策 / 风险 / 当前任务 / 最近更新。
- 日期格式统一：`YYYY-MM-DD`。
- 历史细节下沉到文末 `Archive`，不污染默认上下文。

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

- 项目名：`Shino's Bolg`
- 项目根目录：`/home/shino/Codes/Personal Blog`
- 技术栈：`Frontend: Vite + TypeScript (Vanilla SPA, 含后台页面); Backend: Elysia.js + Drizzle + SQLite + JWT`
- 真实架构：`一个前端 SPA + 一个后端 API 服务`
- 前端路由含后台：`/admin/login`、`/admin`
- 后端登录接口：`POST /api/admin/auth/login`
- 后端默认端口：`3001`（`backend/src/config/env.ts`）
- Vite 开发默认端口：`5173`（未显式改写）
- `frontend/.env.example`：`VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:3001`，`VITE_API_BASE_URL=`（默认同源）
- 访问契约：`blog.<domain>`（前台）+ `admin.<domain>`（后台入口域名）
- 默认质量闸门命令：`cd backend && bun run typecheck && bun run test && bun run build && cd ../frontend && bun run typecheck && bun run build`
- 协作文档目录：`docs/ai-workflow/`

## 2) 不可违反约束（预算 ≤ 35 行）

- 不拆后台为独立前端工程，除非用户明确提出并批准迁移。
- 后台入口域名策略固定为“独立子域名”；`admin.<domain>/` 应跳转到 `/admin/login`。
- 前台与后台都走同一套后端服务，`/api` 与 `/uploads` 必须可达后端。
- 默认优先同源 API：`VITE_API_BASE_URL` 为空；若改成绝对地址，必须在任务说明里解释跨域影响。
- 任何涉及启动/部署/反代的交付，必须写清“域名 -> 反代 -> 服务 -> 端口”链路。
- 命中 `frontend/` 改动的任务，进入实现前默认执行技能链：`frontend-design -> harden -> polish`。
- 若用户显式点名其他 skill，以用户指定优先；默认链不强行追加。
- Stop Hooks 采用中等自动化：自动检查 + 报告，不无限重试。
- 默认收尾输出三段：`Checks Run / Findings / Next Action`。

## 3) 关键决策（预算 ≤ 55 行）

- 决策：`backend/` 已是真实可运行服务，不再按“placeholder”认知处理。
- 决策：前台与后台页面在同一 SPA 内实现，后台通过路由 `/admin*` 进入。
- 决策：用户感知入口采用双域名：`blog.<domain>` 与 `admin.<domain>`。
- 决策：双域名共享同一后端服务，API 契约不分裂。
- 决策：后台域名以“登录入口语义”为主，根路径应重定向到 `/admin/login`。
- 决策：本机调试主推统一域名入口（local reverse proxy），隐藏端口心智负担。
- 决策：开发期 API 代理保持 Vite 现状（`/api`、`/uploads` -> `3001`）。
- 决策：质量闸门主命令维持 backend + frontend 双段校验。
- 决策：frontend 任务默认技能链继续保持 `frontend-design -> harden -> polish`。
- 决策：任务收尾必须执行 memory sync。

## 4) 已踩坑与回归风险（预算 ≤ 40 行）

- 风险：开发链路与生产链路混用描述，容易误判问题位置（以为后端挂了，实际是反代没通）。
  - 防护：所有交付附“链路四段式”说明：入口域名、反代层、上游服务、目标端口。
- 风险：`admin.<domain>` 未做根路径跳转时，访问 `/` 会落到前台首页，造成“后台丢失”错觉。
  - 防护：为后台域名单独配置 `/ -> /admin/login`。
- 风险：`VITE_API_BASE_URL` 被误设为固定地址后，会和“同源代理”策略冲突并引入跨域复杂度。
  - 防护：默认保持空值；仅在明确跨域方案时填写，并同步说明 CORS 策略。
- 风险：上传图片路径只代理 `/api` 不代理 `/uploads` 时，后台可上传但前台/后台预览失效。
  - 防护：部署与本机代理必须同时覆盖 `/api` 与 `/uploads`。
- 风险：对所有 frontend 改动统一套用设计链，可能在纯逻辑改动中造成过度设计。
  - 防护：用户显式点名 skill 优先；必要时在计划中裁剪技能范围。

## 5) 当前任务与下一步（预算 ≤ 35 行）

- 当前任务：重构 AI 协作文档，统一“双域名后台 + 端口链路认知”。
- 下一步 1：按 `docs/ai-workflow/ARCHITECTURE.md` 在本机落地 `blog.local.test` / `admin.local.test` 代理。
- 下一步 2：在真实排障中复用“先域名、再反代、再后端端口”的最小排查流程。
- 下一步 3：后续若新增部署方式（Docker/Caddy/1Panel 子站点），同步更新架构页映射表。

## 6) 最近更新记录（预算 ≤ 10 行）

- 2026-04-02：确认真实架构为“同一 SPA（含 admin 路由）+ 单后端 API 服务”。
- 2026-04-02：确立访问契约：`blog.<domain>` 前台、`admin.<domain>` 后台入口。
- 2026-04-02：将本机调试默认策略改为“统一域名入口 + 本机反代”。
- 2026-04-02：补充域名/端口链路核对要求，避免开发态与生产态心智混淆。

---

## Archive（200 行外历史区）

> 保存低频历史记录，不作为默认上下文注入。
