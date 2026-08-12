use sqlx::{FromRow, PgPool};

use crate::error::ServiceError;
use crate::models::{ApiFriendLink, FriendLinkInput, FriendLinkPatch, now_iso};

#[derive(Debug, FromRow)]
struct FriendLinkRow {
    id: i32,
    name: String,
    description: String,
    avatar: String,
    url: String,
    enabled: bool,
    display_order: i32,
}

fn to_friend_link(row: FriendLinkRow) -> ApiFriendLink {
    ApiFriendLink {
        id: row.id,
        name: row.name,
        description: row.description,
        avatar: row.avatar,
        url: row.url,
        enabled: row.enabled,
        display_order: row.display_order,
    }
}

/// 友链必填校验（对应 assertFriendInput）
fn assert_friend_input(
    name: &str,
    description: &str,
    avatar: &str,
    url: &str,
) -> Result<(), ServiceError> {
    if name.trim().is_empty() {
        return Err(ServiceError::BadRequest("name 不能为空".into()));
    }
    if description.trim().is_empty() {
        return Err(ServiceError::BadRequest("description 不能为空".into()));
    }
    if avatar.trim().is_empty() {
        return Err(ServiceError::BadRequest("avatar 不能为空".into()));
    }
    if url.trim().is_empty() {
        return Err(ServiceError::BadRequest("url 不能为空".into()));
    }
    Ok(())
}

/// 公开友链列表：GET /api/friend-links（enabled=true，ORDER BY display_order ASC, id ASC）
pub async fn list_public(pool: &PgPool) -> Result<Vec<ApiFriendLink>, sqlx::Error> {
    let rows: Vec<FriendLinkRow> = sqlx::query_as(
        "SELECT id, name, description, avatar, url, enabled, display_order
         FROM friend_links
         WHERE enabled = true
         ORDER BY display_order ASC, id ASC",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| ApiFriendLink {
            id: r.id,
            name: r.name,
            description: r.description,
            avatar: r.avatar,
            url: r.url,
            enabled: r.enabled,
            display_order: r.display_order,
        })
        .collect())
}

// ---------- M2：管理 API ----------

/// 管理友链列表：GET /api/admin/friend-links（全部，ORDER BY display_order ASC, id ASC）
pub async fn list_admin(pool: &PgPool) -> Result<Vec<ApiFriendLink>, sqlx::Error> {
    let rows: Vec<FriendLinkRow> = sqlx::query_as(
        "SELECT id, name, description, avatar, url, enabled, display_order
         FROM friend_links
         ORDER BY display_order ASC, id ASC",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(to_friend_link).collect())
}

/// 新建友链：POST /api/admin/friend-links
pub async fn create(pool: &PgPool, input: FriendLinkInput) -> Result<ApiFriendLink, ServiceError> {
    assert_friend_input(&input.name, &input.description, &input.avatar, &input.url)?;

    let now = now_iso();
    let enabled = input.enabled.unwrap_or(true);
    let display_order = input.display_order.unwrap_or(0);

    let id: i32 = sqlx::query_scalar(
        "INSERT INTO friend_links (name, description, avatar, url, enabled, display_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id",
    )
    .bind(input.name.trim())
    .bind(input.description.trim())
    .bind(input.avatar.trim())
    .bind(input.url.trim())
    .bind(enabled)
    .bind(display_order)
    .bind(&now)
    .bind(&now)
    .fetch_one(pool)
    .await?;

    get_by_id(pool, id)
        .await?
        .ok_or_else(|| ServiceError::BadRequest("友链创建失败".into()))
}

/// 更新友链：PATCH /api/admin/friend-links/:id
pub async fn update(
    pool: &PgPool,
    friend_id: i32,
    input: FriendLinkPatch,
) -> Result<Option<ApiFriendLink>, ServiceError> {
    let Some(existing) = get_by_id(pool, friend_id).await? else {
        return Ok(None);
    };

    let next_name = input
        .name
        .as_deref()
        .unwrap_or(&existing.name)
        .trim()
        .to_string();
    let next_description = input
        .description
        .as_deref()
        .unwrap_or(&existing.description)
        .trim()
        .to_string();
    let next_avatar = input
        .avatar
        .as_deref()
        .unwrap_or(&existing.avatar)
        .trim()
        .to_string();
    let next_url = input
        .url
        .as_deref()
        .unwrap_or(&existing.url)
        .trim()
        .to_string();
    let next_enabled = input.enabled.unwrap_or(existing.enabled);
    let next_display_order = input
        .display_order
        .unwrap_or(i64::from(existing.display_order));

    assert_friend_input(&next_name, &next_description, &next_avatar, &next_url)?;

    sqlx::query(
        "UPDATE friend_links
         SET name = $1, description = $2, avatar = $3, url = $4, enabled = $5, display_order = $6, updated_at = $7
         WHERE id = $8",
    )
    .bind(&next_name)
    .bind(&next_description)
    .bind(&next_avatar)
    .bind(&next_url)
    .bind(next_enabled)
    .bind(next_display_order)
    .bind(now_iso())
    .bind(friend_id)
    .execute(pool)
    .await?;

    Ok(Some(ApiFriendLink {
        id: existing.id,
        name: next_name,
        description: next_description,
        avatar: next_avatar,
        url: next_url,
        enabled: next_enabled,
        display_order: next_display_order as i32,
    }))
}

/// 删除友链：DELETE /api/admin/friend-links/:id
pub async fn delete(pool: &PgPool, friend_id: i32) -> Result<bool, ServiceError> {
    let result = sqlx::query("DELETE FROM friend_links WHERE id = $1")
        .bind(friend_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

async fn get_by_id(pool: &PgPool, friend_id: i32) -> Result<Option<ApiFriendLink>, sqlx::Error> {
    let row: Option<FriendLinkRow> = sqlx::query_as(
        "SELECT id, name, description, avatar, url, enabled, display_order
         FROM friend_links WHERE id = $1 LIMIT 1",
    )
    .bind(friend_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(to_friend_link))
}
