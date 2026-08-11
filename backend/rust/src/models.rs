use serde::Serialize;

/// ISO 8601 毫秒时间戳（与 JS `new Date().toISOString()` 同格式）
pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub ok: bool,
    pub timestamp: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PostStatus {
    Draft,
    Published,
}

impl PostStatus {
    pub fn from_str(s: &str) -> Self {
        if s == "published" {
            Self::Published
        } else {
            Self::Draft
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Published => "published",
        }
    }
}

impl Serialize for PostStatus {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.as_str())
    }
}

/// 对应 TS ApiPostSummary（theme/coverImageUrl 为 null 时省略键，与 JSON.stringify(undefined) 一致）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiPostSummary {
    pub id: i32,
    pub title: String,
    pub slug: String,
    pub date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
    pub tags: Vec<String>,
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_image_url: Option<String>,
}

/// 对应 TS ApiPostDetail
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiPostDetail {
    #[serde(flatten)]
    pub summary: ApiPostSummary,
    pub content_markdown: String,
    pub content_html: String,
    pub status: PostStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub published_at: Option<String>,
}

/// 对应 TS ListPublishedPostResult
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPublishedPostResult {
    pub items: Vec<ApiPostSummary>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

/// 对应 TS ApiFriendLink
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiFriendLink {
    pub id: i32,
    pub name: String,
    pub description: String,
    pub avatar: String,
    pub url: String,
    pub enabled: bool,
    pub display_order: i32,
}

/// 对应 TS ApiProfileContact
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiProfileContact {
    pub id: i32,
    pub platform: String,
    pub label: String,
    pub href: String,
    pub display_order: i32,
}

/// 对应 TS ApiProfileCard
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiProfileCard {
    pub name: String,
    pub bio: String,
    pub avatar: String,
    pub contacts: Vec<ApiProfileContact>,
}

/// 对应 TS ApiSiteConfig（含 slogan）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiSiteConfig {
    pub site_title: String,
    pub site_subtitle: String,
    pub slogan: String,
    pub copyright_owner: String,
    pub powered_by: String,
    pub icp_record_text: String,
    pub icp_record_url: String,
    pub public_security_record_text: String,
    pub public_security_record_url: String,
    pub friend_link_template: String,
}

/// 对应 TS ApiAboutPayload。
/// JSON 字段（intro_paragraphs/narrative_sections/timeline_events）以 Value 原样透传，
/// 与旧后端 `JSON.parse -> JSON.stringify` 行为一致（preserve_order 保持键序）。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiAboutPayload {
    pub hero_title: String,
    pub hero_subtitle: String,
    pub intro_paragraphs: serde_json::Value,
    pub narrative_sections: serde_json::Value,
    pub timeline_title: String,
    /// 兼容旧后端 bug：timelineLabel 恒等于 timeline_title
    pub timeline_label: String,
    pub timeline_events: serde_json::Value,
}

/// 对应 TS ApiSearchItem
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiSearchItem {
    pub slug: String,
    pub title: String,
    pub summary: String,
    pub tags: Vec<String>,
    pub snippet: String,
    pub published_at: String,
}
