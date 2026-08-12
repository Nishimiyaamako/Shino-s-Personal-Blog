# 技术债清理 — Implement

## 执行顺序（P0 → P1 → P2，每块独立提交）

### [P0] 文档漂移 + 安全 + 脚本断言 + 小清理

1. AGENTS.md:29 结构地图同步（backend/ → Rust(Axum+Postgres) 单一 crate；deploy/ → systemd+nginx 资产；docs/kb 同步核实）。
2. AGENTS.md:59 维护纪律同步（backend/rust/target 忽略；删除 backend/data、backend/uploads 表述）。
3. `.trellis/spec/backend/directory-structure.md` 删除历史残留段；`tech-stack.md` Rust 版本表述去固化。
4. `config.rs`：`from_env` 对空 ADMIN_PASSWORD / ADMIN_JWT_SECRET 返回错误（fail-fast）；`auth.rs` ensure_default_admin 空串拒绝（已有 hash 逻辑前加校验）。
5. `markdown.rs:61`：`pending.as_mut().unwrap()` → `if let Some(pending)` 重构（保持语义）。
6. `online-smoke.sh`：uploads 探测改 `curl -o /dev/null -w '%{http_code}'`，断言 2xx/404 集合（404 允许=文件不存在但静态代理工作），文件名参数化 `${UPLOAD_PROBE_FILE:-steam-bugs-linux.webp}`；其余探测段落加状态码断言（root/admin/login/health/blog/posts-301）。
7. `deploy/scripts/*.sh` 顶部 PATH 兜底：`case ":${PATH}:" in *":${HOME}/.cargo/bin:"*) ;; *) export PATH="${HOME}/.cargo/bin:${PATH}" ;; esac`（或等价）。
8. 验证：`cargo fmt && cargo clippy --all-targets -- -D warnings && cargo test`；`npm run typecheck && npm run build`；自检三命令。**提交 P0。**

### [P1] 依赖更新 + edition 2024

9. `cargo update`（补丁级）；核验 jsonwebtoken/ammonia 最新版本（cargo search 或 crates.io 比对）。
10. rusqlite 0.31 锁定评估：验证 sqlx 0.8 migrate 特性对 libsqlite3-sys 的依赖约束是否仍存在；结论（预期保守维持）写入 spec/tech-stack.md 或 Cargo.toml 注释。
11. edition 2021→2024：`cargo fix --edition`（或手动改 Cargo.toml + `cargo fmt` 修 lint）；全量 `cargo test` 回归。
12. 验证同 P0。**提交 P1。**

### [P2] 前端测试 + 残留项

13. 引入 vitest + happy-dom（`npm i -D vitest happy-dom`，前端无 node_modules 检查用 bun 亦可）；`package.json` scripts 加 `"test": "vitest run"`。
14. 测试覆盖（tsconfig 兼容处理）：
    - `src/utils/search.ts` 质量分/时间衰减公式（与后端 search.rs 同源断言）；
    - `src/router/index.ts` 路由解析（含 /blog 前缀与 admin 解析）；
    - `src/features/admin/shared.ts` confirmDialog 打开/确认/取消路径；
    - `src/data/api.ts` / `site-config.ts` normalize 函数。
15. `local-verify.sh` 步骤 4 后追加前端 `npm run test`（或 bun test），与 build 并列。
16. posts.ts:147 / friends.ts:203 `window.confirm` → shared.ts 样式化 dialog（含未保存提示语义）。
17. defer 3 项：A4 时间线/叙事拖动排序（content-settings.ts）；P4 文章列表缩略/标签预览（shared.ts renderAdminPostList）；PR3 头像上传尺寸/格式校验提示（admin.ts / avatar-crop.ts）。
18. 验证：`npm run typecheck && npm run test && npm run build`；cargo 全绿；local-verify.sh 全绿；自检三命令。**提交 P2。**

## 验证命令

```bash
cd backend/rust && cargo fmt && cargo clippy --all-targets -- -D warnings && cargo test
cd frontend && npm run typecheck && npm run test && npm run build
cd .. && ./deploy/scripts/local-verify.sh
grep -rn '⚠ 待核验' . --include='*.md'
grep -rnE '(password|passwd|api[_-]?key|token|secret|private[_-]?key)[[:space:]]*[:=]' . --include='*.md'
git config core.hooksPath
```

## 关键文件

| 文件 | 动作 |
| --- | --- |
| AGENTS.md | 结构地图/维护纪律同步 |
| .trellis/spec/backend/directory-structure.md、tech-stack.md | 历史残留清理 + 依赖结论 |
| backend/rust/src/config.rs、auth.rs | 空密码 fail-fast |
| backend/rust/src/markdown.rs | unwrap 消除 |
| backend/rust/Cargo.toml | edition 2024 |
| deploy/scripts/online-smoke.sh、local-verify.sh | 状态码断言 + PATH 兜底 + 前端测试挂接 |
| frontend/package.json、vitest.config.ts（新） | 测试框架 |
| frontend/src/**/*.test.ts（新） | 核心模块测试 |
| frontend/src/features/admin/posts.ts、friends.ts、shared.ts、content-settings.ts、admin.ts | 残留与 defer 项 |

## 风险清单

- edition 2024：主要风险为 lint 规则变化（cargo fix --edition 自动化 + clippy 兜底），API 行为不变。
- cargo update：锁文件更新后若测试失败，可回退锁文件（git checkout Cargo.lock）。
- vitest 与 Vite 7 版本兼容性：用 vitest 3.x（支持 Vite 7）；tsconfig types 补充 `vitest/globals` 或显式 import。
- 拖动排序（A4）不引入库：手写 HTML5 drag 事件或原生 sortable 简易实现（控制在单文件）。

## 提交前自检

- [ ] cargo fmt/clippy/test 全绿（37 用例 + 新增）
- [ ] 前端 typecheck/test/build 全绿
- [ ] local-verify.sh PASS；自检三命令通过
- [ ] grep 无旧栈描述残留（Elysia/SQLite/1Panel 除历史说明）
- [ ] spec 已同步（testing.md 更新 vitest、tech-stack 依赖结论）
