use std::net::SocketAddr;

use shino_blog_backend::{auth, build_router, config::Config, db};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let config = Config::from_env()?;
    let pool = db::init_pool(&config.database_url).await?;

    // 启动播种默认管理员（对齐旧 app.ts createApp → ensureDefaultAdminUser）
    auth::ensure_default_admin(&pool, &config.admin_username, &config.admin_password)
        .await
        .map_err(|e| anyhow::anyhow!("播种默认管理员失败: {e}"))?;

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("shino-blog-backend listening on http://{addr}");

    axum::serve(listener, build_router(db::AppState { pool, config })).await?;

    Ok(())
}
