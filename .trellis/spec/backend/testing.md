# Backend Testing

> 后端测试约定（cargo test：单元 + 集成）。

## Test Framework

- **Runner**：cargo test（Rust 内置）
- **单元测试**：`#[cfg(test)]` 模块内嵌（如 `services/search.rs` 的 tokenize/评分公式测试）
- **集成测试**：`tests/api_compat.rs`，用 `tower::ServiceExt::oneshot` 直接测 Router（不发真实网络），等价旧 Bun api.test.ts 行为基准

```bash
export PATH="$HOME/.cargo/bin:$PATH"
cd backend/rust && cargo test --all-targets
```

## Test File Organization

- 单元测试：散布在各模块 `#[cfg(test)]`（tokenize、tsquery 构造、时间衰减、质量分、权重）
- 集成测试：`tests/api_compat.rs`（19 用例，串行互斥）
- 用例组织：`#[tokio::test]` + 共享 setup（独立库 + TRUNCATE 重置）

## Test Structure

```rust
// tests/api_compat.rs — 独立测试库 + 重置 + 串行
static TEST_MUTEX: Mutex<()> = Mutex::new(());  // 串行互斥（共享测试库）

async fn setup_test_app() -> Router { ... }  // 连接 shino_blog_test + migrate + 播种

#[tokio::test]
async fn login_success_with_default_admin() {
    let _guard = TEST_MUTEX.lock().await;
    let app = setup_test_app().await;
    let response = app
        .oneshot(Request::builder().method("POST").uri("/api/admin/auth/login")...)
        .await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    // 断言 token
}
```

- setup：连接 `shino_blog_test` 库 + 自动 migrate + 播种默认管理员
- 每用例开头 TRUNCATE 重置（幂等、可重复跑）

## Mocking

**无 mocking 库**。全部为集成测试：
1. 构建 Router（真实 PgPool 连测试库）
2. `oneshot(Request)` 发 HTTP 请求
3. 断言状态码与 JSON 体

**不 mock**：数据库（真实 Postgres）、服务（无服务级 mock）、认证（login helper 获取真实 JWT）。

## Fixtures and Factories

- 测试内自包含 helper：`request_json()`（oneshot + JSON body + Bearer token）、`login()`（完整登录流返回 JWT）
- 无独立 fixture 文件，测试数据为用例内联 typed 对象字面量
- 数据迁移演练副本：`/tmp/opencode/prod-blog.sqlite`（构造副本，含 featured 列模拟旧生产库）

## Coverage

- 无覆盖率阈值强制
- **已覆盖**（api_compat 19 用例）：公开端点（health/posts/详情/friend-links/about/profile-card/site-config/search 含中文）、admin 认证（登录/401）、文章 CRUD + 过滤 + 分页 + slug 重复 + 发布生命周期 + rebuild-search-index、友链 CRUD、上传（MIME/大小拒绝、成功 URL）、媒体列表/删除、静态文件 400/404、about/profile-card/site-config PATCH
- 迁移工具：演练脚本（首次迁移/幂等重跑/完整性抽查/回滚副本/API 冒烟）

## Common Patterns

```rust
// 认证流
let response = app.oneshot(
    Request::builder().uri("/api/admin/posts").body(Body::empty()).unwrap()
).await.unwrap();
assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

// 错误路径
let response = app.oneshot(
    Request::builder().method("POST").uri("/api/admin/posts")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {token}"))
        .body(Body::from(create_payload("duplicate-slug-case")))
        .unwrap()
).await.unwrap();
assert_eq!(response.status(), StatusCode::BAD_REQUEST);  // slug 重复
```

## 新增测试指引

- 新端点测试先看 `tests/api_compat.rs` 的既有 helper 是否复用，不要另起 fixture
- 管理端点用例 = 无 token 401 + 有效 token 主流程 + 边界（重复 slug、非法 MIME）
- 测试库隔离：只用 `shino_blog_test`，不得碰生产库 `shino_blog`
