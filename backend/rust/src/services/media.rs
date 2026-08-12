//! 媒体资源服务：图片上传 + 列表（含孤立检测）+ 删除。
//! 对齐 backend/src/services/media.ts：
//! - MIME 白名单 png/jpeg/webp/gif/svg，大小上限 5MB
//! - 文件名 `${Date.now()}-${uuid}${ext}`，存 UPLOADS_ROOT/images/
//! - 引用检测：posts.cover_image_url + content_markdown 内图片链接

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use regex::Regex;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::ServiceError;
use crate::models::{
    ApiMediaAsset, ApiMediaListResponse, MediaReference, MediaStats, MediaUploadResult, now_iso,
};

const IMAGE_MIME_TO_EXT: [(&str, &str); 5] = [
    ("image/png", ".png"),
    ("image/jpeg", ".jpg"),
    ("image/webp", ".webp"),
    ("image/gif", ".gif"),
    ("image/svg+xml", ".svg"),
];

pub const MAX_IMAGE_SIZE: i64 = 5 * 1024 * 1024;

/// 上传图片：POST /api/admin/uploads/image
/// 对齐 saveImageAsset：MIME 校验 → 大小校验 → 写盘 → 入库
pub async fn save_image_asset(
    pool: &PgPool,
    uploads_root: &str,
    original_name: &str,
    mime_type: &str,
    data: &[u8],
) -> Result<MediaUploadResult, ServiceError> {
    let ext_from_mime = IMAGE_MIME_TO_EXT
        .iter()
        .find(|(m, _)| *m == mime_type)
        .map(|(_, e)| *e)
        .ok_or_else(|| ServiceError::BadRequest("仅支持 png/jpeg/webp/gif/svg 图片".into()))?;

    let size = data.len() as i64;
    if size > MAX_IMAGE_SIZE {
        return Err(ServiceError::BadRequest("图片大小不能超过 5MB".into()));
    }

    let original_ext = Path::new(original_name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .filter(|e| !e.is_empty())
        .map(|e| format!(".{e}"))
        .unwrap_or_else(|| ext_from_mime.to_string());

    let file_name = format!(
        "{}-{}{original_ext}",
        chrono::Utc::now().timestamp_millis(),
        Uuid::new_v4()
    );
    let dir = PathBuf::from(uploads_root).join("images");
    let output_path = dir.join(&file_name);

    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| ServiceError::BadRequest(format!("创建上传目录失败: {e}")))?;
    tokio::fs::write(&output_path, data)
        .await
        .map_err(|e| ServiceError::BadRequest(format!("写入文件失败: {e}")))?;

    let url = format!("/uploads/images/{file_name}");

    sqlx::query(
        "INSERT INTO media_assets (file_name, mime_type, size, url, created_at)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(&file_name)
    .bind(mime_type)
    .bind(size)
    .bind(&url)
    .bind(now_iso())
    .execute(pool)
    .await?;

    Ok(MediaUploadResult {
        url,
        file_name,
        size,
        mime_type: mime_type.to_string(),
    })
}

/// 文章引用映射（对应 buildPostReferenceMap）：cover_image_url + markdown 图片链接
fn build_post_reference_map(posts: Vec<PostRefRow>) -> HashMap<String, Vec<MediaReference>> {
    static IMG_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let img_re =
        IMG_RE.get_or_init(|| Regex::new(r"!\[.*?\]\(([^)\s]+)\)").expect("invalid img regex"));

    let mut map: HashMap<String, Vec<MediaReference>> = HashMap::new();

    for post in posts {
        if let Some(cover) = post.cover_image_url.filter(|c| !c.is_empty()) {
            map.entry(cover).or_default().push(MediaReference {
                post_id: post.id,
                post_title: post.title.clone(),
            });
        }

        if !post.content_markdown.is_empty() {
            for cap in img_re.captures_iter(&post.content_markdown) {
                if let Some(url) = cap.get(1) {
                    let url = url.as_str().to_string();
                    let refs = map.entry(url).or_default();
                    if !refs.iter().any(|r| r.post_id == post.id) {
                        refs.push(MediaReference {
                            post_id: post.id,
                            post_title: post.title.clone(),
                        });
                    }
                }
            }
        }
    }

    map
}

#[derive(sqlx::FromRow)]
struct PostRefRow {
    id: i32,
    title: String,
    cover_image_url: Option<String>,
    content_markdown: String,
}

#[derive(sqlx::FromRow)]
struct MediaRow {
    id: i32,
    file_name: String,
    mime_type: String,
    /// schema 中 size 为 INTEGER (INT4)
    size: i32,
    url: String,
    created_at: String,
}

/// 媒体列表：GET /api/admin/media（page/pageSize/sort/order/filter）
pub async fn list_media_assets(
    pool: &PgPool,
    page: i64,
    page_size: i64,
    sort: &str,
    order: &str,
    filter: &str,
) -> Result<ApiMediaListResponse, ServiceError> {
    let page = page.max(1);
    let page_size = page_size.clamp(1, 100);
    let offset = (page - 1) * page_size;

    // sort/order/filter 已在路由层白名单化，此处再兜底一次防注入
    let sort_col = if sort == "size" { "size" } else { "created_at" };
    let order_sql = if order == "ASC" { "ASC" } else { "DESC" };

    let posts: Vec<PostRefRow> = sqlx::query_as(
        "SELECT id, title, cover_image_url, content_markdown
         FROM posts WHERE status IN ('draft', 'published')",
    )
    .fetch_all(pool)
    .await?;

    let ref_map = build_post_reference_map(posts);
    let referenced_urls: std::collections::HashSet<String> = ref_map.keys().cloned().collect();

    let stats: (i64, i64) =
        sqlx::query_as("SELECT COUNT(1), COALESCE(SUM(size), 0) FROM media_assets")
            .fetch_one(pool)
            .await?;

    let orphaned_count: i64 = if referenced_urls.is_empty() {
        stats.0
    } else {
        let all_urls: Vec<String> = sqlx::query_scalar("SELECT url FROM media_assets")
            .fetch_all(pool)
            .await?;
        all_urls
            .iter()
            .filter(|url| !referenced_urls.contains(*url))
            .count() as i64
    };

    // 按 filter 取目标 url 集合
    let target_urls: Vec<String> = match filter {
        "orphaned" => {
            let all_urls: Vec<String> = sqlx::query_scalar("SELECT url FROM media_assets")
                .fetch_all(pool)
                .await?;
            all_urls
                .into_iter()
                .filter(|url| !referenced_urls.contains(url))
                .collect()
        }
        "referenced" => referenced_urls.iter().cloned().collect(),
        _ => vec![], // all：无需过滤
    };

    let rows: Vec<MediaRow> = if filter == "all" {
        let sql = format!(
            "SELECT id, file_name, mime_type, size, url, created_at
             FROM media_assets ORDER BY {sort_col} {order_sql} LIMIT $1 OFFSET $2"
        );
        sqlx::query_as(&sql)
            .bind(page_size)
            .bind(offset)
            .fetch_all(pool)
            .await?
    } else if target_urls.is_empty() {
        vec![]
    } else {
        let sql = format!(
            "SELECT id, file_name, mime_type, size, url, created_at
             FROM media_assets WHERE url = ANY($1)
             ORDER BY {sort_col} {order_sql} LIMIT $2 OFFSET $3"
        );
        sqlx::query_as(&sql)
            .bind(&target_urls)
            .bind(page_size)
            .bind(offset)
            .fetch_all(pool)
            .await?
    };

    let items: Vec<ApiMediaAsset> = rows
        .into_iter()
        .map(|row| {
            let references = ref_map.get(&row.url).cloned().unwrap_or_default();
            let is_orphaned = references.is_empty();
            ApiMediaAsset {
                id: row.id,
                file_name: row.file_name,
                mime_type: row.mime_type,
                size: i64::from(row.size),
                url: row.url,
                created_at: row.created_at,
                references,
                is_orphaned,
            }
        })
        .collect();

    let total = match filter {
        "orphaned" => orphaned_count,
        "referenced" => stats.0 - orphaned_count,
        _ => stats.0,
    };

    Ok(ApiMediaListResponse {
        items,
        total,
        page,
        page_size,
        stats: MediaStats {
            total_count: stats.0,
            total_size: stats.1,
            orphaned_count,
        },
    })
}

/// 删除媒体：DELETE /api/admin/media/:id
/// 对齐 deleteMediaAsset：文件删除失败忽略，DB 记录删除；记录不存在 → 400
pub async fn delete_media_asset(
    pool: &PgPool,
    uploads_root: &str,
    id: i32,
) -> Result<(), ServiceError> {
    let url: Option<String> = sqlx::query_scalar("SELECT url FROM media_assets WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?;

    let Some(url) = url else {
        return Err(ServiceError::BadRequest("文件记录不存在".into()));
    };

    let file_name = url.replace("/uploads/images/", "");
    let file_path = PathBuf::from(uploads_root).join("images").join(&file_name);

    // 磁盘文件可能已不存在，忽略删除错误（对齐旧实现）
    let _ = tokio::fs::remove_file(file_path).await;

    sqlx::query("DELETE FROM media_assets WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}
