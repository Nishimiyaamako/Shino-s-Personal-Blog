use sqlx::{FromRow, PgPool};

use crate::models::{now_iso, ApiProfileCard, ApiProfileContact};

const DEFAULT_PROFILE_NAME: &str = "Shino";
const DEFAULT_PROFILE_BIO: &str = "Luna say maybe";
const DEFAULT_PROFILE_AVATAR: &str = "https://placehold.co/120x120/png?text=ME";

#[derive(Debug, FromRow)]
struct ProfileRow {
    name: String,
    bio: String,
    avatar: String,
}

#[derive(Debug, FromRow)]
struct ProfileContactRow {
    id: i32,
    platform: String,
    label: String,
    href: String,
    display_order: i32,
}

/// 单行表兜底：无行时插入默认名片（与 ensureProfileCard 一致）
async fn ensure_profile_card(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO profile_card (id, name, bio, avatar, updated_at) VALUES (1, $1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(DEFAULT_PROFILE_NAME)
    .bind(DEFAULT_PROFILE_BIO)
    .bind(DEFAULT_PROFILE_AVATAR)
    .bind(now_iso())
    .execute(pool)
    .await?;

    Ok(())
}

/// 名片卡：GET /api/profile-card
pub async fn get_profile_card(pool: &PgPool) -> Result<ApiProfileCard, sqlx::Error> {
    ensure_profile_card(pool).await?;

    let profile: ProfileRow =
        sqlx::query_as("SELECT name, bio, avatar FROM profile_card WHERE id = 1 LIMIT 1")
            .fetch_one(pool)
            .await?;

    let contacts: Vec<ProfileContactRow> = sqlx::query_as(
        "SELECT id, platform, label, href, display_order
         FROM profile_contacts
         WHERE profile_card_id = 1
         ORDER BY display_order ASC, id ASC",
    )
    .fetch_all(pool)
    .await?;

    Ok(ApiProfileCard {
        name: profile.name,
        bio: profile.bio,
        avatar: profile.avatar,
        contacts: contacts
            .into_iter()
            .map(|c| ApiProfileContact {
                id: c.id,
                platform: c.platform,
                label: c.label,
                href: c.href,
                display_order: c.display_order,
            })
            .collect(),
    })
}
