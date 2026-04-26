# 1Panel 后端部署指南（PM2 进程常驻）

> 目标：让 `backend` 在服务器以 PM2 进程方式稳定常驻，并与单域名静态前端站点通过 `/api`、`/uploads` 正常联通。  
> 适用：你已使用 1Panel 管理网站，前端为静态站点，后端为 Elysia + SQLite。
> 注意：本指南已移除 Docker 容器方案，后端采用 PM2 进程管理。

## 1) 服务器目录规范（建议固定）

```text
/opt/shino-blog/
  |- backend/        # 后端代码（由 PM2 运行）
  |- data/           # SQLite 数据库（读写）
  |- uploads/        # 上传资源目录（读写）
  |- env/            # 环境变量文件（仅运维可读）
  |- logs/           # PM2 日志目录
  |- backups/        # 备份归档
```

快速创建：

```bash
sudo mkdir -p /opt/shino-blog/{backend,data,uploads,env,logs,backups}
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

## 4) 部署后端代码

在服务器上准备后端运行目录：

```bash
cd /opt/shino-blog/backend
```

将本地 `backend/` 目录的代码上传到服务器该目录（可通过 git clone、rsync、或 1Panel 文件管理器上传）。

确保目录结构包含：
- `package.json`
- `bun.lock`
- `tsconfig.json`
- `src/` 目录
- `ecosystem.config.js`（PM2 配置文件）

安装依赖：

```bash
cd /opt/shino-blog/backend
bun install --frozen-lockfile --production
```

## 5) 安装 PM2 并启动后端

```bash
# 安装 PM2（如未安装）
npm install -g pm2

# 首次启动
cd /opt/shino-blog/backend
pm2 start ecosystem.config.js

# 保存 PM2 进程列表，确保开机自启
pm2 save
pm2 startup
```

验证运行状态：

```bash
pm2 status
pm2 logs shino-blog-backend --lines 50
```

## 6) 运行后验证

服务器本机检查：

```bash
curl -sS http://127.0.0.1:3001/api/health
```

应返回 `{"ok":true,...}`。

## 7) 与前端站点联动（单域名）

在 1Panel 网站配置中，`<domain>` 需配置：

- `/api/*` -> `http://127.0.0.1:3001`
- `/uploads/*` -> `http://127.0.0.1:3001`

详见：
- `deploy/1panel-static-deploy.md`
- `deploy/nginx/1panel-static-spa-snippet.conf`

## 8) 日常运维命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs shino-blog-backend

# 重启
pm2 restart shino-blog-backend

# 零停机重载（推荐用于代码更新）
pm2 reload shino-blog-backend

# 停止
pm2 stop shino-blog-backend

# 删除进程
pm2 delete shino-blog-backend
```

## 9) 回滚方案（最小可行）

1. **代码回滚**：回退到上一个稳定 git commit，执行 `pm2 reload shino-blog-backend`。
2. **前端回滚**：解压上一个 `frontend-dist-*.tar.gz` 覆盖站点目录。
3. **数据回滚**：
   - `pm2 stop shino-blog-backend`
   - 用 `/opt/shino-blog/backups/*.bak` 恢复 `blog.sqlite`
   - `pm2 start ecosystem.config.js`
