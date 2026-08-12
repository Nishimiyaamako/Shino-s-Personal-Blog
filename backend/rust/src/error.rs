use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

/// 统一错误响应：`{ error: string }` + HTTP 状态码（与现有 Elysia 后端一致）
#[derive(Debug, Clone)]
pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl ApiError {
    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }

    #[allow(dead_code)] // M2 使用
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    #[allow(dead_code)] // M2 使用
    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            message: message.into(),
        }
    }
}

/// 内部错误 → 500，日志记录详情，响应体不泄露内部信息
pub fn internal<E: std::fmt::Display>(err: E) -> ApiError {
    tracing::error!(error = %err, "internal server error");
    ApiError {
        status: StatusCode::INTERNAL_SERVER_ERROR,
        message: "服务器内部错误".to_string(),
    }
}

/// 服务层错误：业务校验失败（→400，消息与旧后端 throw new Error 一致）或数据库错误（→500）
#[derive(Debug)]
pub enum ServiceError {
    BadRequest(String),
    Db(sqlx::Error),
}

impl From<sqlx::Error> for ServiceError {
    fn from(err: sqlx::Error) -> Self {
        Self::Db(err)
    }
}

impl std::fmt::Display for ServiceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::BadRequest(message) => write!(f, "{message}"),
            Self::Db(err) => write!(f, "{err}"),
        }
    }
}

impl From<ServiceError> for ApiError {
    fn from(err: ServiceError) -> Self {
        match err {
            ServiceError::BadRequest(message) => Self::bad_request(message),
            ServiceError::Db(db_err) => internal(db_err),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}
