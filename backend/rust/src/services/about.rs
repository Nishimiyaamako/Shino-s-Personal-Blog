use sqlx::{FromRow, PgPool};

use crate::models::{now_iso, ApiAboutPayload};

const DEFAULT_ABOUT_MARKDOWN: &str = "# 关于\n\n内容建设中。";

#[derive(Debug, FromRow)]
struct AboutRow {
    hero_title: String,
    hero_subtitle: String,
    intro_paragraphs: String,
    narrative_sections: String,
    timeline_title: String,
    timeline_events: String,
}

fn parse_json_array(value: &str) -> serde_json::Value {
    serde_json::from_str(value).unwrap_or_else(|_| serde_json::json!([]))
}

/// 单行表兜底：无行时插入默认 markdown（与 ensureAboutRow 一致）
async fn ensure_about_row(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO about_page (id, markdown, updated_at) VALUES (1, $1, $2)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(DEFAULT_ABOUT_MARKDOWN)
    .bind(now_iso())
    .execute(pool)
    .await?;

    Ok(())
}

/// 关于页：GET /api/about
pub async fn get_about(pool: &PgPool) -> Result<ApiAboutPayload, sqlx::Error> {
    ensure_about_row(pool).await?;

    let row: Option<AboutRow> = sqlx::query_as(
        "SELECT hero_title, hero_subtitle, intro_paragraphs, narrative_sections, timeline_title, timeline_events
         FROM about_page WHERE id = 1",
    )
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        return Ok(ApiAboutPayload {
            hero_title: String::new(),
            hero_subtitle: String::new(),
            intro_paragraphs: serde_json::json!([]),
            narrative_sections: serde_json::json!([]),
            timeline_title: String::new(),
            timeline_label: String::new(),
            timeline_events: serde_json::json!([]),
        });
    };

    Ok(ApiAboutPayload {
        hero_title: row.hero_title,
        hero_subtitle: row.hero_subtitle,
        intro_paragraphs: parse_json_array(&row.intro_paragraphs),
        narrative_sections: parse_json_array(&row.narrative_sections),
        timeline_title: row.timeline_title.clone(),
        // 兼容旧后端：timelineLabel 恒等于 timeline_title
        timeline_label: row.timeline_title,
        timeline_events: parse_json_array(&row.timeline_events),
    })
}
