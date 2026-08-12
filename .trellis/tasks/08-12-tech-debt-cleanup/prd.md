# 技术债清理（P0+P1+P2 全量）

## Goal

系统性清理 Shino's Bolg 仓库现存技术债：文档/信息漂移（AGENTS.md、spec 与现状不符）、后端空密码播种安全缺口、部署脚本弱断言与 PATH 依赖、Rust 依赖版本核验、前端自动化测试从零落地、admin 面板残留原生弹窗与已知情 defer 项实施。全程不改变 API 契约与行为。

## Background

- 现状（2026-08-12 主会话逐文件核查）：
  - Rust 迁移（08-11-backend-rust-migration）M1–M3 已完成，旧 Bun 后端已删除，spec 已同步主体。
  - **漂移**：AGENTS.md:29 结构地图仍写 `backend/（Elysia + SQLite + Drizzle schema）`、`deploy/（1Panel 运维资产）`；AGENTS.md:59 仍写 `backend/data/`、`backend/uploads/` 不入库（目录已不存在）；`.trellis/spec/backend/directory-structure.md:45-47` 残留"旧 src/ 待删除、历史 data/"；spec/tech-stack.md 写死 Rust 版本号。
  - **安全**：`backend/rust/src/config.rs` 对 `ADMIN_PASSWORD`/`ADMIN_JWT_SECRET` 缺省取空串，`auth.rs::ensure_default_admin` 会对空串播种空密码管理员（部署漏配即产生空密码账户）。
  - **脚本**：`deploy/scripts/online-smoke.sh` uploads 探测 `curl -sSI` 不检查状态码（404 也通过）且硬编码文件名；`deploy/scripts/*.sh` 依赖 PATH 含 `~/.cargo/bin`（非交互 shell 无）。
  - **依赖**：Cargo.lock 中 sqlx 锁 0.8.0（0.8 系列有补丁版）；rusqlite 0.31 因 libsqlite3-sys 冲突锁定（Cargo.toml 注释已说明）；edition 2021。
  - **前端无测试**：`spec/frontend/testing.md` 已承认无测试框架；核心逻辑（router、search 质量分、admin shared dialog、data normalize）无回归保护。
  - **残留**：`window.confirm` 2 处未保存提示（posts.ts:147、friends.ts:203）未 dialog 化；audit defer 3 项（A4 拖动排序、P4 列表缩略、PR3 上传校验）未实施。
  - git 历史含 `backend/.env` blob（仅占位值 admin123/local-dev-secret，无真实凭据，08-11-bolg-structure-upgrade 已核验记录）。
- 用户决策（2026-08-12）：P0+P1+P2 全量清理，创建独立任务；git 历史不重写（按推荐，文档记录结论）。

## Requirements

1. **P0 文档漂移**：AGENTS.md 结构地图与维护纪律同步 Rust 现状；spec/backend/directory-structure.md 清理历史残留；tech-stack.md Rust 版本表述去固化。
2. **P0 安全**：`Config::from_env` 对空 `ADMIN_PASSWORD`/`ADMIN_JWT_SECRET` fail-fast；`ensure_default_admin` 拒绝空串（含单元测试）。
3. **P0 脚本**：online-smoke.sh 状态码断言 + 探测文件名参数化；deploy/scripts/*.sh PATH 兜底。
4. **P0 小清理**：markdown.rs `pending.unwrap()` → `if let`。
5. **P1 依赖**：`cargo update` 拉补丁版并全量回归；核验 jsonwebtoken/ammonia 最新性；rusqlite 0.31 结论写入 spec（预期保守维持）；edition 2021→2024 自动迁移。
6. **P2 前端测试**：vitest + happy-dom；package.json `test` 脚本；核心模块测试（search 质量分、router、shared dialog、data normalize）；local-verify.sh 挂接。
7. **P2 残留**：2 处 `window.confirm` → 样式化 dialog；defer 3 项（A4/P4/PR3）实施。
8. **不变式**：API 行为不变；`cargo test`（含 api_compat 19 用例）全绿；前端 typecheck/build 绿；自检三命令通过。

## Acceptance Criteria

- [ ] AGENTS.md 与 .trellis/spec/ 全部同步现状，grep 旧栈描述（Elysia/SQLite/1Panel/PM2 除历史说明外）无残留
- [ ] 空 ADMIN_PASSWORD/ADMIN_JWT_SECRET 时后端启动报错退出（fail-fast），测试覆盖
- [ ] online-smoke.sh 对非 2xx 状态码判失败；脚本在无 `~/.cargo/bin` PATH 的 shell 下可运行
- [ ] `cargo update` 后 `cargo fmt/clippy/test` 全绿；edition 2024 迁移后全绿
- [ ] 前端 vitest 测试集绿（核心模块覆盖），local-verify.sh 含前端测试步骤
- [ ] 2 处 window.confirm 替换完成；A4/P4/PR3 实施完成（可核验）
- [ ] 自检三命令通过；无凭据入库；分 P0/P1/P2 三个提交

## Out of Scope

- 生产部署与真实数据迁移（08-11-backend-rust-migration M4，待环境信息）。
- sqlx 0.9 大版本升级（风险>收益，结论写入 spec 已知项）。
- git 历史重写（filter-repo；D2 决策：仅文档记录，不重写）。
- API 契约/行为变更。

## Notes

- 执行顺序 P0 → P1 → P2，每块独立提交；提交前 `cargo test` + 前端 typecheck + 自检三命令。
- 任务完成后 trellis-update-spec 同步（frontend/testing.md 等），再提交收尾。
