use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

/// 共享应用状态（连接池）
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
}

/// 初始化连接池并执行 SQLx 迁移（内嵌 sql/migrations/）
pub async fn init_pool(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
        .map_err(|e| anyhow::anyhow!("Postgres 连接失败: {e}"))?;

    sqlx::migrate!("./sql/migrations")
        .run(&pool)
        .await
        .map_err(|e| anyhow::anyhow!("数据库迁移失败: {e}"))?;

    Ok(pool)
}
