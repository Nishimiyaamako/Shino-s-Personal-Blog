use std::env;

/// 环境变量配置（键名兼容旧 backend/.env.example，新增 DATABASE_URL 替代 DATABASE_PATH）
#[derive(Debug, Clone)]
pub struct Config {
    /// 监听地址（默认 127.0.0.1，生产经 nginx 反代）
    pub host: String,
    /// 监听端口（旧键名 PORT，默认 3001；开发用 3101 覆盖）
    pub port: u16,
    /// Postgres 连接串（新键名 DATABASE_URL）
    pub database_url: String,
    /// 上传根目录（旧键名 UPLOADS_ROOT）
    pub uploads_root: String,
    pub node_env: String,
    pub admin_username: String,
    pub admin_password: String,
    pub admin_jwt_secret: String,
    pub admin_jwt_expires_hours: u64,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let database_url = env::var("DATABASE_URL")
            .map_err(|_| anyhow::anyhow!("DATABASE_URL 未设置（Postgres 连接串，例：postgres://user:pass@host:5432/shino_blog）"))?;

        Ok(Self {
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(3001),
            database_url,
            uploads_root: env::var("UPLOADS_ROOT").unwrap_or_else(|_| "uploads".to_string()),
            node_env: env::var("NODE_ENV").unwrap_or_else(|_| "development".to_string()),
            admin_username: env::var("ADMIN_USERNAME").unwrap_or_else(|_| "admin".to_string()),
            admin_password: env::var("ADMIN_PASSWORD").unwrap_or_default(),
            admin_jwt_secret: env::var("ADMIN_JWT_SECRET").unwrap_or_default(),
            admin_jwt_expires_hours: env::var("ADMIN_JWT_EXPIRES_HOURS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(24),
        })
    }
}
