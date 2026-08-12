use sqlx::{FromRow, PgPool};

use crate::error::ServiceError;
use crate::models::{ApiProfileCard, ApiProfileContact, ProfileUpdateInput, now_iso};

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

    Ok(ApiProfileCard {
        name: profile.name,
        bio: profile.bio,
        avatar: profile.avatar,
        contacts: read_contacts(pool).await?,
    })
}

// ---------- M2：管理 API ----------

/// 更新名片卡：PATCH /api/admin/profile-card（对齐 updateProfileCard）
/// 注意：路由层已做 `body.name ?? ''` 合并，故空 body 会触发必填校验（与旧后端一致）
pub async fn update_profile_card(
    pool: &PgPool,
    input: ProfileUpdateInput,
) -> Result<ApiProfileCard, ServiceError> {
    let name = input.name.as_deref().unwrap_or("").trim().to_string();
    let bio = input.bio.as_deref().unwrap_or("").trim().to_string();
    let avatar = input.avatar.as_deref().unwrap_or("").trim().to_string();

    if name.is_empty() || bio.is_empty() || avatar.is_empty() {
        return Err(ServiceError::BadRequest("name/bio/avatar 不能为空".into()));
    }

    // 联系方式：displayOrder 默认按序号，过滤 platform/href 为空项（对齐旧实现）
    let contacts: Vec<(String, String, String, i64)> = input
        .contacts
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .map(|(index, c)| {
            (
                c.platform.trim().to_string(),
                c.label.trim().to_string(),
                c.href.trim().to_string(),
                c.display_order.unwrap_or(index as i64),
            )
        })
        .filter(|(platform, _, href, _)| !platform.is_empty() && !href.is_empty())
        .collect();

    let now = now_iso();

    sqlx::query(
        "INSERT INTO profile_card (id, name, bio, avatar, updated_at)
         VALUES (1, $1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, bio = EXCLUDED.bio, avatar = EXCLUDED.avatar, updated_at = EXCLUDED.updated_at",
    )
    .bind(&name)
    .bind(&bio)
    .bind(&avatar)
    .bind(now)
    .execute(pool)
    .await?;

    sqlx::query("DELETE FROM profile_contacts WHERE profile_card_id = 1")
        .execute(pool)
        .await?;

    for (platform, label, href, display_order) in &contacts {
        sqlx::query(
            "INSERT INTO profile_contacts (profile_card_id, platform, label, href, display_order)
             VALUES (1, $1, $2, $3, $4)",
        )
        .bind(platform)
        .bind(label)
        .bind(href)
        .bind(display_order)
        .execute(pool)
        .await?;
    }

    Ok(ApiProfileCard {
        name,
        bio,
        avatar,
        contacts: read_contacts(pool).await?,
    })
}

async fn read_contacts(pool: &PgPool) -> Result<Vec<ApiProfileContact>, sqlx::Error> {
    let rows: Vec<ProfileContactRow> = sqlx::query_as(
        "SELECT id, platform, label, href, display_order
         FROM profile_contacts
         WHERE profile_card_id = 1
         ORDER BY display_order ASC, id ASC",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|c| ApiProfileContact {
            id: c.id,
            platform: c.platform,
            label: c.label,
            href: c.href,
            display_order: c.display_order,
        })
        .collect())
}
