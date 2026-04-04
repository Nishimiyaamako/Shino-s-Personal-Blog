# AI Workflow（Shino's Bolg）

> Updated on 2026-04-02.

## 1) 文件说明

- `MEMORY.md`：项目长期记忆（前 200 行高信噪比）。
- `STOP_HOOKS.md`：停止点自检规则。
- `ARCHITECTURE.md`：运行拓扑与端口/域名映射手册。
- `README.md`：协作入口（本文件）。

## 2) 当前架构一行结论

- 真实结构是：`一个前端 SPA（含 /admin/login 与 /admin/{module}） + 一个后端 API 服务`。
- 用户入口契约是：单域名 `https://<domain>`，后台入口路径 `https://<domain>/admin/login`。
- 后台登录接口固定：`POST /api/admin/auth/login`。

## 3) 一页式运行手册

### 3.1 本机开发（推荐：单域名入口）

1. 启动后端：`cd backend && bun run dev`（默认监听 `127.0.0.1:3001`）。
2. 启动前端：`cd frontend && bun run dev --host 127.0.0.1 --port 5173`。
3. 本机反代绑定一个域名到前端（默认建议 `blog.localhost`）。
4. 从 `http://blog.localhost/admin/login` 进入后台。
5. `frontend/.env.example` 默认已是开发代理链：
   - `VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:3001`
   - `VITE_API_BASE_URL=`（空值，走同源请求）
6. 可直接执行一键验收脚本（自动拉起服务、反代、链路检查、质量闸门）：
   - `./deploy/scripts/local-verify.sh`
   - 默认脚本使用 Docker Nginx `--network host`，避免前端绑定 `127.0.0.1` 时出现 `502 Bad Gateway`

开发态链路心智模型：

- 页面请求：`浏览器域名 -> 本机反代 -> Vite(:5173)`
- API 请求：`浏览器域名 -> 本机反代 -> Vite(:5173) -> Backend(:3001)`
- 上传资源：`/uploads/*` 走同一链路到后端

### 3.2 生产部署（单域名 + 同后端）

1. `https://<domain>` 指向同一前端构建产物（同一 SPA）。
2. 同一域名下把 `/api/*`、`/uploads/*` 反代到后端（默认 `127.0.0.1:3001`）。
3. 后台入口固定为同域路径 `/admin/login`。
4. 前端默认同源请求，不强制设置 `VITE_API_BASE_URL`。

## 4) 常见误解（重点）

- 误解：后台页面必须是另一套前端工程。
  - 现实：当前后台是同一 SPA 内路由，不是独立构建。
- 误解：浏览器没看到 `:3001` 就说明后端没参与。
  - 现实：生产态端口会被反代隐藏。
- 误解：只配 `/api` 反代就够了。
  - 现实：还要配 `/uploads`，否则图片预览会断。
- 误解：本机用域名后不需要关心 Vite 代理。
  - 现实：当前默认开发链路仍依赖 Vite 的 `/api` 与 `/uploads` 代理。
- 误解：Docker bridge 反代一定能访问前端 `127.0.0.1:5173`。
  - 现实：在 Linux 下 bridge 容器无法直连宿主 `127.0.0.1`，推荐用 host network 或改前端监听地址。

## 5) 标准工作回路

```text
需求 -> 计划 -> plan-stop-audit -> frontend-preflight-skill-stack(仅 frontend 改动) -> 实施 -> code-stop-typecheck -> delivery-stop-domain-port-chain(命中链路任务) -> task-stop-memory-sync -> 交付
```

## 6) 默认质量闸门

- `cd backend && bun run typecheck && bun run test && bun run build && cd ../frontend && bun run typecheck && bun run build`

## 7) 部署与巡检脚本（新增）

- 本机链路验收：`./deploy/scripts/local-verify.sh`
- 生产 env 检查：`./deploy/scripts/check-backend-prod-env.sh /path/to/backend.env`
- 线上 smoke：`./deploy/scripts/online-smoke.sh <domain>`
- 后端容器部署：`deploy/1panel-backend-deploy.md`
- 发布后巡检：`deploy/post-release-checklist.md`
- 备份恢复 Runbook：`deploy/backup-restore-runbook.md`

## 8) 前端技能自动路由（默认）

- 触发条件：任务将修改 `frontend/` 目录内任意受管文件。
- 默认技能链：`frontend-design -> harden -> polish`（固定顺序）。
- 优先级：用户显式点名的 skill 优先于默认技能链。
- 例外：非 frontend 改动任务不触发该链。
