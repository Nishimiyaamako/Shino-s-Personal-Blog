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
        Self::from_reader(|key| std::env::var(key).ok())
    }

    /// 从任意键值读取器构造配置（生产用进程环境；测试注入假读取器，无环境副作用）
    fn from_reader(read: impl Fn(&str) -> Option<String>) -> anyhow::Result<Self> {
        let database_url = read("DATABASE_URL").ok_or_else(|| {
            anyhow::anyhow!("DATABASE_URL 未设置（Postgres 连接串，例：postgres://user:pass@host:5432/shino_blog）")
        })?;
        let admin_username = read("ADMIN_USERNAME").unwrap_or_else(|| "admin".to_string());
        let admin_password = read("ADMIN_PASSWORD").unwrap_or_default();
        let admin_jwt_secret = read("ADMIN_JWT_SECRET").unwrap_or_default();

        // 凭据 fail-fast：漏配 ADMIN_PASSWORD 会播种空密码管理员，漏配 JWT_SECRET 会签发可伪造令牌
        if admin_password.is_empty() {
            return Err(anyhow::anyhow!(
                "ADMIN_PASSWORD 未设置（后端拒绝以空密码启动，防止播种空密码管理员）"
            ));
        }
        if admin_jwt_secret.is_empty() {
            return Err(anyhow::anyhow!(
                "ADMIN_JWT_SECRET 未设置（后端拒绝以空密钥启动，防止签发可伪造令牌）"
            ));
        }

        Ok(Self {
            host: read("HOST").unwrap_or_else(|| "127.0.0.1".to_string()),
            port: read("PORT").and_then(|v| v.parse().ok()).unwrap_or(3001),
            database_url,
            uploads_root: read("UPLOADS_ROOT").unwrap_or_else(|| "uploads".to_string()),
            node_env: read("NODE_ENV").unwrap_or_else(|| "development".to_string()),
            admin_username,
            admin_password,
            admin_jwt_secret,
            admin_jwt_expires_hours: read("ADMIN_JWT_EXPIRES_HOURS")
                .and_then(|v| v.parse().ok())
                .unwrap_or(24),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reader_with<'a>(overrides: Vec<(&'a str, &'a str)>) -> impl Fn(&str) -> Option<String> + 'a {
        move |key| {
            overrides
                .iter()
                .find(|(k, _)| *k == key)
                .map(|(_, v)| v.to_string())
        }
    }

    fn base_vars() -> Vec<(&'static str, &'static str)> {
        vec![
            ("DATABASE_URL", "postgres://u:p@127.0.0.1:5432/blog"),
            ("ADMIN_USERNAME", "admin"),
            ("ADMIN_PASSWORD", "s3cret"),
            ("ADMIN_JWT_SECRET", "jwt-secret"),
        ]
    }

    #[test]
    fn from_reader_ok_with_all_required() {
        let cfg = Config::from_reader(reader_with(base_vars())).expect("config should parse");
        assert_eq!(cfg.port, 3001);
        assert_eq!(cfg.admin_username, "admin");
        assert_eq!(cfg.admin_jwt_expires_hours, 24);
    }

    #[test]
    fn from_reader_rejects_empty_password() {
        let mut vars = base_vars();
        vars[2] = ("ADMIN_PASSWORD", "");
        let err = Config::from_reader(reader_with(vars)).expect_err("empty password must fail");
        assert!(err.to_string().contains("ADMIN_PASSWORD"));
    }

    #[test]
    fn from_reader_rejects_missing_password() {
        let vars = base_vars()
            .into_iter()
            .filter(|(k, _)| *k != "ADMIN_PASSWORD")
            .collect();
        let err = Config::from_reader(reader_with(vars)).expect_err("missing password must fail");
        assert!(err.to_string().contains("ADMIN_PASSWORD"));
    }

    #[test]
    fn from_reader_rejects_empty_jwt_secret() {
        let mut vars = base_vars();
        vars[3] = ("ADMIN_JWT_SECRET", "");
        let err = Config::from_reader(reader_with(vars)).expect_err("empty jwt secret must fail");
        assert!(err.to_string().contains("ADMIN_JWT_SECRET"));
    }

    #[test]
    fn from_reader_rejects_missing_database_url() {
        let err = Config::from_reader(reader_with(vec![
            ("ADMIN_PASSWORD", "x"),
            ("ADMIN_JWT_SECRET", "y"),
        ]))
        .expect_err("missing DATABASE_URL must fail");
        assert!(err.to_string().contains("DATABASE_URL"));
    }

    #[test]
    fn from_reader_parses_port_and_expiry() {
        let mut vars = base_vars();
        vars.extend([
            ("PORT", "3101"),
            ("ADMIN_JWT_EXPIRES_HOURS", "48"),
            ("NODE_ENV", "production"),
        ]);
        let cfg = Config::from_reader(reader_with(vars)).expect("config should parse");
        assert_eq!(cfg.port, 3101);
        assert_eq!(cfg.admin_jwt_expires_hours, 48);
        assert_eq!(cfg.node_env, "production");
    }
}
