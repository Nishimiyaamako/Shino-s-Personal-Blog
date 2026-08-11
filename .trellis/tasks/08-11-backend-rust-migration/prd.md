# 后端：Rust(Axum+Postgres) 迁移

## Goal

用 Rust（Axum + SQLx + Postgres）全量重写后端服务，保持与现有 Elysia 后端**完全 API 兼容**（前端零改动），完成 SQLite→Postgres 数据迁移（含校验与回滚方案），部署改为 systemd + nginx 标准配置（取消 1Panel 模板与 docker 相关设计），目录沿用 `/opt/shino-blog/`，并产出 API 兼容性测试基准（以现有 api.test.ts 为对照）。

## Background

- 现状（已核验）：
  - 现有后端：Elysia + Drizzle + bun:sqlite + JWT(jose) + marked/sanitize-html/highlight.js，约 3168 行 TS，PM2 + bun 部署（backend/ecosystem.config.js）。
  - 公开 API（backend/src/routes/public.ts）：GET /health、/posts、/posts/:slug、/home/featured（子任务 1 废弃）、/friend-links、/about、/profile-card、/site-config、/search。
  - 管理 API（backend/src/routes/admin.ts，31-532 行）：POST /auth/login；GET/POST /posts、GET/PATCH/DELETE /posts/:id、POST /posts/:id/publish|unpublish、POST /posts/rebuild-search-index、PATCH /posts/:id/featured（子任务 1 废弃）；POST /uploads/image；GET/DELETE /media；GET/POST/PATCH/DELETE /friend-links；GET/PATCH /about、/profile-card、/site-config。
  - 上传静态服务：GET /uploads/images/:fileName（app.ts）。
  - 数据表（backend/src/db/migrate.ts）：admin_users / posts（含 is_featured、featured_order，子任务 1 废弃）/ tags / post_tags / media_assets / friend_links / about_page / profile_card / profile_contacts / site_config；FTS5 全文索引 posts_search；索引若干。
  - 测试：backend/src/__tests__/api.test.ts（bun:test，三个 describe：admin auth / post publish and search / uploads）。
  - 环境变量（backend/.env.example）：NODE_ENV / PORT / DATABASE_PATH / UPLOADS_ROOT / ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_JWT_SECRET / ADMIN_JWT_EXPIRES_HOURS。
  - 部署资产：deploy/nginx/*.conf（三份 1Panel 模板）、deploy/scripts/*.sh（local-verify / build-frontend-dist / check-backend-prod-env / online-smoke）、docs/kb/deploy-ops.md（PM2 手册）。
  - 环境事实：本机无 Rust 工具链（需安装 rustup + cargo）；生产数据在服务器 `/opt/shino-blog/data/blog.sqlite`（本地 backend/data/ 为空）；生产云 PG + 本地原生 PG 双兼容（连接串环境变量化）。
- 父任务决策：D7（Axum + SQLx + Postgres；云 PG + 本地原生 PG）、D8（systemd + nginx；取消 1Panel/docker 设计；目录沿用 /opt/shino-blog）、D9（数据迁移归本任务，精选数据废弃）、D10（API 兼容，前端零改动）、D11（单实例 PG + 无状态 API，集群 deferred）、D12（monorepo 保持）。

## Requirements

1. **Rust 服务**：
   - 框架 Axum + Tokio；DB 访问 SQLx（postgres 特性，连接池）；JWT 用 jsonwebtoken；markdown 用 pulldown-cmark（或 markdown 生态：pulldown-cmark 解析 + 自实现 HTML 生成，或 comrak）；语法高亮 syntect；XSS 过滤 ammonia；密码哈希 argon2/bcrypt（现有 bun:sqlite 端用什么？核验 auth/admin.ts，bcryptjs 或 Bun.password，Rust 侧选等价实现，向后兼容哈希格式需核验后决策）。
   - API 路径/方法/请求响应形状与现有后端完全一致（以 api.test.ts + 前端 data/api.ts 类型为契约）。
   - 状态码、错误结构（{ error: string }）与现有一致。
2. **Postgres**：
   - schema 迁移（SQLx migrate 或 sql-migrate）：全部表重建（不含 featured 列），tags/post_tags 关联、media_assets、site_config（含 slogan，子任务 1 新增）、about_page、profile_card/contacts、admin_users、FTS（pg 用 tsvector 或 pg_trgm + GIN，与 SQLite FTS5 行为对齐——实施时核验现有 search.ts 查询语义）。
   - SQLite→PG 数据迁移脚本（一次性工具：读 SQLite → 写 PG），含精选数据丢弃、slogan 默认 ''、计数校验与抽样校验、幂等（可重跑）。
   - 回滚：迁移前 SQLite 文件备份快照（cp 到 backups/）+ PG 侧 TRUNCATE 重导；迁移脚本输出校验报告。
3. **部署**：
   - systemd 单元（shino-blog-backend.service：ExecStart 指向 /opt/shino-blog/backend/rust/target/release/shino-blog-backend 或等价布局，EnvironmentFile=/opt/shino-blog/env/backend.env，Restart=always）。
   - nginx 标准配置替换三份 1Panel 模板（前端域 + API 反代 + /uploads 静态代理 + 301 规则来自子任务 1）。
   - deploy/scripts 更新（check-backend-prod-env.sh 改验 PG 连接与环境变量；local-verify.sh 更新为 cargo build + 测试）。
   - docs/kb/deploy-ops.md 重写：Rust 构建（本地/服务器 cargo build --release）、PG 初始化、systemd 操作、迁移步骤、回滚、冒烟。
   - 删除：ecosystem.config.js / local.cjs、PM2 相关引用。
4. **API 兼容测试**：
   - Rust 侧集成测试（cargo test）：覆盖 api.test.ts 全部行为 + 全部端点（公开+管理+uploads）。
   - 兼容基准：现有 Bun 后端在迁移窗口内作为对照运行（staging），两端跑同一冒烟脚本 diff 响应。
5. **环境变量**（兼容旧 .env 键名，新增 PG）：
   - DATABASE_URL（PG 连接串）替代 DATABASE_PATH；PORT / UPLOADS_ROOT / NODE_ENV / ADMIN_* / ADMIN_JWT_* 保留键名；CORS 配置可沿用（origin 环境化可选）。

## Acceptance Criteria

- [ ] `cargo build --release` 通过；Rust 服务在本机（本地 PG）启动，全部公开+管理 API 与现有后端行为等价（对照测试 diff 通过）。
- [ ] SQLite→PG 迁移脚本在真实数据上执行成功：计数一致（逐表）、抽样内容一致、精选数据未迁移、slogan 默认 ''、可重跑幂等。
- [ ] 回滚演练：迁移后按备份快照恢复 SQLite 可继续服务（回滚路径验证）。
- [ ] 数据校验报告输出（计数+抽样清单）。
- [ ] systemd 单元 + nginx 标准配置在服务器部署冒烟通过（/health 200、登录、文章列表）。
- [ ] deploy-ops.md 重写完成（构建/迁移/部署/回滚/冒烟手册）；PM2 资产删除。
- [ ] Rust 集成测试全绿（等价 api.test.ts 覆盖）。
- [ ] 自检三命令通过；无凭据入库（含 `.env` 不入库）。

## Out of Scope

- 多机集群/主从/HA（deferred）。
- 前端改动（除子任务 1 已含的 slogan 契约）。
- CI/CD 管道搭建（本次仅本地/手动部署脚本）。
- Cloudflare Workers 前端接入（deferred）。

## Open Questions

- [ ] 密码哈希算法兼容：现有 admin_users.password_hash 格式需核验（auth/admin.ts），Rust 侧选可验证既有哈希的算法（argon2/bcrypt 兼容或迁移时重哈希，实施首步核验）。
- [ ] FTS 语义对齐：现有搜索为 SQLite FTS5（posts_search 虚拟表），PG 侧用 tsvector+GIN 或 pg_trgm，查询结果排序需对齐 search.ts 的质量分公式（featured 权重移除后）。
- [ ] 生产 PG 提供方式：云厂商/自建服务器——连接串环境化，实施时由用户提供 DATABASE_URL。

## Notes

- 依赖子任务 1 完成（featured 废弃 + slogan 契约）后，本任务才可锁 API 契约；两任务可并行开发，但兼容基准以子任务 1 合并后的后端为准。
- 实施首步：核验 backend/.env 入库问题（父任务固定项）。
