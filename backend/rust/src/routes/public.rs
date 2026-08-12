use axum::extract::{Path, Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;

use crate::db::AppState;
use crate::error::{ApiError, internal};
use crate::models::{HealthResponse, ListPublishedPostResult, now_iso};
use crate::services;

/// GET /api/posts 查询参数（String 解析以对齐 TS `Number(x) || default` 的容错语义）
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPostsParams {
    pub page: Option<String>,
    pub page_size: Option<String>,
    pub tag: Option<String>,
}

/// GET /api/search 查询参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchParams {
    pub q: Option<String>,
    pub limit: Option<String>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/posts", get(list_posts))
        .route("/posts/{slug}", get(get_post))
        .route("/friend-links", get(list_friend_links))
        .route("/about", get(get_about))
        .route("/profile-card", get(get_profile_card))
        .route("/site-config", get(get_site_config))
        .route("/search", get(search))
        .with_state(state)
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        timestamp: now_iso(),
    })
}

async fn list_posts(
    State(state): State<AppState>,
    Query(params): Query<ListPostsParams>,
) -> Result<Json<ListPublishedPostResult>, ApiError> {
    let result = services::posts::list_published(
        &state.pool,
        params.page.as_ref(),
        params.page_size.as_ref(),
        params.tag.as_ref(),
    )
    .await
    .map_err(internal)?;
    Ok(Json(result))
}

async fn get_post(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<crate::models::ApiPostDetail>, ApiError> {
    match services::posts::get_published_by_slug(&state.pool, &slug)
        .await
        .map_err(internal)?
    {
        Some(post) => Ok(Json(post)),
        None => Err(ApiError::not_found("文章不存在")),
    }
}

async fn list_friend_links(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let items = services::friends::list_public(&state.pool)
        .await
        .map_err(internal)?;
    Ok(Json(serde_json::json!({ "items": items })))
}

async fn get_about(
    State(state): State<AppState>,
) -> Result<Json<crate::models::ApiAboutPayload>, ApiError> {
    let payload = services::about::get_about(&state.pool)
        .await
        .map_err(internal)?;
    Ok(Json(payload))
}

async fn get_profile_card(
    State(state): State<AppState>,
) -> Result<Json<crate::models::ApiProfileCard>, ApiError> {
    let card = services::profile::get_profile_card(&state.pool)
        .await
        .map_err(internal)?;
    Ok(Json(card))
}

async fn get_site_config(
    State(state): State<AppState>,
) -> Result<Json<crate::models::ApiSiteConfig>, ApiError> {
    let config = services::site_config::get_site_config(&state.pool)
        .await
        .map_err(internal)?;
    Ok(Json(config))
}

async fn search(
    State(state): State<AppState>,
    Query(params): Query<SearchParams>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let items = services::search::search_published(
        &state.pool,
        params.q.as_deref().unwrap_or(""),
        params.limit.as_ref(),
    )
    .await
    .map_err(internal)?;
    Ok(Json(serde_json::json!({ "items": items })))
}
