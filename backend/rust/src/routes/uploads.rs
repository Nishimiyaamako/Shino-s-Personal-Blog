//! 上传文件静态服务：GET /uploads/images/:fileName
//! 对齐 app.ts：SAFE 文件名正则 `/^[A-Za-z0-9._-]+$/`；不存在 → 404 { error: '文件不存在' }

use axum::extract::{Path, State};
use axum::http::header::CONTENT_TYPE;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use regex::Regex;

use crate::db::AppState;
use crate::error::ApiError;

const SAFE_UPLOAD_FILE_REGEXP: &str = r"^[A-Za-z0-9._-]+$";

fn safe_file_regex() -> &'static Regex {
    static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    RE.get_or_init(|| Regex::new(SAFE_UPLOAD_FILE_REGEXP).expect("invalid safe file regex"))
}

fn mime_for_file(file_name: &str) -> &'static str {
    let ext = file_name
        .rsplit_once('.')
        .map(|(_, e)| e.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

/// GET /uploads/images/{fileName}
pub async fn serve_image(
    State(state): State<AppState>,
    Path(file_name): Path<String>,
) -> Result<Response, ApiError> {
    if !safe_file_regex().is_match(&file_name) {
        return Err(ApiError {
            status: StatusCode::BAD_REQUEST,
            message: "非法文件名".to_string(),
        });
    }

    let file_path = std::path::PathBuf::from(&state.config.uploads_root)
        .join("images")
        .join(&file_name);

    let data = match tokio::fs::read(&file_path).await {
        Ok(data) => data,
        Err(_) => {
            return Err(ApiError::not_found("文件不存在"));
        }
    };

    Ok((
        StatusCode::OK,
        [(CONTENT_TYPE, mime_for_file(&file_name))],
        data,
    )
        .into_response())
}
