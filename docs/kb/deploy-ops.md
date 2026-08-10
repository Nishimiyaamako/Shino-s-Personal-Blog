---
type: kb-ops
updated: 2026-08-10
---

# 部署与运维手册（1Panel）

> 归纳自原 deploy/*.md 手册，作为运维知识库唯一正文入口；`deploy/` 目录保留脚本/模板等可执行资产。

适用：1Panel 管理的 Linux 服务器，后端 PM2 进程常驻（非 Docker），前端静态站点 + Nginx 反代。

## ① 服务器目录规范

```
/opt/shino-blog/
  |- backend/        # 后端代码（由 PM2 运行）
  |- data/           # SQLite 数据库（读写）
  |- uploads/        # 上传资源目录（读写）
  |- env/            # 环境变量文件（仅运维可读）
  |- logs/           # PM2 日志目录
  |- backups/        # 备份归档
  |- frontend-dist/  # 前端构建产物（Nginx 静态服务）
```

```bash
sudo mkdir -p /opt/shino-blog/{backend,data,uploads,env,logs,backups}
sudo mkdir -p /opt/shino-blog/uploads/images
sudo chown -R 1000:1000 /opt/shino-blog
```

## ② 生产环境变量

1. 复制模板：`cp backend/.env.example /opt/shino-blog/env/backend.env`
2. 强制修改：`ADMIN_PASSWORD`、`ADMIN_JWT_SECRET`、`NODE_ENV=production`（值存于 `<凭据位置>`，不落文档）
3. 上线前检查（非破坏性）：`./deploy/scripts/check-backend-prod-env.sh /opt/shino-blog/env/backend.env`，期望 `ENV_CHECK=PASS`

## ③ 后端部署（PM2）

```bash
# 代码上传到 /opt/shino-blog/backend（git clone / rsync / 1Panel 文件管理器）
cd /opt/shino-blog/backend
bun install --frozen-lockfile --production

# PM2
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup

# 验证
pm2 status
curl -sS http://127.0.0.1:3001/api/health   # 期望 {"ok":true,...}
```

首发数据基线：`backend/data/blog.sqlite` → `/opt/shino-blog/data/`；`backend/uploads/images/*` → `/opt/shino-blog/uploads/images/`（先做备份快照，见 ⑥）。

## ④ 前端部署（静态站点）

1. 本地：`./deploy/scripts/local-verify.sh` → `./deploy/scripts/build-frontend-dist.sh` → `./deploy/scripts/check-backend-prod-env.sh <env文件>`
2. 服务器：`sudo mkdir -p /opt/shino-blog/frontend-dist && sudo chown -R 1000:1000 /opt/shino-blog/frontend-dist`
3. 上传 `deploy/artifacts/frontend-dist-latest.tar.gz` 解压到该目录（确认直接包含 `index.html` + `assets/`，后台路由 `/admin/login` 已含在同一个包里）
4. 1Panel 创建**静态网站**，绑定域名，根目录指向 `frontend-dist`，加反代与 SPA 回退规则：
   - 可复用 `deploy/nginx/1panel-static-spa-snippet.conf`
   - 完整单域名示例：`deploy/nginx/1panel-single-domain-template.conf`
   - 关键规则：`/api/*` → `http://127.0.0.1:3001`；`/uploads/*` → `http://127.0.0.1:3001`；其他 → `try_files ... /index.html`
5. HTTPS：上传证书（fullchain + privkey），开启强制 HTTPS

## ⑤ 线上 smoke test（必须过）

```bash
curl -I https://<domain>/
curl -I https://<domain>/admin/login
curl -sS https://<domain>/api/health
curl -I https://<domain>/posts
curl -I https://<domain>/uploads/images/<sample-file>
```

期望：首页/admin-login/posts/uploads 均 200，`/api/health` 返回 `ok: true`。

## ⑥ 备份与恢复 Runbook

**备份对象**：`/opt/shino-blog/data/blog.sqlite` + `/opt/shino-blog/uploads/`

**频率**：SQLite 每天 ≥1 次（高峰可每 6 小时）；uploads 每天 ≥1 次。

```bash
TS="$(date +%F-%H%M%S)"
mkdir -p /opt/shino-blog/backups
cp /opt/shino-blog/data/blog.sqlite "/opt/shino-blog/backups/blog.sqlite.${TS}.bak"
tar -C /opt/shino-blog -czf "/opt/shino-blog/backups/uploads.${TS}.tar.gz" uploads
```

**恢复演练**：
```bash
pm2 stop shino-blog-backend
cp /opt/shino-blog/backups/blog.sqlite.<timestamp>.bak /opt/shino-blog/data/blog.sqlite
tar -C /opt/shino-blog -xzf /opt/shino-blog/backups/uploads.<timestamp>.tar.gz
pm2 start /opt/shino-blog/backend/ecosystem.config.js
curl -sS http://127.0.0.1:3001/api/health
```

**恢复后必检**：后台可登录、最近文章可打开、抽查上传图片可访问、友链/关于/名片数据正确。

## ⑦ 发布后巡检清单（上线后 15 分钟内）

- [ ] 首页 `/`、`/admin/login`、`/posts`、`/tags` 刷新不 404
- [ ] `/api/health` 返回 `ok: true`；抽查上传图 200
- [ ] 管理员登录成功；草稿保存、发布后前台可见、下线后不可见、精选排序生效
- [ ] 友链增删改、关于页更新、名片卡修改前台即时可见
- [ ] PM2 进程正常（非重启循环）；日志无持续 500/DB 锁/权限错误；SSL 正常（HTTP 自动跳 HTTPS）

## ⑧ 日常运维命令

```bash
pm2 status / pm2 logs shino-blog-backend
pm2 restart shino-blog-backend      # 重启
pm2 reload shino-blog-backend       # 零停机重载（代码更新推荐）
pm2 stop / pm2 delete shino-blog-backend
```

## ⑨ 回滚方案

1. **代码回滚**：回退 git commit，`pm2 reload shino-blog-backend`
2. **前端回滚**：解压上一个 `frontend-dist-*.tar.gz` 覆盖站点目录
3. **数据回滚**：`pm2 stop` → 用 `/opt/shino-blog/backups/*.bak` 恢复 `blog.sqlite` → `pm2 start`

## 相关资产

- 部署脚本：`deploy/scripts/`（local-verify / build-frontend-dist / check-backend-prod-env / online-smoke）
- Nginx 模板：`deploy/nginx/`（单域名 / 双域名(已弃用) / SPA 片段）
- PM2 配置：`backend/ecosystem.config.js`（生产）、`backend/ecosystem.config.local.cjs`（本地）
