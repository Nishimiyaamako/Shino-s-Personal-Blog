# 后端：Rust(Axum+Postgres) 迁移 — Design

## 1. 技术栈与契约

| 层 | 选型 | 备注 |
| --- | --- | --- |
| HTTP | Axum + Tokio | 生态成熟 |
| DB | SQLx（postgres 特性）+ 连接池 | 编译期校验 SQL（可选），SQLite→PG 双库迁移期无需同查 |
| 迁移 | SQLx migrate（sql/migrations/） | 与现有 drizzle/手写 SQL 等价 |
| JWT | jsonwebtoken（HS256） | 与 jose 对齐：HS256、sub=user.id、claim username、exp 小时 |
| 密码 | argon2（verify 兼容）或 bcrypt crate | ⚠ 需核验 Bun.password 默认算法（Bun 默认 argon2id；若现有哈希为 argon2id，Rust 用 argon2 crate；若 bcrypt 则用 bcrypt crate）——实施首步确认，必要时迁移时重哈希 |
| Markdown | pulldown-cmark + 自渲染 HTML（对齐现有 marked 输出形态） | 现有内容 HTML 已存库（content_html），服务端渲染仅在无 HTML 时回退；行为对齐以 api.test.ts 断言为准 |
| 高亮 | syntect | 对齐 highlight.js 的输出形态（Rust 侧生成 `<pre><code class="language-x">`） |
| XSS | ammonia | 对齐 sanitize-html 白名单行为（实施时对照现有 posts.ts markdown 服务） |
| 上传 | axum multipart + tokio fs | 路径 /uploads/images/，SAFE 文件名正则沿用 |

## 2. API 契约（全部端点清单，以子任务 1 合并后的后端为基准）

### 公开（prefix /api）
| 方法/路径 | 请求 | 响应 |
| --- | --- | --- |
| GET /health | — | { ok, timestamp } |
| GET /posts | page/pageSize/tag | 现有 listPublishedPosts 形状 |
| GET /posts/:slug | — | PostDetail 或 404 {error} |
| GET /friend-links | — | { items } |
| GET /about | — | AboutStructured |
| GET /profile-card | — | ProfileCard |
| GET /site-config | — | ApiSiteConfig（含 slogan） |
| GET /search | q/limit | { items }（SearchItem 形状，质量分公式去 featured 权重后对齐前端 utils/search.ts 的 fallback 质量分？——以现有 search.ts 后端公式为准，仅删 isFeatured 项） |

> `/home/featured` 随子任务 1 删除，不在新契约内。

### 管理（prefix /api，Bearer JWT）
| 方法/路径 | 说明 |
| --- | --- |
| POST /auth/login | { username, password } → { token, ... }（对齐 api.test.ts 断言） |
| GET /posts | q/status/tag/page/pageSize → 分页列表 |
| GET /posts/:id | 单篇 |
| POST /posts | 新建（slug 生成/校验） |
| PATCH /posts/:id | 更新 |
| DELETE /posts/:id | 删除（级联 tags/media 引用核验） |
| POST /posts/:id/publish / unpublish | 状态切换 |
| POST /posts/rebuild-search-index | FTS 重建 |
| POST /uploads/image | multipart file → { url, ... } |
| GET /media | page/pageSize/sort/order/filter → 分页 |
| DELETE /media/:id | 删除 |
| GET/POST /friend-links、PATCH/DELETE /friend-links/:id | CRUD |
| GET/PATCH /about、/profile-card、/site-config | CRUD（site-config 含 slogan） |

- 错误结构统一 `{ "error": string }`；状态码 400/401/404 对齐。

## 3. Postgres Schema

- 表：admin_users / posts（无 is_featured/featured_order）/ tags / post_tags / media_assets / friend_links / about_page / profile_card / profile_contacts / site_config（含 slogan text not null default ''）。
- 类型映射：SQLite INTEGER PK → serial/bigserial；TEXT → text；时间戳 TEXT(ISO8601) → text（**保持现有字符串时间格式**，避免时区语义变化，前端已按 ISO 解析）。
- 索引：posts(status)、posts(slug unique)、tags(name unique)、post_tags(post_id/tag_id)、friend_links(enabled, display_order)。
- 全文搜索：PG 方案选型：
  - a) tsvector 表达式列 + GIN（posts(title||summary||content)），按 ts_rank 排序——需对齐现有 bm25 公式（50% 文本相关 + 25% 时间衰减 + 15% 质量分 + 10% 常青度，featured 权重删除后调整）。
  - b) pg_trgm + GIN（LIKE/相似度）——中文分词效果差。
  - **推荐 a**：`to_tsvector('simple', ...)`（中文无需分词器，simple 配置按字符切分，近似 FTS5 行为）；实施时对比 api.test.ts 搜索用例结果排序。
- 迁移文件：`sql/migrations/0001_init.sql`（全表）+ 后续（如密码算法调整）。

## 4. SQLite→PG 数据迁移脚本

- 形态：`src/bin/migrate_data.rs`（cargo run --bin migrate-data），读 SQLite（rusqlite，只读）+ 写 PG（SQLx）。
- 步骤：
  1. 备份快照：`cp /opt/shino-blog/data/blog.sqlite /opt/shino-blog/backups/blog.sqlite.<ts>`（脚本前置校验存在性）。
  2. 逐表迁移：admin_users（密码哈希**原样复制**，Rust verify 算法匹配后无需重哈希；若不匹配则在脚本中重哈希并提示改密）→ posts（丢弃 is_featured/featured_order）→ tags/post_tags → media_assets → friend_links → about_page → profile_card/contacts → site_config（补 slogan 默认 ''）。
  3. 幂等：PG 目标表先 TRUNCATE（或使用 ON CONFLICT / 事务回滚），脚本可重跑。
  4. 校验报告：逐表 count 对比 + 抽样（每表 N 行字段级比对）+ FTS 重建 + 报告写 stdout/文件。
- 回滚：备份快照还原 SQLite 继续服务旧后端；PG 侧数据保留或 TRUNCATE（手册写清）。

## 5. 项目结构（backend/rust/ 或 backend/src-rust/？——决策）

- **推荐 `backend/rust/` 独立 crate 目录**（与现有 backend/src 并存，迁移窗口内双后端可同时构建），迁移完成后删除 backend/src。
- 结构：
```
backend/rust/
  Cargo.toml
  sql/migrations/0001_init.sql
  src/
    main.rs          # 启动：env → pool → router → serve
    config.rs        # ENV（键名兼容旧 .env.example + DATABASE_URL）
    db.rs            # pool 初始化 + migrate
    auth.rs          # login / jwt verify / middleware
    models.rs        # API 响应类型
    routes/
      public.rs
      admin.rs
      uploads.rs
    services/
      posts.rs friends.rs about.rs profile.rs site_config.rs media.rs search.rs markdown.rs
  src/bin/migrate_data.rs
  tests/
    api_compat.rs    # 等价 api.test.ts + 全端点冒烟
```

## 6. 部署设计

- systemd：`deploy/systemd/shino-blog-backend.service`（EnvironmentFile=/opt/shino-blog/env/backend.env；ExecStart=/opt/shino-blog/backend/rust/target/release/shino-blog-backend；Restart=always；User=shino-blog 或按服务器现状）。
- 构建：服务器装 rustup（curl rustup.rs 脚本，非交互安装）→ `cargo build --release`（或本地交叉构建上传，推荐服务器原生构建）；部署脚本 `deploy/scripts/deploy-backend.sh` 更新。
- nginx：`deploy/nginx/single-domain.conf` + `dual-domain.conf`（替换 1Panel 模板）——前端静态 + /api/ + /uploads/ 反代 + 子任务 1 的 301 规则。
- deploy/scripts：
  - check-backend-prod-env.sh → 改验 DATABASE_URL 连通（sqlx 或 psql）、UPLOADS_ROOT 存在。
  - local-verify.sh → cargo fmt/check/test + 前端 build。
  - online-smoke.sh → 保留（/health + 登录冒烟）。
- 删除：backend/ecosystem.config.js、ecosystem.config.local.cjs。
- docs/kb/deploy-ops.md 重写（章节：环境准备/构建/迁移/部署/回滚/冒烟）。

## 7. 环境变量（.env.example 更新）

```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgres://user:pass@host:5432/shino_blog   # 生产云 PG / 本地原生 PG 通用
UPLOADS_ROOT=/opt/shino-blog/uploads
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<凭据位置>
ADMIN_JWT_SECRET=<凭据位置>
ADMIN_JWT_EXPIRES_HOURS=24
```

## 8. 验证与对照基准

- `cargo test`（单元 + api_compat 集成测试，测试库独立 schema）。
- 兼容对照：本地同时起 Bun 后端（旧库 SQLite）与 Rust 后端（PG），对同一请求集 diff 响应（`deploy/scripts/compare-backends.sh` 或脚本化 curl 集合）。
- 冒烟：服务器部署后 online-smoke.sh。

## 9. 风险与回滚

- **密码哈希不兼容**：Bun.password 默认 argon2id → Rust argon2 crate 可验；若现存哈希为其他格式，迁移脚本重哈希（用户首次登录强制改密提示）。实施首步用一条真实哈希验证。
- **搜索排序漂移**：PG tsvector 与 FTS5 bm25 分数不可逐位一致 → 以 api.test.ts 搜索用例与前端预期为准（相关性 top-N 近似即可，验收标准为行为等价非分数相等）。
- **时间戳格式**：保持 TEXT ISO8601 原样迁移，避免时区位移。
- **上传文件引用**：media_assets.url 相对路径迁移时保持原值；uploads/ 目录文件不动（仅反代路径不变）。
- **回滚**：迁移前 SQLite 快照 + 旧后端可随时起服；systemd 单元与 PM2 不并存（切换点明确：迁移脚本通过 + 冒烟通过后停 PM2 起 systemd）。

## 10. 里程碑（Milestones）

- M1：Rust 骨架 + 全部 schema + 公开 API 实现，公开端点冒烟通过。
- M2：管理 API 全实现 + JWT 中间件 + 上传/媒体，api_compat 测试绿。
- M3：迁移脚本 + 校验报告 + 回滚演练（真实数据副本）。
- M4：部署资产（systemd/nginx/scripts）+ deploy-ops 重写 + 服务器上线冒烟。
