use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

/// 统一错误响应：`{ error: string }` + HTTP 状态码（与现有 Elysia 后端一致）
#[derive(Debug)]
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

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}
