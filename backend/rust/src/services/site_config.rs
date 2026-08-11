use sqlx::{FromRow, PgPool};

use crate::models::ApiSiteConfig;

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
