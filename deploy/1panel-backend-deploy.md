# 1Panel 后端部署指南（容器常驻）

> 目标：让 `backend` 在服务器以容器方式稳定常驻，并与单域名静态前端站点通过 `/api`、`/uploads` 正常联通。  
> 适用：你已使用 1Panel 管理网站，前端为静态站点，后端为 Elysia + SQLite。

## 1) 服务器目录规范（建议固定）

```text
/opt/shino-blog/
  |- data/           # SQLite 数据库（读写）
  |- uploads/        # 上传资源目录（读写）
  |- env/            # 环境变量文件（仅运维可读）
  |- backups/        # 备份归档
```

快速创建：

```bash
sudo mkdir -p /opt/shino-blog/{data,uploads,env,backups}
sudo mkdir -p /opt/shino-blog/uploads/images
sudo chown -R 1000:1000 /opt/shino-blog
```

## 2) 准备生产环境变量

1. 复制模板：

```bash
cp backend/.env.example /opt/shino-blog/env/backend.env
```

2. 强制修改至少以下值：
- `ADMIN_PASSWORD`
- `ADMIN_JWT_SECRET`
- `NODE_ENV=production`

3. 上线前检查（非破坏性）：

```bash
./deploy/scripts/check-backend-prod-env.sh /opt/shino-blog/env/backend.env
```

期望：输出 `ENV_CHECK=PASS`。

## 3) 首发数据基线（复制本地现库）

将本地数据复制到服务器对应目录：

- `backend/data/blog.sqlite` -> `/opt/shino-blog/data/blog.sqlite`
- `backend/uploads/images/*` -> `/opt/shino-blog/uploads/images/`

建议先做一次备份快照：

```bash
cp /opt/shino-blog/data/blog.sqlite /opt/shino-blog/backups/blog.sqlite.$(date +%F-%H%M%S).bak
```

## 4) 构建后端镜像

在仓库根目录执行：

```bash
docker pull oven/bun:1.3.11-alpine
docker build -t shino-blog-backend:latest ./backend
```

若 `docker pull` 超时（例如 `i/o timeout`），先处理服务器到 Docker Hub 的出网或镜像代理，再继续构建。

## 5) 在 1Panel 创建后端容器

1. 进入 **容器** -> **创建容器**。
2. 镜像：`shino-blog-backend:latest`。
3. 端口映射：`127.0.0.1:3001:3001`（仅本机可访问，由 Nginx 反代暴露）。
4. 挂载：
- `/opt/shino-blog/data` -> `/app/data`（读写）
- `/opt/shino-blog/uploads` -> `/app/uploads`（读写）
- `/opt/shino-blog/env/backend.env` -> `/app/.env`（只读）
5. 环境变量加载方式（二选一）：
- 直接在 1Panel 填写与 `backend.env` 同值；
- 或启用 env-file（按 1Panel 版本支持情况）。
6. 重启策略：`always`。
7. 启动命令：默认 `bun src/index.ts`（沿用 Dockerfile CMD）。

## 6) 运行后验证

服务器本机检查：

```bash
curl -sS http://127.0.0.1:3001/api/health
```

应返回 `{"ok":true,...}`。

查看容器日志：

```bash
docker logs --tail=200 shino-blog-backend
```

## 7) 与前端站点联动（单域名）

在 1Panel 网站配置中，`<domain>` 需配置：

- `/api/*` -> `http://127.0.0.1:3001`
- `/uploads/*` -> `http://127.0.0.1:3001`

详见：
- `deploy/1panel-static-deploy.md`
- `deploy/nginx/1panel-static-spa-snippet.conf`

## 8) 回滚方案（最小可行）

1. **镜像回滚**：改回上一个稳定 tag 并重启容器。
2. **前端回滚**：解压上一个 `frontend-dist-*.tar.gz` 覆盖站点目录。
3. **数据回滚**：
- 停后端容器
- 用 `/opt/shino-blog/backups/*.bak` 恢复 `blog.sqlite`
- 再启动容器
