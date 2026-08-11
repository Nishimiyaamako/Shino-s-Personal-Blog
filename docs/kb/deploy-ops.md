---
type: kb-ops
updated: 2026-08-11
---

# 部署与运维手册（Rust 后端版）

> 后端已从 Elysia(Bun)+SQLite 迁移为 Rust(Axum)+Postgres，进程管理由 PM2 改为 systemd。
> 本手册为部署运维唯一正文入口；`deploy/` 保留脚本/模板等可执行资产（systemd 单元、nginx 模板、构建/校验脚本）。

适用：标准 Linux 服务器（Ubuntu/Debian 系），前端静态站点 + Rust API + Postgres，nginx 反代 + systemd 常驻。

## ① 架构总览

| 层 | 组件 | 位置 |
| --- | --- | --- |
| 前端 | Vite 构建静态 SPA | `/opt/shino-blog/frontend-dist`（nginx 静态服务） |
| API | Rust 二进制 `shino-blog-backend`（Axum） | `/opt/shino-blog/backend/rust/target/release/`（systemd 常驻） |
| 数据库 | Postgres（云 PG 或本机 PG） | 连接串由 `DATABASE_URL` 指定 |
| 上传 | 文件系统目录 | `/opt/shino-blog/uploads/images`（API 静态服务 `/uploads/images/*`） |
| 进程 | systemd 单元 `shino-blog-backend` | `/etc/systemd/system/shino-blog-backend.service` |
| 反代 | nginx（HTTP→HTTPS、`/api/` `/uploads/` → 127.0.0.1:3001、SPA 回退、301 规则） | `/etc/nginx/conf.d/shino-blog.conf` |

```
浏览器 ──HTTPS── nginx（静态 SPA + 反代）
                ├── /api/*     → 127.0.0.1:3001（Rust API）
                ├── /uploads/* → 127.0.0.1:3001（上传静态文件）
                └── /          → frontend-dist（try_files → index.html）
Rust API ──DATABASE_URL── Postgres（云或本机）
```

## ② 环境准备与构建

**服务器安装 Rust 工具链（非交互）**：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
cargo --version   # 确认安装成功
```

**构建（服务器原生构建推荐，避免交叉编译）**：

```bash
cd /opt/shino-blog/backend/rust
cargo build --release
# 产物：target/release/shino-blog-backend
```

本机构建：同一命令即可（`cd backend/rust && cargo build --release`），上传产物时需保证 glibc 兼容（同发行版或容器内构建）。

**本地质量门（提交前）**：

```bash
./deploy/scripts/local-verify.sh   # cargo fmt/clippy/test + 前端 build + 自检 grep
```

## ③ 数据库初始化（Postgres）

**本机 PG（apt 安装后）**：

```bash
sudo apt-get install -y postgresql
sudo systemctl enable --now postgresql

sudo -u postgres psql <<'SQL'
CREATE USER shino_blog WITH PASSWORD '<凭据位置>';
CREATE DATABASE shino_blog OWNER shino_blog;
SQL
```

**云 PG**：由厂商控制台创建库与用户，提供连接串（见 ④）。

**验证连通**：

```bash
psql 'postgres://shino_blog:<凭据位置>@127.0.0.1:5432/shino_blog' -c 'SELECT 1'
```

> 连接串示例：`postgres://user:pass@host:5432/shino_blog`（密码含特殊字符时 URL 编码）。

**建表**：后端首次启动自动执行 SQLx 迁移（`backend/rust/sql/migrations/`），无需手动建表；也可 `cargo run --bin migrate` 预先执行（若提供该子命令）。

## ④ 环境变量（/opt/shino-blog/env/backend.env）

```bash
sudo mkdir -p /opt/shino-blog/env
sudo cp backend/.env.example /opt/shino-blog/env/backend.env
sudo chmod 600 /opt/shino-blog/env/backend.env
```

| 键 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres 连接串（替代旧 `DATABASE_PATH`） |
| `UPLOADS_ROOT` | ✅ | 上传根目录，生产 `/opt/shino-blog/uploads` |
| `PORT` | 默认 3001 | 监听端口（nginx 反代目标） |
| `NODE_ENV` | 建议 | `production` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | ✅ | 管理员账号；密码值存于 `<凭据位置>`，不落文档 |
| `ADMIN_JWT_SECRET` | ✅ | JWT 签名密钥，值存于 `<凭据位置>`，不落文档 |
| `ADMIN_JWT_EXPIRES_HOURS` | 默认 24 | token 有效期（小时） |

上线前检查（非破坏性）：

```bash
./deploy/scripts/check-backend-prod-env.sh /opt/shino-blog/env/backend.env
# 期望 ENV_CHECK=PASS
```

## ⑤ 数据迁移（SQLite → Postgres）

> 一次性迁移工具 `cargo run --bin migrate-data`（backend/rust/src/bin/migrate_data.rs）。
> 迁移前自动做 SQLite 快照备份；幂等可重跑（PG 目标表先 TRUNCATE 再重导）。

```bash
# 1. 确认旧数据文件与备份目录
ls -l /opt/shino-blog/data/blog.sqlite
mkdir -p /opt/shino-blog/backups

# 2. 手动快照（脚本也会自动备份，双保险）
TS="$(date +%F-%H%M%S)"
cp /opt/shino-blog/data/blog.sqlite "/opt/shino-blog/backups/blog.sqlite.${TS}.bak"

# 3. 执行迁移（读 SQLite 写 PG；需 DATABASE_URL 与 SQLite 路径可用）
cd /opt/shino-blog/backend/rust
DATABASE_URL='postgres://...' \
SQLITE_PATH='/opt/shino-blog/data/blog.sqlite' \
cargo run --release --bin migrate-data
```

**校验报告解读**：脚本输出逐表 count 对比（SQLite vs PG，期望一致）+ 抽样字段比对清单（每表 N 行）+ slogan 默认 `''` 确认 + 精选数据丢弃确认（旧 is_featured 数据不迁移）。**计数不一致或抽样内容不符时停止上线，走回滚路径（⑨）。**

## ⑥ 部署（systemd + nginx）

**目录布局**：

```
/opt/shino-blog/
  |- backend/rust/        # Rust 源码（git 克隆/rsync）
  |- data/                # 旧 SQLite 数据（迁移后只读归档）
  |- uploads/images/      # 上传资源
  |- env/backend.env      # 环境变量（仅运维可读，chmod 600）
  |- logs/                # （可选）归档日志
  |- backups/             # 备份快照
  |- frontend-dist/       # 前端构建产物（nginx root）
```

**systemd 单元安装**：

```bash
sudo cp deploy/systemd/shino-blog-backend.service /etc/systemd/system/
# 按服务器现状调整 User=/Group=（默认 shino-blog；创建系统用户见单元文件注释）
sudo systemctl daemon-reload
sudo systemctl enable --now shino-blog-backend
```

**nginx 配置安装**：

```bash
# 单域名（前端+API 同一域名）：
sudo cp deploy/nginx/single-domain.conf /etc/nginx/conf.d/shino-blog.conf
# 或双域名（前端域 + API 域，见模板内注释）：
# sudo cp deploy/nginx/dual-domain.conf /etc/nginx/conf.d/shino-blog.conf

# 替换模板内占位域名与证书路径后：
sudo nginx -t && sudo systemctl reload nginx
```

**前端构建部署**：

```bash
./deploy/scripts/build-frontend-dist.sh        # 产出 deploy/artifacts/frontend-dist-latest.tar.gz
sudo mkdir -p /opt/shino-blog/frontend-dist && sudo chown -R shino-blog:shino-blog /opt/shino-blog/frontend-dist
sudo tar -C /opt/shino-blog/frontend-dist -xzf deploy/artifacts/frontend-dist-latest.tar.gz
# 确认 index.html 位于根目录
```

## ⑦ 日常操作

```bash
sudo systemctl status shino-blog-backend       # 状态
sudo systemctl restart shino-blog-backend      # 重启
sudo systemctl stop shino-blog-backend         # 停止
journalctl -u shino-blog-backend -f            # 实时日志
journalctl -u shino-blog-backend -n 100        # 最近 100 行
sudo systemctl reload nginx                    # nginx 配置热加载
```

## ⑧ 冒烟测试

```bash
./deploy/scripts/online-smoke.sh blog.example.com
```

期望输出（每一段首行状态行）：
- `/` 与 `/admin/login` → 200（前端 SPA）
- `/api/health` → `{"ok":true,...}`
- `/blog` → 200；旧路径 `/posts` → 301（Location 指向 `/blog` 前缀）
- `/uploads/images/<sample-file>` → 200

## ⑨ 回滚

**代码回滚**：

```bash
cd /opt/shino-blog/backend/rust
git revert <bad-commit>          # 或 checkout 上一稳定版本
cargo build --release
sudo systemctl restart shino-blog-backend
```

**前端回滚**：解压上一版 `deploy/artifacts/frontend-dist-*.tar.gz` 覆盖 `/opt/shino-blog/frontend-dist`。

**数据回滚（PG → SQLite 继续旧后端）**：

```bash
# 1. 停新后端
sudo systemctl stop shino-blog-backend

# 2. 用迁移前快照还原 SQLite
cp /opt/shino-blog/backups/blog.sqlite.<timestamp>.bak /opt/shino-blog/data/blog.sqlite

# 3. 旧后端（Bun 版）临时恢复：旧二进制/代码 + 旧进程管理（迁移窗口内保留旧 backend/src 与快照）
cd /opt/shino-blog/backend && bun install --frozen-lockfile --production && bun src/index.ts &
# 或按当时保留的旧部署资产重启

# 4. 验证
curl -sS http://127.0.0.1:3001/api/health
```

> PG 侧数据保留（不 TRUNCATE），修复后可用 `migrate-data` 重导；回滚后 PG 数据不自动同步回 SQLite。

## ⑩ 备查：常见故障

| 症状 | 排查 |
| --- | --- |
| `/api/health` 502/拒绝连接 | `systemctl status shino-blog-backend`；`journalctl -u shino-blog-backend -n 50`；确认 `PORT=3001` 与 nginx `proxy_pass http://127.0.0.1:3001` 一致 |
| 启动即退出（Restart 循环） | `journalctl -u shino-blog-backend` 看报错：多为 `DATABASE_URL` 不可达（PG 未启动/连接串错）或 env 文件权限 |
| PG 连接拒绝 | 本机：`systemctl status postgresql`；云：检查防火墙/白名单/连接串账号密码（值在 `<凭据位置>`，不落文档） |
| `psql` 认证失败 | `pg_hba.conf` 认证方式（scram-sha-256）与连接串账号密码核对 |
| 上传 404 | `UPLOADS_ROOT` 目录不存在或权限不足（`ls -ld /opt/shino-blog/uploads/images`）；nginx 是否反代 `/uploads/` |
| 前端刷新 404 | nginx `try_files $uri $uri/ /index.html` 缺失（SPA 回退） |
| 301 规则不生效 | 旧路径规则在 `location /` 之前；`nginx -t` 通过后 `reload` |

## 相关资产

- systemd 单元：`deploy/systemd/shino-blog-backend.service`
- nginx 模板：`deploy/nginx/single-domain.conf`（单域名）、`deploy/nginx/dual-domain.conf`（双域名）
- 部署脚本：`deploy/scripts/`（local-verify / build-frontend-dist / check-backend-prod-env / online-smoke）
- 迁移工具：`backend/rust/src/bin/migrate_data.rs`（`cargo run --bin migrate-data`）
