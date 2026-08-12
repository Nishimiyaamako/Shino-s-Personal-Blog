use sqlx::{FromRow, PgPool};

use crate::error::ServiceError;
use crate::models::{ApiSiteConfig, SiteConfigPatch, now_iso};

#[derive(Debug, FromRow)]
struct SiteConfigRow {
    site_title: String,
    site_subtitle: String,
    slogan: String,
    copyright_owner: String,
    powered_by: String,
    icp_record_text: String,
    icp_record_url: String,
    public_security_record_text: String,
    public_security_record_url: String,
    friend_link_template: String,
}

pub fn default_site_config() -> ApiSiteConfig {
    ApiSiteConfig {
        site_title: "ShinoLog".to_string(),
        site_subtitle: String::new(),
        slogan: String::new(),
        copyright_owner: "NagaShino".to_string(),
        powered_by: "Powered by Vite + TypeScript.".to_string(),
        icp_record_text: String::new(),
        icp_record_url: String::new(),
        public_security_record_text: String::new(),
        public_security_record_url: String::new(),
        friend_link_template: "name: 'ShinoLog',\ndescription: '某个状态混沌家伙的Blog',\navatar: 'https://example.com/avatar.png',\nurl: 'https://nagashino.top/'".to_string(),
    }
}

/// 站点配置：GET /api/site-config（无行时返回默认值，无写入副作用）
pub async fn get_site_config(pool: &PgPool) -> Result<ApiSiteConfig, sqlx::Error> {
    let row: Option<SiteConfigRow> = sqlx::query_as(
        "SELECT site_title, site_subtitle, slogan, copyright_owner, powered_by,
                icp_record_text, icp_record_url,
                public_security_record_text, public_security_record_url,
                friend_link_template
         FROM site_config WHERE id = 1 LIMIT 1",
    )
    .fetch_optional(pool)
    .await?;

    Ok(match row {
        Some(r) => ApiSiteConfig {
            site_title: r.site_title,
            site_subtitle: r.site_subtitle,
            slogan: r.slogan,
            copyright_owner: r.copyright_owner,
            powered_by: r.powered_by,
            icp_record_text: r.icp_record_text,
            icp_record_url: r.icp_record_url,
            public_security_record_text: r.public_security_record_text,
            public_security_record_url: r.public_security_record_url,
            friend_link_template: r.friend_link_template,
        },
        None => default_site_config(),
    })
}

// ---------- M2：管理 API ----------

/// 更新站点配置：PATCH /api/admin/site-config（对齐 updateSiteConfig：与当前值合并 + trim + upsert）
pub async fn update_site_config(
    pool: &PgPool,
    patch: SiteConfigPatch,
) -> Result<ApiSiteConfig, ServiceError> {
    let current = get_site_config(pool).await?;

    let site_title = patch
        .site_title
        .as_deref()
        .unwrap_or(&current.site_title)
        .trim()
        .to_string();
    let site_subtitle = patch
        .site_subtitle
        .as_deref()
        .unwrap_or(&current.site_subtitle)
        .trim()
        .to_string();
    let slogan = patch
        .slogan
        .as_deref()
        .unwrap_or(&current.slogan)
        .trim()
        .to_string();
    let copyright_owner = patch
        .copyright_owner
        .as_deref()
        .unwrap_or(&current.copyright_owner)
        .trim()
        .to_string();
    let powered_by = patch
        .powered_by
        .as_deref()
        .unwrap_or(&current.powered_by)
        .trim()
        .to_string();
    let icp_record_text = patch
        .icp_record_text
        .as_deref()
        .unwrap_or(&current.icp_record_text)
        .trim()
        .to_string();
    let icp_record_url = patch
        .icp_record_url
        .as_deref()
        .unwrap_or(&current.icp_record_url)
        .trim()
        .to_string();
    let public_security_record_text = patch
        .public_security_record_text
        .as_deref()
        .unwrap_or(&current.public_security_record_text)
        .trim()
        .to_string();
    let public_security_record_url = patch
        .public_security_record_url
        .as_deref()
        .unwrap_or(&current.public_security_record_url)
        .trim()
        .to_string();
    let friend_link_template = patch
        .friend_link_template
        .as_deref()
        .unwrap_or(&current.friend_link_template)
        .trim()
        .to_string();

    if site_title.is_empty() {
        return Err(ServiceError::BadRequest("站点标题不能为空".into()));
    }

    sqlx::query(
        "INSERT INTO site_config (id, site_title, site_subtitle, slogan, copyright_owner, powered_by,
                                  icp_record_text, icp_record_url, public_security_record_text,
                                  public_security_record_url, friend_link_template, updated_at)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           site_title = EXCLUDED.site_title,
           site_subtitle = EXCLUDED.site_subtitle,
           slogan = EXCLUDED.slogan,
           copyright_owner = EXCLUDED.copyright_owner,
           powered_by = EXCLUDED.powered_by,
           icp_record_text = EXCLUDED.icp_record_text,
           icp_record_url = EXCLUDED.icp_record_url,
           public_security_record_text = EXCLUDED.public_security_record_text,
           public_security_record_url = EXCLUDED.public_security_record_url,
           friend_link_template = EXCLUDED.friend_link_template,
           updated_at = EXCLUDED.updated_at",
    )
    .bind(&site_title)
    .bind(&site_subtitle)
    .bind(&slogan)
    .bind(&copyright_owner)
    .bind(&powered_by)
    .bind(&icp_record_text)
    .bind(&icp_record_url)
    .bind(&public_security_record_text)
    .bind(&public_security_record_url)
    .bind(&friend_link_template)
    .bind(now_iso())
    .execute(pool)
    .await?;

    Ok(ApiSiteConfig {
        site_title,
        site_subtitle,
        slogan,
        copyright_owner,
        powered_by,
        icp_record_text,
        icp_record_url,
        public_security_record_text,
        public_security_record_url,
        friend_link_template,
    })
}
