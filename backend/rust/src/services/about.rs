use sqlx::{FromRow, PgPool};

use crate::error::ServiceError;
use crate::models::{now_iso, AboutUpdateInput, ApiAboutPayload};

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

// ---------- M2：管理 API ----------

/// 更新关于页：PATCH /api/admin/about（对齐 updateAbout）
pub async fn update_about(
    pool: &PgPool,
    input: AboutUpdateInput,
) -> Result<ApiAboutPayload, ServiceError> {
    let hero_title = input.hero_title.as_deref().unwrap_or("").trim().to_string();
    let hero_subtitle = input
        .hero_subtitle
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_string();
    let intro_paragraphs = match input.intro_paragraphs {
        Some(serde_json::Value::Array(arr)) => serde_json::Value::Array(arr),
        // 旧后端：Array.isArray 为 false → []
        _ => serde_json::json!([]),
    };
    let narrative_sections = match input.narrative_sections {
        Some(serde_json::Value::Array(arr)) => serde_json::Value::Array(arr),
        _ => serde_json::json!([]),
    };
    let timeline_title = input
        .timeline_title
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_string();
    let timeline_label = input
        .timeline_label
        .unwrap_or_else(|| "Milestones".to_string());
    let timeline_events = match input.timeline_events {
        Some(serde_json::Value::Array(arr)) => serde_json::Value::Array(arr),
        _ => serde_json::json!([]),
    };

    if hero_title.is_empty() {
        return Err(ServiceError::BadRequest("Hero 标题不能为空".into()));
    }

    // markdown 列 NOT NULL：保留现有值（旧后端仅在有行时 PATCH 成功；此处对全新库兜底默认值）
    let current_markdown: Option<String> =
        sqlx::query_scalar("SELECT markdown FROM about_page WHERE id = 1")
            .fetch_optional(pool)
            .await?;
    let markdown = current_markdown.unwrap_or_else(|| DEFAULT_ABOUT_MARKDOWN.to_string());

    let now = now_iso();
    sqlx::query(
        "INSERT INTO about_page (id, markdown, hero_title, hero_subtitle, intro_paragraphs, narrative_sections, timeline_title, timeline_events, updated_at)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           hero_title = EXCLUDED.hero_title,
           hero_subtitle = EXCLUDED.hero_subtitle,
           intro_paragraphs = EXCLUDED.intro_paragraphs,
           narrative_sections = EXCLUDED.narrative_sections,
           timeline_title = EXCLUDED.timeline_title,
           timeline_events = EXCLUDED.timeline_events,
           updated_at = EXCLUDED.updated_at",
    )
    .bind(&markdown)
    .bind(&hero_title)
    .bind(&hero_subtitle)
    .bind(serde_json::to_string(&intro_paragraphs).unwrap_or_else(|_| "[]".into()))
    .bind(serde_json::to_string(&narrative_sections).unwrap_or_else(|_| "[]".into()))
    .bind(&timeline_title)
    .bind(serde_json::to_string(&timeline_events).unwrap_or_else(|_| "[]".into()))
    .bind(now)
    .execute(pool)
    .await?;

    Ok(ApiAboutPayload {
        hero_title,
        hero_subtitle,
        intro_paragraphs,
        narrative_sections,
        timeline_title,
        // 对齐旧后端：PATCH 响应 timelineLabel 取请求值（默认 'Milestones'），与 GET 的恒等行为不同
        timeline_label,
        timeline_events,
    })
}
