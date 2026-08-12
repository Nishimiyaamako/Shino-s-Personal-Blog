//! 认证层：管理员密码（argon2id）与 JWT（HS256）签发/验证。
//! 对齐 backend/src/auth/{admin,jwt}.ts：
//! - Bun.password.hash 默认 argon2id（OWASP 参数 m=65536 KiB, t=3, p=4），Rust 侧同参数
//! - 验证走 PHC 字符串内嵌参数，故可验证既有 `$argon2id$` 哈希（参数无关）
//! - JWT：HS256、sub=user.id、claim username、iat/exp（小时）

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::SaltString;
use argon2::{Algorithm, Argon2, Params, PasswordHash, PasswordHasher, PasswordVerifier, Version};
use axum::http::HeaderMap;
use jsonwebtoken::{
    decode, encode, Algorithm as JwtAlgorithm, DecodingKey, EncodingKey, Header, Validation,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::error::{ApiError, ServiceError};
use crate::models::now_iso;

/// 管理用户（JWT 解析结果 / 登录成功结果）
#[derive(Debug, Clone)]
pub struct AdminUser {
    pub id: i32,
    pub username: String,
}

/// 登录成功响应：`{ token, user: { id, username } }`
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: AdminUserJson,
}

#[derive(Debug, Serialize)]
pub struct AdminUserJson {
    pub id: i32,
    pub username: String,
}

/// JWT 载荷（与 jose 对齐：sub + username claim）
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    username: String,
    iat: usize,
    exp: usize,
}

/// argon2id 哈希：与 Bun.password.hash 默认参数一致（OWASP m=65536, t=3, p=4）
pub fn hash_password(password: &str) -> Result<String, ServiceError> {
    let params = Params::new(65_536, 3, 4, Some(32))
        .map_err(|e| ServiceError::BadRequest(format!("argon2 参数错误: {e}")))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let salt = SaltString::generate(&mut OsRng);
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| ServiceError::BadRequest(format!("密码哈希失败: {e}")))?;
    Ok(hash.to_string())
}

/// 验证密码：解析 PHC 字符串（内嵌参数），与 Bun.password.verify 等价
pub fn verify_password(password: &str, hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

/// 启动播种（对齐 ensureDefaultAdminUser）：
/// 无用户则插入；已有用户但密码不同则更新哈希
pub async fn ensure_default_admin(
    pool: &PgPool,
    username: &str,
    password: &str,
) -> Result<(), ServiceError> {
    if password.is_empty() {
        return Err(ServiceError::BadRequest(
            "ADMIN_PASSWORD 为空，拒绝播种空密码管理员".into(),
        ));
    }

    let row: Option<(i32, String)> =
        sqlx::query_as("SELECT id, password_hash FROM admin_users WHERE username = $1 LIMIT 1")
            .bind(username)
            .fetch_optional(pool)
            .await?;

    let now = now_iso();
    let password_hash = hash_password(password)?;

    match row {
        None => {
            sqlx::query(
                "INSERT INTO admin_users (username, password_hash, created_at) VALUES ($1, $2, $3)",
            )
            .bind(username)
            .bind(password_hash)
            .bind(now)
            .execute(pool)
            .await?;
        }
        Some((id, existing_hash)) => {
            if !verify_password(password, &existing_hash) {
                sqlx::query("UPDATE admin_users SET password_hash = $1 WHERE id = $2")
                    .bind(password_hash)
                    .bind(id)
                    .execute(pool)
                    .await?;
            }
        }
    }

    Ok(())
}

/// 校验用户名/密码（对齐 verifyAdminCredentials）；失败返回 None
pub async fn verify_credentials(
    pool: &PgPool,
    username: &str,
    password: &str,
) -> Result<Option<AdminUser>, ServiceError> {
    let row: Option<(i32, String, String)> = sqlx::query_as(
        "SELECT id, username, password_hash FROM admin_users WHERE username = $1 LIMIT 1",
    )
    .bind(username.trim())
    .fetch_optional(pool)
    .await?;

    let Some((id, db_username, password_hash)) = row else {
        return Ok(None);
    };

    if !verify_password(password, &password_hash) {
        return Ok(None);
    }

    Ok(Some(AdminUser {
        id,
        username: db_username,
    }))
}

/// 签发 JWT（HS256，sub=user.id，exp = now + expires_hours 小时）
pub fn sign_token(
    secret: &str,
    expires_hours: u64,
    user: &AdminUser,
) -> Result<String, ServiceError> {
    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user.id.to_string(),
        username: user.username.clone(),
        iat: now,
        exp: now + (expires_hours as usize) * 3600,
    };

    encode(
        &Header::new(JwtAlgorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| ServiceError::BadRequest(format!("token 签发失败: {e}")))
}

/// 验证 JWT（对齐 verifyAdminToken）；失败返回 None
pub fn verify_token(secret: &str, token: &str) -> Option<AdminUser> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(JwtAlgorithm::HS256),
    )
    .ok()?;

    let claims = data.claims;
    let id = claims.sub.parse::<i32>().ok()?;

    if id <= 0 {
        return None;
    }

    Some(AdminUser {
        id,
        username: claims.username,
    })
}

/// 从 Authorization 头提取 Bearer token（对齐 getBearerToken）
pub fn get_bearer_token(headers: &HeaderMap) -> Option<String> {
    let auth_header = headers
        .get(axum::http::header::AUTHORIZATION)?
        .to_str()
        .ok()?
        .trim();

    let lower = auth_header.to_lowercase();
    if !lower.starts_with("bearer ") {
        return None;
    }

    let token = auth_header["bearer ".len()..].trim();
    if token.is_empty() {
        None
    } else {
        Some(token.to_string())
    }
}

/// 管理路由守卫：无 token / 无效 token → 401 { error: 'Unauthorized' }
pub fn require_admin(headers: &HeaderMap, secret: &str) -> Result<AdminUser, ApiError> {
    let unauthorized = ApiError::unauthorized("Unauthorized");

    let token = get_bearer_token(headers).ok_or_else(|| unauthorized.clone())?;
    verify_token(secret, &token).ok_or(unauthorized)
}
