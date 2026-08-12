//! Shino's Bolg backend（Rust / Axum + Postgres）— API-compatible reimplementation
//! lib 目标：供 tests/ 集成测试（api_compat.rs）复用应用装配

pub mod auth;
pub mod config;
pub mod db;
pub mod error;
pub mod markdown;
pub mod models;
pub mod routes;
pub mod services;

use axum::Router;
use axum::http::Method;
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use tower_http::cors::{AllowOrigin, CorsLayer};

use db::AppState;

/// 应用装配：CORS → /api 公开 + /api/admin 管理 → /uploads 静态文件
/// （对齐旧 app.ts：origin: true 回显请求 Origin + credentials + 方法集）
pub fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::mirror_request())
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([CONTENT_TYPE, AUTHORIZATION]);

    Router::new()
        .nest("/api", routes::public::router(state.clone()))
        .nest("/api/admin", routes::admin::router(state.clone()))
        .route(
            "/uploads/images/{fileName}",
            axum::routing::get(routes::uploads::serve_image).with_state(state),
        )
        .layer(cors)
}
