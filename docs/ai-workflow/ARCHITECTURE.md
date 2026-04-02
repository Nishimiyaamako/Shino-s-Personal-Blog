# ARCHITECTURE.md（Shino's Bolg）

> Updated on 2026-04-02.
> 目的：统一“后台独立域名 + 本机端口心智”，让开发与生产链路可一眼定位。

## 1) 当前真实结构

- 前端：单一 SPA（公开页面 + 后台页面）。
- 后台页面路由：`/admin/login`、`/admin`（仍在同一前端工程内）。
- 后端：单一 API 服务（Elysia），默认端口 `3001`。
- 后台登录接口：`POST /api/admin/auth/login`。

## 2) 本机开发拓扑（推荐）

```text
Browser
  |- http://blog.local.test
  |- http://admin.local.test
          |
          v
Local Reverse Proxy (Nginx/Caddy)
  |- admin host: / -> /admin/login
  |- other paths -> http://127.0.0.1:5173
          |
          v
Vite Dev Server (:5173)
  |- page routes: /, /posts, /admin/login, /admin
  |- /api/* and /uploads/* -> proxy target http://127.0.0.1:3001
          |
          v
Backend API (Elysia :3001)
```

核心心智：浏览器只看域名；端口细节在反代与 Vite 代理内部完成。

## 3) 生产部署拓扑（双域名）

```text
Browser
  |- https://blog.<domain>
  |- https://admin.<domain>
          |
          v
Nginx / 1Panel
  |- admin host: / -> /admin/login
  |- /api/* -> http://127.0.0.1:3001
  |- /uploads/* -> http://127.0.0.1:3001
  |- other routes -> SPA dist (index.html + assets)
          |
          v
Backend API (Elysia :3001)
```

核心心智：前台域名和后台域名都能访问同一 SPA 与同一后端服务。

## 4) 域名到端口映射表

| 场景 | 入口 URL | 反代层 | 上游服务 | 最终处理 |
| --- | --- | --- | --- | --- |
| 开发 | `http://blog.local.test/` | Local Reverse Proxy | `http://127.0.0.1:5173` | Vite 返回页面 |
| 开发 | `http://admin.local.test/` | Local Reverse Proxy | `302 -> /admin/login` | 跳到后台登录路由 |
| 开发 | `http://admin.local.test/api/admin/auth/login` | Local Reverse Proxy -> Vite Proxy | `http://127.0.0.1:3001` | Backend 登录接口 |
| 开发 | `http://blog.local.test/uploads/images/*` | Local Reverse Proxy -> Vite Proxy | `http://127.0.0.1:3001` | Backend 静态上传文件 |
| 生产 | `https://blog.<domain>/` | Nginx/1Panel | SPA dist | 前台页面 |
| 生产 | `https://admin.<domain>/` | Nginx/1Panel | `302 -> /admin/login` | 后台入口跳转 |
| 生产 | `https://admin.<domain>/api/admin/auth/login` | Nginx/1Panel | `http://127.0.0.1:3001` | Backend 登录接口 |
| 生产 | `https://blog.<domain>/uploads/images/*` | Nginx/1Panel | `http://127.0.0.1:3001` | Backend 静态上传文件 |

## 5) 启动顺序（本机）

1. 启动后端：`cd backend && bun run dev`
2. 启动前端：`cd frontend && bun run dev --host 127.0.0.1 --port 5173`
3. 启动本机反代并绑定域名（`blog.local.test`、`admin.local.test`）
4. 验证后台入口：访问 `http://admin.local.test/` 应进入 `/admin/login`

## 6) 最小排障流程（固定顺序）

1. 先看入口域名：确认你访问的是 `blog.*` 还是 `admin.*`，路径是否正确。
2. 再看反代：确认该域名的反代规则是否把请求转发到预期上游。
3. 最后看后端端口：确认 `127.0.0.1:3001` 是否存活、接口是否响应。

可直接执行的检查命令（本机示例）：

```bash
curl -I http://admin.local.test/
curl -sS http://admin.local.test/api/health
curl -sS http://blog.local.test/api/health
curl -sS http://127.0.0.1:3001/api/health
```

期望结果：

- `admin.local.test/` 返回 `302` 到 `/admin/login`（或直接落到登录页）。
- 两个域名下 `/api/health` 都返回后端健康响应。
- 直连 `:3001` 健康响应正常，说明后端服务本身可用。

## 7) 配置约束提醒

- `frontend/.env.example` 默认保持：
  - `VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:3001`
  - `VITE_API_BASE_URL=`（空值，同源）
- 若你改成跨域 API（填写绝对 `VITE_API_BASE_URL`），必须同步处理 CORS、Cookie/Token 策略与文档说明。
