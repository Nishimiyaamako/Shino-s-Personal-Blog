# 后端：Rust(Axum+Postgres) 迁移 — Implement

## 前置（每个子块内尽早完成）

- [ ] 核验 backend/.env 入库问题（父任务固定首步，凭据红线；git 历史检查 + 清理）。
- [ ] 安装 Rust 工具链（本机，非交互：`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y`）。
- [ ] 本地 PG 就绪（原生 postgres 或 docker 临时实例，连接串 DATABASE_URL）。
- [ ] 核验 Bun.password 默认哈希算法（用一条真实 password_hash 验证 argon2 vs bcrypt）。

## M1：骨架 + Schema + 公开 API

1. `backend/rust/` crate 初始化（cargo init，edition 2021+，deps：axum tokio sqlx jsonwebtoken argon2/bcrypt pulldown-cmark syntect ammonia serde）。
2. config.rs：读旧键名（PORT/UPLOADS_ROOT/NODE_ENV/ADMIN_*）+ DATABASE_URL。
3. sql/migrations/0001_init.sql：全部表（无 featured 列，site_config 含 slogan）+ 索引 + tsvector 全文列（design §3）。
4. db.rs：pool + migrate。
5. services/public 端点：health/posts/posts/:slug/friend-links/about/profile-card/site-config/search。
6. 对照：与 Bun 后端同请求 diff（本地两库）。
7. `cargo test`（公开端点）绿。**提交 M1。**

## M2：管理 API + 鉴权 + 上传/媒体

8. auth.rs：login（argon2 verify）/ JWT HS256 / 中间件。
9. admin 端点全量（posts CRUD + publish/unpublish + rebuild-search-index + media + friend-links CRUD + about/profile-card/site-config PATCH）。
10. uploads.rs：multipart 上传 + GET /uploads/images/:fileName（SAFE 正则）。
11. tests/api_compat.rs：等价 api.test.ts（auth/post publish and search/uploads）+ 全端点冒烟。
12. `cargo test` 全绿；与 Bun 后端 diff 无行为差异。**提交 M2。**

## M3：数据迁移 + 校验 + 回滚

13. src/bin/migrate_data.rs：读 SQLite（rusqlite 只读）→ 写 PG；逐表迁移；丢弃 featured；slogan 默认；幂等（TRUNCATE 或事务）。
14. 校验报告：逐表 count + 抽样字段比对 + FTS 重建；stdout 报告。
15. 回滚演练：用一份 SQLite 副本跑迁移 → 校验 → 还原副本模拟回滚。
16. 真实数据（从服务器拉取生产 SQLite 副本或 ssh 上执行）跑一遍迁移 + 报告。**提交 M3。**

## M4：部署资产 + 文档 + 上线

17. deploy/systemd/shino-blog-backend.service（EnvironmentFile + ExecStart + Restart）。
18. deploy/nginx/：single-domain.conf / dual-domain.conf（替换 1Panel 模板；含子任务 1 的 301 规则）。
19. deploy/scripts/：check-backend-prod-env.sh（DATABASE_URL 连通检查）、local-verify.sh（cargo check/test）、online-smoke.sh（/health+login）。
20. 删除 backend/ecosystem.config.js、ecosystem.config.local.cjs。
21. docs/kb/deploy-ops.md 重写（构建/迁移/部署/回滚/冒烟；PM2 章节移除）。
22. 服务器部署：装 rustup → cargo build --release → 迁移 → systemd 起服 → nginx 切换 → online-smoke。
23. 自检三命令 + 提交。

## 验证命令

```bash
cd backend/rust
cargo fmt && cargo clippy && cargo test
cargo build --release
cd ../.. && ./deploy/scripts/local-verify.sh
grep -rn '⚠ 待核验' . --include='*.md'
grep -rnE '(password|passwd|api[_-]?key|token|secret|private[_-]?key)[[:space:]]*[:=]' . --include='*.md'
git config core.hooksPath
```

## 关键文件

| 文件 | 动作 |
| --- | --- |
| backend/rust/（新） | Rust crate（结构见 design §5） |
| backend/rust/sql/migrations/ | PG schema |
| backend/rust/src/bin/migrate_data.rs | 数据迁移工具 |
| backend/rust/tests/api_compat.rs | 兼容测试 |
| backend/ecosystem.config.js / local.cjs | 删除 |
| deploy/systemd/shino-blog-backend.service | 新增 |
| deploy/nginx/*.conf | 重写为标准配置 |
| deploy/scripts/*.sh | 更新 |
| docs/kb/deploy-ops.md | 重写 |
| backend/.env.example | DATABASE_URL + 键名更新 |
| backend/.gitignore | 确认 rust/target 忽略 |

## 风险清单（实施时逐项核验）

- [ ] 密码哈希算法兼容（M 前置，argon2 vs bcrypt）
- [ ] FTS 搜索排序近似对齐（M1 对照 diff）
- [ ] 时间戳原样迁移（M3 校验报告含抽样时间）
- [ ] 上传 URL 与文件路径不变（M3 校验 media.url）
- [ ] 服务器生产 PG 连接串由用户提供（M4 前置）

## 提交前自检

- [ ] cargo fmt/clippy/test 全绿
- [ ] 对照 diff 无行为差异
- [ ] 迁移报告通过（计数/抽样）
- [ ] 回滚演练通过
- [ ] 部署冒烟通过
- [ ] 自检三命令通过
