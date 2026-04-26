# ARCHITECTURE.md（Shino's Bolg）

> Updated on 2026-04-26.
> 目的：统一"单域名同源 + 本机端口隐藏"心智，让开发与生产链路可一眼定位。

## 1) 当前真实结构

- 前端：单一 SPA（公开页面 + 后台页面）。
- 后台页面路由：`/admin/login`、`/admin/posts`、`/admin/featured`、`/admin/friends`、`/admin/about`、`/admin/profile`（与前台页面同一前端工程）。
- 后端：单一 API 服务（Elysia），默认端口 `3001`。
- 后台登录接口：`POST /api/admin/auth/login`。
- 部署契约：单域名入口 `https://<domain>`，后台从同域路径进入（`/admin/login`）。
- 后端运行方式：直接进程常驻（非 Docker 容器），由进程管理器负责自动重启。

## 2) 本机开发拓扑（推荐）

```text
Browser
  |- http://blog.localhost
          |
          v
Local Reverse Proxy (Nginx/Caddy)
  |- all routes -> http://127.0.0.1:5173
          |
          v
Vite Dev Server (:5173)
  |- page routes: /, /posts, /admin/login, /admin/{module}
  |- /api/* and /uploads/* -> proxy target http://127.0.0.1:3001
          |
          v
Backend API (Elysia :3001)
```

核心心智：浏览器只看一个域名；端口细节在反代与 Vite 代理内部完成。

## 3) 生产部署拓扑（单域名）

```text
Browser
  |- https://<domain>
          |
          v
Nginx / 1Panel
  |- /api/* -> http://127.0.0.1:3001
  |- /uploads/* -> http://127.0.0.1:3001
  |- other routes -> SPA dist (index.html + assets)
          |
          v
Backend API (Elysia :3001)
```

核心心智：前台与后台页面都由同一 SPA 提供；`/api` 与 `/uploads` 统一反代到同一后端进程。

## 4) 域名到端口映射表

| 场景 | 入口 URL | 反代层 | 上游服务 | 最终处理 |
| --- | --- | --- | --- | --- |
| 开发 | `http://blog.localhost/` | Local Reverse Proxy | `http://127.0.0.1:5173` | Vite 返回首页 |
| 开发 | `http://blog.localhost/admin/login` | Local Reverse Proxy | `http://127.0.0.1:5173` | Vite 返回后台登录页 |
| 开发 | `http://blog.localhost/admin/friends` | Local Reverse Proxy | `http://127.0.0.1:5173` | Vite 返回后台友链模块页 |
| 开发 | `http://blog.localhost/api/admin/auth/login` | Local Reverse Proxy -> Vite Proxy | `http://127.0.0.1:3001` | Backend 登录接口 |
| 开发 | `http://blog.localhost/uploads/images/*` | Local Reverse Proxy -> Vite Proxy | `http://127.0.0.1:3001` | Backend 静态上传文件 |
| 生产 | `https://<domain>/` | Nginx/1Panel | SPA dist | 前台页面 |
| 生产 | `https://<domain>/admin/login` | Nginx/1Panel | SPA dist | 后台登录页 |
| 生产 | `https://<domain>/admin/friends` | Nginx/1Panel | SPA dist | 后台友链模块页 |
| 生产 | `https://<domain>/api/admin/auth/login` | Nginx/1Panel | `http://127.0.0.1:3001` | Backend 登录接口 |
| 生产 | `https://<domain>/uploads/images/*` | Nginx/1Panel | `http://127.0.0.1:3001` | Backend 静态上传文件 |

## 5) 启动顺序（本机）

1. 启动后端：`cd backend && bun run dev`
2. 启动前端：`cd frontend && bun run dev --host 127.0.0.1 --port 5173`
3. 启动本机反代并绑定域名（默认 `blog.localhost`）
4. 验证后台入口：访问 `http://blog.localhost/admin/login`

## 6) 最小排障流程（固定顺序）

1. 先看入口路径：确认访问的是前台路径还是后台路径（`/admin/login`）。
2. 再看反代：确认 `/api` 与 `/uploads` 是否转发到 `127.0.0.1:3001`。
3. 最后看后端端口：确认 `127.0.0.1:3001` 是否存活、接口是否响应。

可直接执行的检查命令（本机示例）：

```bash
curl -I http://blog.localhost/
curl -I http://blog.localhost/admin/login
curl -sS http://blog.localhost/api/health
curl -sS http://127.0.0.1:3001/api/health
```

期望结果：

- `/`、`/admin/login`、`/admin/posts` 都应返回 `200`。
- 域名下 `/api/health` 返回后端健康响应。
- 直连 `:3001` 健康响应正常，说明后端服务本身可用。

## 7) 配置约束提醒

- `frontend/.env.example` 默认保持：
  - `VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:3001`
  - `VITE_API_BASE_URL=`（空值，同源）
- 若你改成跨域 API（填写绝对 `VITE_API_BASE_URL`），必须同步处理 CORS、Cookie/Token 策略与文档说明。

## 8) 一键链路验收脚本

- 脚本路径：`deploy/scripts/local-verify.sh`
- 默认行为：
  - 拉起后端 `:3001` 与前端 `:5173`（已存在则复用）
  - 以本地 Nginx 建立 `blog.localhost` 反代
  - 执行链路检查、功能验收、质量闸门
  - 自动清理临时反代进程
- 运行命令：

```bash
./deploy/scripts/local-verify.sh
```

## 9) 生产部署相关资产

- 前端单域名发布：`deploy/1panel-static-deploy.md`
- 单域名 Nginx 模板：`deploy/nginx/1panel-single-domain-template.conf`
- 生产 env 安全检查：`deploy/scripts/check-backend-prod-env.sh`
- 线上 smoke 检查：`deploy/scripts/online-smoke.sh`
- 备份恢复 Runbook：`deploy/backup-restore-runbook.md`
