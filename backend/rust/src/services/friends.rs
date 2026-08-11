use sqlx::{FromRow, PgPool};

use crate::models::ApiFriendLink;

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
