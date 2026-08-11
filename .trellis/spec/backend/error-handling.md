# Error Handling

> 后端错误处理约定（Rust）。

## Overview

后端通过 `ServiceError` 统一错误模型，路由层 `Result` 传播 + `IntoResponse` 映射为 `{ error: string }` JSON 响应。无全局 panic 兜底（axum 默认 500）。

## Error Types

- `ServiceError::BadRequest(String)` — 业务校验失败，消息为**中文**（如 `title 不能为空`），直接透传给前端显示 → 400
- `ServiceError::NotFound(String)` — 资源不存在 → 404
- `ServiceError::Unauthorized` — 认证失败 → 401 `{ error: 'Unauthorized' }`
- `ServiceError::Database(sqlx::Error)` — 数据库错误 → 500 `{ error: '服务器内部错误' }`（**不泄露内部消息**，比旧后端更安全）

## Error Handling Patterns

```rust
// 服务层：返回 Result<_, ServiceError>
pub fn create_post(pool: &PgPool, input: UpsertPostInput) -> Result<AdminPostRecord, ServiceError> {
    if input.title.trim().is_empty() {
        return Err(ServiceError::BadRequest("title 不能为空".into()));
    }
    // ...
}

// 路由层：? 传播 + IntoResponse 自动映射
pub async fn create_post(
    State(state): State<Arc<AppState>>,
    _auth: AdminAuth,
    Json(input): Json<UpsertPostInput>,
) -> Result<Json<AdminPostRecord>, ServiceError> {
    let post = services::posts::create_post(&state.pool, input)?;
    Ok(Json(post))
}
```

- `ServiceError` 实现 `IntoResponse`（`src/error.rs`），状态码 + `{ error }` 体
- 认证失败：`AdminAuth` 提取器返回 401（body 消费前）
- DB 错误统一 500 通用文案，业务校验 400 中文消息

## API Error Responses

| 场景 | HTTP 状态 | 响应体 |
|------|-----------|--------|
| 校验失败 | 400 | `{ error: '中文消息' }` |
| 未认证/无效 token | 401 | `{ error: 'Unauthorized' }` |
| 资源不存在 | 404 | `{ error: ... }` |
| 数据库错误 | 500 | `{ error: '服务器内部错误' }` |

## Common Mistakes

- **路由层混入业务逻辑**：路由只做解析 + 调用 + `?` 传播，业务校验在服务层返回 `ServiceError`
- **DB 错误透传内部消息**：`sqlx::Error` 不得直接 `Display` 给客户端，映射为 500 通用文案
- **忘记 `?` 传播**：服务返回 `Result` 未在路由层传播会导致未处理错误
