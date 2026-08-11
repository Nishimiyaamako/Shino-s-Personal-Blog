mod config;
mod db;
mod error;
mod models;
mod routes;
mod services;

use std::net::SocketAddr;

use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use axum::http::Method;
use axum::Router;
use tower_http::cors::{AllowOrigin, CorsLayer};

use db::AppState;

/// 应用装配：CORS → /api 路由（对齐旧 app.ts：origin: true 回显请求 Origin + credentials + 方法集）
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
        .nest("/api", routes::public::router(state))
        .layer(cors)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let config = config::Config::from_env()?;
    let pool = db::init_pool(&config.database_url).await?;

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("shino-blog-backend listening on http://{addr}");

    axum::serve(listener, build_router(AppState { pool })).await?;

    Ok(())
}
