use serde::{Deserialize, Serialize};

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
    // 与 FromStr 语义不同（未知值回退 Draft 而非报错），保留既有命名
    #[allow(clippy::should_implement_trait)]
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

impl<'de> Deserialize<'de> for PostStatus {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        match s.as_str() {
            "draft" => Ok(Self::Draft),
            "published" => Ok(Self::Published),
            _ => Err(serde::de::Error::custom("status 必须是 draft 或 published")),
        }
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

// ---------- M2：管理 API ----------

/// 创建文章输入（对应 TS UpsertPostInput）
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertPostInput {
    pub title: String,
    pub slug: String,
    pub date: String,
    pub summary: String,
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub cover_image_url: Option<String>,
    pub content_markdown: String,
    pub status: PostStatus,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// 更新文章输入（对应 TS Partial<UpsertPostInput>）
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePostInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub cover_image_url: Option<String>,
    #[serde(default)]
    pub content_markdown: Option<String>,
    #[serde(default)]
    pub status: Option<PostStatus>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

/// 管理文章列表结果（对应 TS ListAdminPostResult）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListAdminPostResult {
    pub items: Vec<ApiPostDetail>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

/// 媒体引用（对应 TS ApiMediaAsset.references 元素）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaReference {
    pub post_id: i32,
    pub post_title: String,
}

/// 媒体资源（对应 TS ApiMediaAsset）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiMediaAsset {
    pub id: i32,
    pub file_name: String,
    pub mime_type: String,
    pub size: i64,
    pub url: String,
    pub created_at: String,
    pub references: Vec<MediaReference>,
    pub is_orphaned: bool,
}

/// 媒体列表响应（对应 TS ApiMediaListResponse）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiMediaListResponse {
    pub items: Vec<ApiMediaAsset>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub stats: MediaStats,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaStats {
    pub total_count: i64,
    pub total_size: i64,
    pub orphaned_count: i64,
}

/// 上传成功结果（对应 saveImageAsset 返回值）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaUploadResult {
    pub url: String,
    pub file_name: String,
    pub size: i64,
    pub mime_type: String,
}

/// 新建友链输入
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FriendLinkInput {
    pub name: String,
    pub description: String,
    pub avatar: String,
    pub url: String,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub display_order: Option<i64>,
}

/// 更新友链输入
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FriendLinkPatch {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub avatar: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub display_order: Option<i64>,
}

/// 关于页更新输入（对应 updateAbout payload）
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AboutUpdateInput {
    #[serde(default)]
    pub hero_title: Option<String>,
    #[serde(default)]
    pub hero_subtitle: Option<String>,
    #[serde(default)]
    pub intro_paragraphs: Option<serde_json::Value>,
    #[serde(default)]
    pub narrative_sections: Option<serde_json::Value>,
    #[serde(default)]
    pub timeline_title: Option<String>,
    #[serde(default)]
    pub timeline_label: Option<String>,
    #[serde(default)]
    pub timeline_events: Option<serde_json::Value>,
}

/// 名片卡联系方式输入
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileContactInput {
    pub platform: String,
    pub label: String,
    pub href: String,
    #[serde(default)]
    pub display_order: Option<i64>,
}

/// 名片卡更新输入（路由层已做 `body.name ?? ''` 合并，对齐旧路由）
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileUpdateInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub bio: Option<String>,
    #[serde(default)]
    pub avatar: Option<String>,
    #[serde(default)]
    pub contacts: Option<Vec<ProfileContactInput>>,
}

/// 站点配置更新输入（对应 TS Partial<ApiSiteConfig>）
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SiteConfigPatch {
    #[serde(default)]
    pub site_title: Option<String>,
    #[serde(default)]
    pub site_subtitle: Option<String>,
    #[serde(default)]
    pub slogan: Option<String>,
    #[serde(default)]
    pub copyright_owner: Option<String>,
    #[serde(default)]
    pub powered_by: Option<String>,
    #[serde(default)]
    pub icp_record_text: Option<String>,
    #[serde(default)]
    pub icp_record_url: Option<String>,
    #[serde(default)]
    pub public_security_record_text: Option<String>,
    #[serde(default)]
    pub public_security_record_url: Option<String>,
    #[serde(default)]
    pub friend_link_template: Option<String>,
}
