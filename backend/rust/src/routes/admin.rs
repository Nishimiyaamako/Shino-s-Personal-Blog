//! 管理 API：/api/admin/*（除 /auth/login 外均需 Bearer JWT）。
//! 对齐 backend/src/routes/admin.ts：路由薄层、错误统一 { error } + 状态码。

use axum::Json;
use axum::Router;
use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Multipart, Path, Query, State};
use axum::http::HeaderMap;
use axum::http::header::CONTENT_TYPE;
use axum::http::request::Parts;
use axum::routing::{delete, get, patch, post};
use regex::Regex;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::auth;
use crate::db::AppState;
use crate::error::{ApiError, ServiceError, internal};
use crate::models::{
    AboutUpdateInput, ApiAboutPayload, ApiProfileCard, ApiSiteConfig, FriendLinkInput,
    FriendLinkPatch, ListAdminPostResult, PostStatus, ProfileUpdateInput, SiteConfigPatch,
    UpdatePostInput, UpsertPostInput,
};
use crate::services;

const SAFE_URL_REGEXP: &str = r"(?i)^https?://.+";

fn url_regex() -> &'static Regex {
    static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    RE.get_or_init(|| Regex::new(SAFE_URL_REGEXP).expect("invalid url regex"))
}

/// 上传体上限（默认 2MB 不够承载 5MB 图片校验路径）
const UPLOAD_BODY_LIMIT: usize = 8 * 1024 * 1024;

/// 管理认证提取器：作为处理器首个参数时，在 body 消费（Bytes/Multipart）之前完成鉴权，
/// 对齐旧后端 requireAdmin 前置守卫（无 token/无效 token → 401，不解析请求体）
struct AdminAuth;

impl axum::extract::FromRequestParts<AppState> for AdminAuth {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        auth::require_admin(&parts.headers, &state.config.admin_jwt_secret)?;
        Ok(AdminAuth)
    }
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/auth/login", post(login))
        .route("/posts", get(list_posts).post(create_post))
        .route(
            "/posts/{id}",
            get(get_post).patch(update_post).delete(delete_post),
        )
        .route("/posts/{id}/publish", post(publish_post))
        .route("/posts/{id}/unpublish", post(unpublish_post))
        .route("/posts/rebuild-search-index", post(rebuild_search_index))
        .route("/uploads/image", post(upload_image))
        .route("/media", get(list_media))
        .route("/media/{id}", delete(delete_media))
        .route(
            "/friend-links",
            get(list_friend_links).post(create_friend_link),
        )
        .route(
            "/friend-links/{id}",
            patch(update_friend_link).delete(delete_friend_link),
        )
        .route("/about", get(get_about).patch(update_about))
        .route(
            "/profile-card",
            get(get_profile_card).patch(update_profile_card),
        )
        .route(
            "/site-config",
            get(get_site_config).patch(update_site_config),
        )
        .layer(DefaultBodyLimit::max(UPLOAD_BODY_LIMIT))
        .with_state(state)
}

// ---------- 通用辅助（对齐 routes/helpers.ts） ----------

/// 解析 JSON 请求体：非 application/json → 400（对齐 parseJsonBody）
fn parse_json_body<T: serde::de::DeserializeOwned>(
    headers: &HeaderMap,
    body: Bytes,
) -> Result<T, ApiError> {
    let content_type = headers
        .get(CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !content_type.contains("application/json") {
        return Err(ApiError::bad_request("请求体必须是 application/json"));
    }

    serde_json::from_slice(&body).map_err(|e| ApiError::bad_request(e.to_string()))
}

/// 正整数解析：对齐 asPositiveInt（parseInt 前缀解析 + >0 校验）
fn as_positive_int(value: &str) -> Option<i32> {
    let digits: String = value
        .trim_start()
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();

    let parsed = digits.parse::<i32>().ok()?;
    if parsed <= 0 {
        return None;
    }
    Some(parsed)
}

/// URL 校验：空值跳过；非 http(s) 开头 → 400（对齐 validateUrl）
fn validate_url(value: Option<&str>, label: &str) -> Result<(), ApiError> {
    let Some(value) = value else { return Ok(()) };
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    if !url_regex().is_match(trimmed) {
        return Err(ApiError::bad_request(format!(
            "{label} 格式不正确，必须以 http:// 或 https:// 开头"
        )));
    }
    Ok(())
}

/// 查询参数解析：对齐 TS `Number(x) || default`（非数值 → default）
/// 0/负数透传，由服务层 Math.max/clamp 归一（对齐旧后端 Math.max(1, -5) = 1 语义）
fn parse_query_number(value: Option<&str>, default: i64) -> i64 {
    value.and_then(|v| v.parse::<i64>().ok()).unwrap_or(default)
}

/// 错误映射：ServiceError → ApiError（400 业务 / 500 内部）
fn map_service(err: ServiceError) -> ApiError {
    ApiError::from(err)
}

// ---------- 认证 ----------

/// POST /api/admin/auth/login（无需认证）
async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    #[derive(Deserialize)]
    struct LoginBody {
        #[serde(default)]
        username: Option<String>,
        #[serde(default)]
        password: Option<String>,
    }

    let body: LoginBody = parse_json_body(&headers, body)?;
    let username = body.username.unwrap_or_default().trim().to_string();
    let password = body.password.unwrap_or_default();

    if username.is_empty() || password.is_empty() {
        return Err(ApiError::bad_request("username/password 不能为空"));
    }

    let user = auth::verify_credentials(&state.pool, &username, &password)
        .await
        .map_err(map_service)?
        .ok_or_else(|| ApiError::unauthorized("账号或密码错误"))?;

    let token = auth::sign_token(
        &state.config.admin_jwt_secret,
        state.config.admin_jwt_expires_hours,
        &user,
    )
    .map_err(map_service)?;

    Ok(Json(json!({
        "token": token,
        "user": { "id": user.id, "username": user.username }
    })))
}

// ---------- 文章 ----------

/// GET /api/admin/posts
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListPostsParams {
    q: Option<String>,
    status: Option<String>,
    tag: Option<String>,
    page: Option<String>,
    page_size: Option<String>,
}

async fn list_posts(
    State(state): State<AppState>,
    _admin: AdminAuth,
    Query(params): Query<ListPostsParams>,
) -> Result<Json<ListAdminPostResult>, ApiError> {
    let status = match params.status.as_deref() {
        Some("draft") => Some(PostStatus::Draft),
        Some("published") => Some(PostStatus::Published),
        _ => None, // all
    };
    let page = parse_query_number(params.page.as_deref(), 1);
    let page_size = parse_query_number(params.page_size.as_deref(), 20);

    let result = services::posts::list_admin(
        &state.pool,
        params.q.as_deref(),
        status,
        params.tag.as_deref(),
        page,
        page_size,
    )
    .await
    .map_err(map_service)?;

    Ok(Json(result))
}

/// GET /api/admin/posts/:id
async fn get_post(
    State(state): State<AppState>,
    _admin: AdminAuth,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let post_id = as_positive_int(&id).ok_or_else(|| ApiError::bad_request("无效文章 id"))?;

    let post = services::posts::get_admin_by_id(&state.pool, post_id)
        .await
        .map_err(map_service)?
        .ok_or_else(|| ApiError::not_found("文章不存在"))?;

    Ok(Json(json!({ "item": post })))
}

/// POST /api/admin/posts
async fn create_post(
    State(state): State<AppState>,
    _admin: AdminAuth,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    let input: UpsertPostInput = parse_json_body(&headers, body)?;
    let created = services::posts::create(&state.pool, input)
        .await
        .map_err(map_service)?;

    Ok(Json(json!({ "item": created })))
}

/// PATCH /api/admin/posts/:id
async fn update_post(
    State(state): State<AppState>,
    _admin: AdminAuth,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    let post_id = as_positive_int(&id).ok_or_else(|| ApiError::bad_request("无效文章 id"))?;
    let input: UpdatePostInput = parse_json_body(&headers, body)?;

    let updated = services::posts::update(&state.pool, post_id, input)
        .await
        .map_err(map_service)?
        .ok_or_else(|| ApiError::not_found("文章不存在"))?;

    Ok(Json(json!({ "item": updated })))
}

/// DELETE /api/admin/posts/:id
async fn delete_post(
    State(state): State<AppState>,
    _admin: AdminAuth,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let post_id = as_positive_int(&id).ok_or_else(|| ApiError::bad_request("无效文章 id"))?;

    let ok = services::posts::delete(&state.pool, post_id)
        .await
        .map_err(map_service)?;

    if !ok {
        return Err(ApiError::not_found("文章不存在"));
    }

    Ok(Json(json!({ "ok": true })))
}

/// POST /api/admin/posts/:id/publish
async fn publish_post(
    State(state): State<AppState>,
    _admin: AdminAuth,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let post_id = as_positive_int(&id).ok_or_else(|| ApiError::bad_request("无效文章 id"))?;

    let item = services::posts::publish(&state.pool, post_id)
        .await
        .map_err(map_service)?
        .ok_or_else(|| ApiError::not_found("文章不存在"))?;

    Ok(Json(json!({ "item": item })))
}

/// POST /api/admin/posts/:id/unpublish
async fn unpublish_post(
    State(state): State<AppState>,
    _admin: AdminAuth,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let post_id = as_positive_int(&id).ok_or_else(|| ApiError::bad_request("无效文章 id"))?;

    let item = services::posts::unpublish(&state.pool, post_id)
        .await
        .map_err(map_service)?
        .ok_or_else(|| ApiError::not_found("文章不存在"))?;

    Ok(Json(json!({ "item": item })))
}

/// POST /api/admin/posts/rebuild-search-index
async fn rebuild_search_index(
    State(state): State<AppState>,
    _admin: AdminAuth,
) -> Result<Json<Value>, ApiError> {
    services::posts::rebuild_search_index(&state.pool)
        .await
        .map_err(map_service)?;

    Ok(Json(json!({ "ok": true })))
}

// ---------- 上传 / 媒体 ----------

/// POST /api/admin/uploads/image（multipart，字段名 file）
async fn upload_image(
    State(state): State<AppState>,
    _admin: AdminAuth,
    mut multipart: Multipart,
) -> Result<Json<Value>, ApiError> {
    let mut found: Option<(String, String, Vec<u8>)> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?
    {
        if field.name() == Some("file") && field.file_name().is_some() {
            let file_name = field.file_name().unwrap_or_default().to_string();
            let mime_type = field.content_type().unwrap_or_default().to_string();
            let data = field
                .bytes()
                .await
                .map_err(|e| ApiError::bad_request(e.to_string()))?;
            found = Some((file_name, mime_type, data.to_vec()));
            break;
        }
    }

    let Some((file_name, mime_type, data)) = found else {
        return Err(ApiError::bad_request("file 字段缺失"));
    };

    let uploaded = services::media::save_image_asset(
        &state.pool,
        &state.config.uploads_root,
        &file_name,
        &mime_type,
        &data,
    )
    .await
    .map_err(map_service)?;

    Ok(Json(json!({ "item": uploaded })))
}

/// GET /api/admin/media
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaListParams {
    page: Option<String>,
    page_size: Option<String>,
    sort: Option<String>,
    order: Option<String>,
    filter: Option<String>,
}

async fn list_media(
    State(state): State<AppState>,
    _admin: AdminAuth,
    Query(params): Query<MediaListParams>,
) -> Result<Json<Value>, ApiError> {
    let page = parse_query_number(params.page.as_deref(), 1);
    let page_size = parse_query_number(params.page_size.as_deref(), 20);
    let sort = if params.sort.as_deref() == Some("size") {
        "size"
    } else {
        "created_at"
    };
    let order = if params.order.as_deref() == Some("asc") {
        "ASC"
    } else {
        "DESC"
    };
    let filter = match params.filter.as_deref() {
        Some("orphaned") => "orphaned",
        Some("referenced") => "referenced",
        _ => "all",
    };

    let result =
        services::media::list_media_assets(&state.pool, page, page_size, sort, order, filter)
            .await
            .map_err(map_service)?;

    Ok(Json(json!(result)))
}

/// DELETE /api/admin/media/:id
async fn delete_media(
    State(state): State<AppState>,
    _admin: AdminAuth,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let id: i64 = id
        .trim()
        .parse()
        .map_err(|_| ApiError::bad_request("无效的 ID"))?;

    if id < 1 {
        return Err(ApiError::bad_request("无效的 ID"));
    }

    services::media::delete_media_asset(&state.pool, &state.config.uploads_root, id as i32)
        .await
        .map_err(map_service)?;

    Ok(Json(json!({ "ok": true })))
}

// ---------- 友链 ----------

/// GET /api/admin/friend-links
async fn list_friend_links(
    State(state): State<AppState>,
    _admin: AdminAuth,
) -> Result<Json<Value>, ApiError> {
    let items = services::friends::list_admin(&state.pool)
        .await
        .map_err(internal)?;

    Ok(Json(json!({ "items": items })))
}

/// POST /api/admin/friend-links
async fn create_friend_link(
    State(state): State<AppState>,
    _admin: AdminAuth,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    let input: FriendLinkInput = parse_json_body(&headers, body)?;

    validate_url(Some(&input.url), "友链 URL")?;
    validate_url(Some(&input.avatar), "友链头像 URL")?;

    let item = services::friends::create(&state.pool, input)
        .await
        .map_err(map_service)?;

    Ok(Json(json!({ "item": item })))
}

/// PATCH /api/admin/friend-links/:id
async fn update_friend_link(
    State(state): State<AppState>,
    _admin: AdminAuth,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<Json<Value>, ApiError> {
    let friend_id = as_positive_int(&id).ok_or_else(|| ApiError::bad_request("无效友链 id"))?;
    let input: FriendLinkPatch = parse_json_body(&headers, body)?;

    validate_url(input.url.as_deref(), "友链 URL")?;
    validate_url(input.avatar.as_deref(), "友链头像 URL")?;

    let item = services::friends::update(&state.pool, friend_id, input)
        .await
        .map_err(map_service)?
        .ok_or_else(|| ApiError::not_found("友链不存在"))?;

    Ok(Json(json!({ "item": item })))
}

/// DELETE /api/admin/friend-links/:id
async fn delete_friend_link(
    State(state): State<AppState>,
    _admin: AdminAuth,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let friend_id = as_positive_int(&id).ok_or_else(|| ApiError::bad_request("无效友链 id"))?;

    let ok = services::friends::delete(&state.pool, friend_id)
        .await
        .map_err(map_service)?;

    if !ok {
        return Err(ApiError::not_found("友链不存在"));
    }

    Ok(Json(json!({ "ok": true })))
}

// ---------- 关于页 ----------

/// GET /api/admin/about
async fn get_about(
    State(state): State<AppState>,
    _admin: AdminAuth,
) -> Result<Json<ApiAboutPayload>, ApiError> {
    let payload = services::about::get_about(&state.pool)
        .await
        .map_err(internal)?;

    Ok(Json(payload))
}

/// PATCH /api/admin/about
async fn update_about(
    State(state): State<AppState>,
    _admin: AdminAuth,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<ApiAboutPayload>, ApiError> {
    let input: AboutUpdateInput = parse_json_body(&headers, body)?;
    let payload = services::about::update_about(&state.pool, input)
        .await
        .map_err(map_service)?;

    Ok(Json(payload))
}

// ---------- 名片卡 ----------

/// GET /api/admin/profile-card
async fn get_profile_card(
    State(state): State<AppState>,
    _admin: AdminAuth,
) -> Result<Json<ApiProfileCard>, ApiError> {
    let card = services::profile::get_profile_card(&state.pool)
        .await
        .map_err(internal)?;

    Ok(Json(card))
}

/// PATCH /api/admin/profile-card
async fn update_profile_card(
    State(state): State<AppState>,
    _admin: AdminAuth,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<ApiProfileCard>, ApiError> {
    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase")]
    struct RawProfileBody {
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        bio: Option<String>,
        #[serde(default)]
        avatar: Option<String>,
        #[serde(default)]
        contacts: Option<Vec<crate::models::ProfileContactInput>>,
    }

    let raw: RawProfileBody = parse_json_body(&headers, body)?;

    // 对齐旧路由：`body.name ?? ''` 合并后再入服务（空 body → 必填校验失败）
    let input = ProfileUpdateInput {
        name: Some(raw.name.unwrap_or_default()),
        bio: Some(raw.bio.unwrap_or_default()),
        avatar: Some(raw.avatar.unwrap_or_default()),
        contacts: raw.contacts,
    };

    let card = services::profile::update_profile_card(&state.pool, input)
        .await
        .map_err(map_service)?;

    Ok(Json(card))
}

// ---------- 站点配置 ----------

/// GET /api/admin/site-config
async fn get_site_config(
    State(state): State<AppState>,
    _admin: AdminAuth,
) -> Result<Json<ApiSiteConfig>, ApiError> {
    let config = services::site_config::get_site_config(&state.pool)
        .await
        .map_err(internal)?;

    Ok(Json(config))
}

/// PATCH /api/admin/site-config
async fn update_site_config(
    State(state): State<AppState>,
    _admin: AdminAuth,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<ApiSiteConfig>, ApiError> {
    let input: SiteConfigPatch = parse_json_body(&headers, body)?;

    validate_url(input.icp_record_url.as_deref(), "ICP 备案 URL")?;
    validate_url(input.public_security_record_url.as_deref(), "公安备案 URL")?;

    let config = services::site_config::update_site_config(&state.pool, input)
        .await
        .map_err(map_service)?;

    Ok(Json(config))
}
