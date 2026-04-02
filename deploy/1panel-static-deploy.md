# 1Panel 单域名上线（静态前端卷挂载 + 后端容器）

> 目标：稳定上线 `https://<domain>`（前台 + 后台路径），并确保 `/api`、`/uploads` 正常可用。

## 1) 上线前准备（本地）

1. 本机链路验收：

```bash
./deploy/scripts/local-verify.sh
```

2. 构建前端静态包：

```bash
./deploy/scripts/build-frontend-dist.sh
```

3. 后端生产 env 检查（替换为你的服务器 env 文件）：

```bash
./deploy/scripts/check-backend-prod-env.sh /opt/shino-blog/env/backend.env
```

## 2) 后端先上线（1Panel 容器）

后端部署请按：

- `deploy/1panel-backend-deploy.md`

确保：

- `curl -sS http://127.0.0.1:3001/api/health` 返回 `{"ok":true,...}`。

## 3) 前端静态卷准备（主机目录）

1. 创建前端静态目录：

```bash
sudo mkdir -p /opt/shino-blog/frontend-dist
sudo chown -R 1000:1000 /opt/shino-blog/frontend-dist
```

2. 上传 `deploy/artifacts/frontend-dist-latest.tar.gz` 到服务器并解压到该目录。

3. 解压后确认目录直接包含：

- `index.html`
- `assets/`

说明：当前前端静态包已经包含后台页面路由（`/admin/login`、`/admin`），不是另一套独立后台构建。

## 4) 1Panel 静态网站（单站点）

1. 进入 1Panel **网站** -> **创建网站** -> 选择 **静态网站**。
2. 绑定域名：`<domain>`。
3. 网站根目录指向前一步主机目录（`/opt/shino-blog/frontend-dist`，由 1Panel/Nginx 挂载提供）。
4. 在网站配置加入反代与 SPA 回退规则：

- 可复用 `deploy/nginx/1panel-static-spa-snippet.conf`
- 若你需要完整单域名示例，可参考 `deploy/nginx/1panel-single-domain-template.conf`

5. 核对关键规则：

- `/api/*` -> `http://127.0.0.1:3001`
- `/uploads/*` -> `http://127.0.0.1:3001`
- 其他路径 -> `try_files ... /index.html`

## 5) HTTPS 与证书

在该站点：

- 上传证书（`fullchain.pem` + `privkey.pem`）
- 开启强制 HTTPS（HTTP -> HTTPS）

## 6) 线上 smoke test（必须过）

将 `<domain>` 替换为真实域名：

```bash
curl -I https://<domain>/
curl -I https://<domain>/admin/login
curl -sS https://<domain>/api/health
curl -I https://<domain>/posts
curl -I https://<domain>/uploads/images/steam-bugs-linux.webp
```

期望：

- `https://<domain>/` 返回 `200`
- `https://<domain>/admin/login` 返回 `200`
- `/api/health` 返回 `ok: true`
- `/posts` 与 `/uploads/images/...` 返回 `200`

## 7) 回滚流程（前端 + 后端 + 数据）

1. 前端回滚：解压上一个 `frontend-dist-*.tar.gz` 覆盖 `/opt/shino-blog/frontend-dist`。
2. 后端回滚：容器切回上一个稳定镜像 tag 并重启。
3. 数据回滚：

- 停后端容器
- 恢复 `/opt/shino-blog/data/blog.sqlite` 备份
- 启动容器并重新 smoke test
