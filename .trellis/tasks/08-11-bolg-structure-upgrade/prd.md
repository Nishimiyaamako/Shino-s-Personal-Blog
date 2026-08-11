# Bolg 结构升级：landing + admin UI 重构 + 后端 Rust/Postgres 迁移

## Goal

对 Shino's Bolg（frontend/ Vanilla TS SPA + backend/ Elysia+SQLite + deploy/）做一轮结构性升级，产出三个可独立验收的交付物：① `/` 变 landing 页、博客全家族移入 `/blog` 前缀；② 管理界面先审计后系统性 UI 重构；③ 后端用 Rust（Axum + Postgres）API 兼容重写并迁移数据。三个交付物互相独立，分别规划、分别验收、分别提交。

## Background

- 用户原始诉求（三轮设计树收敛）：前端想要"主的导航页面"（landing）路由到博客，友链/关于从主导航移出；管理界面 UI 粗糙需细节优化；后端想换 Rust。
- 已确认的架构决策（用户逐轮确认，全部为 D 系列决策）：
  - D1 `/` 变 landing（参考 https://2x.nz/ 结构：Hero + 分区卡片 + 关于摘要 + 社交关注），博客全家族移入 `/blog` 前缀。
  - D2 `/blog` 承载文章列表（含主题筛选/排序，即原 `/posts` 全部功能），`/posts` 旧链 301 至 `/blog`。
  - D3 精选功能整体废弃：`isFeatured`/`featuredOrder` 字段、`/home/featured` API、admin 精选管理模块（`/admin/featured`）一并清理。
  - D4 友链/关于从主导航移到 landing 卡片 + 页脚；`/friends`、`/about` URL 保持不变。
  - D5 landing 新增 site-config 字段 `slogan`（后台可编辑）。
  - D6 前端保留 Vanilla TS + 现有模块化结构，不引入框架；管理界面先产出 UI 审计清单（逐模块、带 file:line）供用户确认，再系统性重构样式。
  - D7 后端 Rust 框架 Axum + SQLx + Postgres；生产用云 Postgres、本地用原生 Postgres，连接串环境变量化（两者兼容）。
  - D8 部署形态：systemd 服务 + nginx 标准配置（去掉 1Panel 模板依赖与 docker 相关设计），目录沿用 `/opt/shino-blog/{backend,data,uploads,env,logs,backups}`。
  - D9 SQLite→Postgres 数据迁移归后端子任务（迁移脚本 + 校验 + 回滚一起验收）；精选相关数据随 D3 丢弃。
  - D10 后端 API 兼容重写：前端零 API 改动；前端 `VITE_API_BASE_URL`（frontend/src/data/api.ts:20）已存在，仅补环境文档。
  - D11 多机容错本次只做到"单实例 Postgres + 无状态 API"，集群/流复制/HA 均 deferred。
  - D12 拆库方案已评估否决：monorepo 保持（git subtree split 未来可无损拆），部署分离不依赖仓库分离。
- 环境事实（已核验）：
  - 本机无 Rust 工具链（cargo/rustc 均不存在），无原生 postgres；有 docker 29.1.3、bun（~/.bun/bin/bun）、node。
  - 生产 SQLite 数据在服务器 `/opt/shino-blog/data/blog.sqlite`（本地 backend/data/ 为空，实施时需 ssh 核验服务器环境）。
  - ✅ 已核验并解决：`backend/.env` 曾被误提交入库（初始提交含开发占位值 admin123/local-dev-secret，无真实凭据）；已 `git rm --cached` + .gitignore 补 `.env`/`rust/target`，当前 HEAD 树干净（2026-08-11 核验，git 历史 blob 仍存在，凭据轮换与否由用户决定）。
  - Git remote: origin = git@github.com:Nishimiyaamako/Shino-s-Personal-Blog.git，main 分支。

## Requirements

1. **任务地图**（本父任务拥有源需求集与跨子任务验收标准）：
   - 子任务 08-11-frontend-landing-blog-routing：landing 页 + `/blog` 路由迁移 + 精选废弃 + slogan 配置 + 旧链 301 + nginx 规则。
   - 子任务 08-11-admin-ui-polish：管理界面 UI 审计清单 → 系统性样式重构（Vanilla TS，不引框架）。
   - 子任务 08-11-backend-rust-migration：Axum + SQLx + Postgres API 兼容重写；SQLite→PG 迁移；systemd + nginx 部署资产；deploy-ops 手册重写。
2. **执行顺序**：子任务 1 → 2 串行（2 的审计在 1 的路由/nav 变更基础上进行），子任务 3 独立可并行；三者独立验收、独立提交。
3. **跨子任务约束**：
   - 凭据红线：任何密码/私钥/令牌不得写入文档；`.env` 不得入库；引用凭据位置用 `<凭据位置>` 占位。
   - API 契约以子任务 3 为基准：现有公开 API（/health /posts /posts/:slug /home/featured(废弃) /friend-links /about /profile-card /site-config /search）与管理 API 全部保持行为等价。
   - 提交前在仓库根运行自检三命令（AGENTS.md 自检清单）。
   - spec 更新归 trellis-update-spec 阶段（Phase 3.3），各子任务收尾时按需更新 `.trellis/spec/`。

## Acceptance Criteria

- [ ] 子任务 1：`/` 渲染 landing（Hero+分区卡片+关于摘要+社交关注），`/blog` 全家族（列表/详情/标签/归档）路由工作，`/posts*` 旧链 301，精选字段/API/后台模块完全移除，slogan 后台可编辑且前台生效。
- [ ] 子任务 2：UI 审计清单全项闭环（file:line 可追踪），各 admin 模块样式统一（间距/层级/表单反馈/响应式），无 JS 行为回归。
- [ ] 子任务 3：全部现有 API 行为等价（以现有 Bun 后端 api.test.ts 为基准的 Rust 对照测试通过），SQLite→PG 数据完整迁移（计数+抽样校验），systemd + nginx 冒烟通过，deploy-ops.md 重写完成。
- [ ] `backend/.env` 入库问题核验并处理（git 历史清除或确认实际未含凭据）。
- [ ] 三个子任务均独立提交，git 工作区干净，自检三命令通过。

## Out of Scope

- 拆库（monorepo 保持）。
- 多机容错集群/主从/HA/异地多活（deferred，D11）。
- Cloudflare Workers 前端接入的具体实施（deferred，仅预留 VITE_API_BASE_URL 环境化）。
- 管理界面引入框架/组件库。
- 精选功能保留（明确废弃，D3）。

## Open Questions

- [ ] 无（设计树已收敛，剩余技术细节在子任务 design/implement 中核验）。

## Notes

- 本父任务为 PRD-only（无直接实施工作，实施目标为子任务）；design/implement 在子任务目录。
- 实施首步固定核验项：backend/.env 入库问题（凭据红线）。
