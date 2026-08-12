# 前后端类型契约加固：api_compat 键集断言 + 前端夹具测试

## Goal

为 `backend/rust/src/models.rs` ↔ `frontend/src/types/`（api.ts/content.ts 等）的镜像同步加**测试防线**：后端侧锁序列化形状，前端侧锁类型契约与真实响应形状一致。不引入生成器、不改生产代码。

## Background

- 现状：models.rs（379 行）全量 `#[serde(rename_all = "camelCase")]` 且以"对应 TS xxx"注释约定同步；前端 types/api.ts（121 行）+ content.ts（63 行）等镜像。当前形状对齐（pageSize 等两端一致），属维护成本债非 bug。
- 已有 `backend/rust/tests/api_compat.rs`（Rust 集成测试，验证 API 兼容性）——先读其现状再扩展。
- spec/frontend/type-safety.md:11,24,30 已承认手动镜像债务，本次补防线不改方向。

## Requirements

1. 扩展 `backend/rust/tests/api_compat.rs`：对公开端点响应做**递归键集断言**（serde_json::Value 键集合与契约键集合比对），锁定序列化形状，防意外删/改字段。
2. 前端新增 vitest 夹具测试：`frontend/src/` 下放真实响应形状快照（JSON fixture），运行时递归断言 fixture 键集与 TS 接口键集一致（防后端漂移后前端不同步），编译期 `as` 断言兜底。
3. 双向锁方向：后端断言"实际响应键 ⊆ 契约键"（防意外新增漂移）；前端断言"契约键 ⊆ fixture 键"（防契约遗漏字段）。

## Acceptance Criteria

- [ ] api_compat.rs 覆盖全部公开端点（posts/search/friend-links/about/profile-card/site-config/health）响应键集断言，`cargo test` 全绿
- [ ] 前端夹具测试覆盖核心响应类型，`bun test` 全绿
- [ ] 生产代码零改动
- [ ] spec/type-safety.md 同步：夹具更新流程（后端改字段 → 更新 fixture → 前端类型 → 测试全绿）
- [ ] utoipa + openapi-typescript 必要性评估结论记录（Notes）

## Notes

- 夹具来源：以 api_compat.rs 中构造的响应体为准生成 JSON 快照；注释标注对应后端结构名与 TS 类型名。
- 评估（不实施）：若 API 变更频率上升，再评估 utoipa + openapi-typescript（标注成本 vs 单源头收益）。
