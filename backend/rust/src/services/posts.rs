use std::collections::HashMap;

use regex::Regex;
use sqlx::{FromRow, PgPool};

use crate::error::ServiceError;
use crate::markdown::render_markdown_to_safe_html;
use crate::models::{
    ApiPostDetail, ApiPostSummary, ListAdminPostResult, ListPublishedPostResult, PostStatus,
    UpdatePostInput, UpsertPostInput, now_iso,
};

const SLUG_REGEXP: &str = r"^[a-z0-9]+(?:-[a-z0-9]+)*$";
const DATE_REGEXP: &str = r"^\d{4}-\d{2}-\d{2}$";
const TAG_REGEXP: &str = r"^[a-z0-9]+(?:-[a-z0-9]+)*$";

fn regex_once(pattern: &str) -> &'static Regex {
    static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    RE.get_or_init(|| Regex::new(pattern).expect("invalid regex"))
}

/// 公开列表返回的最小行
#[derive(Debug, FromRow)]
struct PostSummaryRow {
    id: i32,
    title: String,
    slug: String,
    date: String,
    summary: String,
    theme: Option<String>,
    cover_image_url: Option<String>,
}

/// 详情行（含内容与状态）
#[derive(Debug, FromRow)]
struct PostDetailRow {
    id: i32,
    title: String,
    slug: String,
    date: String,
    summary: String,
    theme: Option<String>,
    cover_image_url: Option<String>,
    content_markdown: String,
    content_html: String,
    status: String,
    published_at: Option<String>,
}

fn to_summary(row: PostSummaryRow, tags: Vec<String>) -> ApiPostSummary {
    ApiPostSummary {
        id: row.id,
        title: row.title,
        slug: row.slug,
        date: row.date,
        theme: row.theme,
        tags,
        summary: row.summary,
        cover_image_url: row.cover_image_url,
    }
}

fn to_detail(row: PostDetailRow, tags: Vec<String>) -> ApiPostDetail {
    ApiPostDetail {
        summary: ApiPostSummary {
            id: row.id,
            title: row.title,
            slug: row.slug,
            date: row.date,
            theme: row.theme,
            tags,
            summary: row.summary,
            cover_image_url: row.cover_image_url,
        },
        content_markdown: row.content_markdown,
        content_html: row.content_html,
        status: PostStatus::from_str(&row.status),
        published_at: row.published_at,
    }
}

/// 读取多篇文章的标签（按名称 ASC，与旧 readTagsByPostIds 一致）
async fn read_tags_by_post_ids(
    pool: &PgPool,
    post_ids: &[i32],
) -> Result<HashMap<i32, Vec<String>>, sqlx::Error> {
    let mut map: HashMap<i32, Vec<String>> = HashMap::new();

    if post_ids.is_empty() {
        return Ok(map);
    }

    let rows: Vec<(i32, String)> = sqlx::query_as(
        "SELECT pt.post_id, t.name
         FROM post_tags pt
         INNER JOIN tags t ON t.id = pt.tag_id
         WHERE pt.post_id = ANY($1)
         ORDER BY t.name ASC",
    )
    .bind(post_ids)
    .fetch_all(pool)
    .await?;

    for (post_id, tag) in rows {
        map.entry(post_id).or_default().push(tag);
    }

    Ok(map)
}

/// 数值型查询参数解析：与 TS `Number(x) || default` 语义一致（非法值回退默认）
pub fn parse_number(value: Option<&String>, default: i64) -> i64 {
    value.and_then(|v| v.parse().ok()).unwrap_or(default)
}

/// 公开文章列表：GET /api/posts
/// 对应 listPublishedPosts：page>=1、pageSize 1..=50、tag 精确匹配（trim+lowercase）
pub async fn list_published(
    pool: &PgPool,
    page: Option<&String>,
    page_size: Option<&String>,
    tag: Option<&String>,
) -> Result<ListPublishedPostResult, sqlx::Error> {
    let page = parse_number(page, 1).max(1);
    let page_size = parse_number(page_size, 20).clamp(1, 50);
    let offset = (page - 1) * page_size;
    let normalized_tag = tag.map(|t| t.trim().to_lowercase()).unwrap_or_default();

    let tag_exists_sql = "AND EXISTS (
        SELECT 1 FROM post_tags pt INNER JOIN tags t ON t.id = pt.tag_id
        WHERE pt.post_id = p.id AND t.name = $1
    )";

    let total: i64 = if normalized_tag.is_empty() {
        sqlx::query_scalar("SELECT COUNT(1) FROM posts p WHERE p.status = 'published'")
            .fetch_one(pool)
            .await?
    } else {
        sqlx::query_scalar(&format!(
            "SELECT COUNT(1) FROM posts p WHERE p.status = 'published' {tag_exists_sql}"
        ))
        .bind(&normalized_tag)
        .fetch_one(pool)
        .await?
    };

    let rows: Vec<PostSummaryRow> = if normalized_tag.is_empty() {
        sqlx::query_as(
            "SELECT p.id, p.title, p.slug, p.date, p.summary, p.theme, p.cover_image_url
             FROM posts p
             WHERE p.status = 'published'
             ORDER BY p.date DESC, p.id DESC
             LIMIT $1 OFFSET $2",
        )
        .bind(page_size)
        .bind(offset)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as(&format!(
            "SELECT p.id, p.title, p.slug, p.date, p.summary, p.theme, p.cover_image_url
             FROM posts p
             WHERE p.status = 'published' {tag_exists_sql}
             ORDER BY p.date DESC, p.id DESC
             LIMIT $2 OFFSET $3"
        ))
        .bind(&normalized_tag)
        .bind(page_size)
        .bind(offset)
        .fetch_all(pool)
        .await?
    };

    let ids: Vec<i32> = rows.iter().map(|r| r.id).collect();
    let tag_map = read_tags_by_post_ids(pool, &ids).await?;

    let items = rows
        .into_iter()
        .map(|row| {
            let id = row.id;
            to_summary(row, tag_map.get(&id).cloned().unwrap_or_default())
        })
        .collect();

    Ok(ListPublishedPostResult {
        items,
        total,
        page,
        page_size,
    })
}

/// 公开文章详情：GET /api/posts/:slug（仅 published；未命中返回 None，路由层 404）
pub async fn get_published_by_slug(
    pool: &PgPool,
    slug: &str,
) -> Result<Option<ApiPostDetail>, sqlx::Error> {
    let row: Option<PostDetailRow> = sqlx::query_as(
        "SELECT p.id, p.title, p.slug, p.date, p.summary, p.theme, p.cover_image_url,
                p.content_markdown, p.content_html, p.status, p.published_at
         FROM posts p
         WHERE p.slug = $1 AND p.status = 'published'
         LIMIT 1",
    )
    .bind(slug)
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        return Ok(None);
    };

    let tags = read_tags_by_post_ids(pool, &[row.id])
        .await?
        .remove(&row.id)
        .unwrap_or_default();

    Ok(Some(to_detail(row, tags)))
}

// ---------- M2：管理 API ----------

/// 读取单篇文章（含草稿；对应 readPostById）
async fn read_post_by_id(
    pool: &PgPool,
    post_id: i32,
) -> Result<Option<PostDetailRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT p.id, p.title, p.slug, p.date, p.summary, p.theme, p.cover_image_url,
                p.content_markdown, p.content_html, p.status, p.published_at
         FROM posts p
         WHERE p.id = $1
         LIMIT 1",
    )
    .bind(post_id)
    .fetch_optional(pool)
    .await
}

/// 标签规范化（对应 normalizeTags：trim+lowercase+正则过滤+去重）
fn normalize_tags(tags: &[String]) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();

    for tag in tags {
        let value = tag.trim().to_lowercase();
        if !regex_once(TAG_REGEXP).is_match(&value) || !seen.insert(value.clone()) {
            continue;
        }
        out.push(value);
    }

    out
}

/// 文章输入校验（对应 assertPostInput）
fn assert_post_input(input: &UpsertPostInput) -> Result<(), ServiceError> {
    if input.title.trim().is_empty() {
        return Err(ServiceError::BadRequest("title 不能为空".into()));
    }
    if !regex_once(SLUG_REGEXP).is_match(&input.slug) {
        return Err(ServiceError::BadRequest(
            "slug 必须是 lower-kebab-case".into(),
        ));
    }
    if !regex_once(DATE_REGEXP).is_match(&input.date) {
        return Err(ServiceError::BadRequest("date 必须是 YYYY-MM-DD".into()));
    }
    if input.summary.trim().is_empty() {
        return Err(ServiceError::BadRequest("summary 不能为空".into()));
    }
    if input.content_markdown.trim().is_empty() {
        return Err(ServiceError::BadRequest("contentMarkdown 不能为空".into()));
    }
    if normalize_tags(&input.tags).is_empty() {
        return Err(ServiceError::BadRequest("至少需要一个有效标签".into()));
    }
    Ok(())
}

/// 同步文章标签（对应 syncPostTags：DELETE 后逐标签 INSERT OR IGNORE）
async fn sync_post_tags(pool: &PgPool, post_id: i32, tags: &[String]) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM post_tags WHERE post_id = $1")
        .bind(post_id)
        .execute(pool)
        .await?;

    let normalized = normalize_tags(tags);

    for tag in &normalized {
        sqlx::query("INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING")
            .bind(tag)
            .execute(pool)
            .await?;

        let tag_id: Option<i32> = sqlx::query_scalar("SELECT id FROM tags WHERE name = $1 LIMIT 1")
            .bind(tag)
            .fetch_optional(pool)
            .await?;

        if let Some(tag_id) = tag_id {
            sqlx::query(
                "INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(post_id)
            .bind(tag_id)
            .execute(pool)
            .await?;
        }
    }

    Ok(())
}

/// 同步搜索索引（对应 syncSearchIndexForPost：仅 published 入库）
async fn sync_search_index_for_post(pool: &PgPool, post_id: i32) -> Result<(), sqlx::Error> {
    let Some(post) = read_post_by_id(pool, post_id).await? else {
        sqlx::query("DELETE FROM posts_search WHERE post_id = $1")
            .bind(post_id)
            .execute(pool)
            .await?;
        return Ok(());
    };

    if post.status != "published" {
        sqlx::query("DELETE FROM posts_search WHERE post_id = $1")
            .bind(post_id)
            .execute(pool)
            .await?;
        return Ok(());
    }

    let tags = read_tags_by_post_ids(pool, &[post_id])
        .await?
        .remove(&post_id)
        .unwrap_or_default();

    sqlx::query(
        "INSERT INTO posts_search (post_id, title, summary, tags, content)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (post_id) DO UPDATE SET
           title = EXCLUDED.title, summary = EXCLUDED.summary,
           tags = EXCLUDED.tags, content = EXCLUDED.content",
    )
    .bind(post_id)
    .bind(&post.title)
    .bind(&post.summary)
    .bind(tags.join(" "))
    .bind(&post.content_markdown)
    .execute(pool)
    .await?;

    Ok(())
}

/// theme 规范化（对应 `input.theme?.trim() ? trim().replace(/\s+/g,' ') : null`）
fn normalize_theme(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.split_whitespace().collect::<Vec<_>>().join(" "))
}

/// 管理文章列表：GET /api/admin/posts（q/status/tag 筛选 + 分页，ORDER BY updated_at DESC）
pub async fn list_admin(
    pool: &PgPool,
    q: Option<&str>,
    status: Option<PostStatus>,
    tag: Option<&str>,
    page: i64,
    page_size: i64,
) -> Result<ListAdminPostResult, ServiceError> {
    let page = page.max(1);
    let page_size = page_size.clamp(1, 500);
    let offset = (page - 1) * page_size;
    let search_query = q.unwrap_or("").trim().to_string();
    let tag_filter = tag.map(|t| t.trim().to_lowercase()).unwrap_or_default();

    // 非法 tag 直接返回空集（对齐 listAdminPosts 提前返回）
    if !tag_filter.is_empty() && !regex_once(TAG_REGEXP).is_match(&tag_filter) {
        return Ok(ListAdminPostResult {
            items: vec![],
            total: 0,
            page,
            page_size,
        });
    }

    // 构造 WHERE（参数占位编号随绑定顺序递增）
    let mut where_sql = String::from("1=1");
    let mut params: Vec<String> = Vec::new();
    let mut idx = 1usize;

    if let Some(s) = status {
        where_sql.push_str(&format!(" AND p.status = ${idx}"));
        params.push(s.as_str().to_string());
        idx += 1;
    }

    if !search_query.is_empty() {
        where_sql.push_str(&format!(
            " AND (p.title LIKE ${idx} OR p.summary LIKE ${idx} OR p.slug LIKE ${idx} OR p.content_markdown LIKE ${idx})"
        ));
        let like_value = format!("%{search_query}%");
        params.extend([
            like_value.clone(),
            like_value.clone(),
            like_value.clone(),
            like_value,
        ]);
        idx += 4;
    }

    if !tag_filter.is_empty() {
        where_sql.push_str(&format!(
            " AND EXISTS (SELECT 1 FROM post_tags pt INNER JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND t.name = ${idx})"
        ));
        params.push(tag_filter);
        idx += 1;
    }

    let total: i64 = {
        let sql = format!("SELECT COUNT(1) FROM posts p WHERE {where_sql}");
        let mut query = sqlx::query_scalar(&sql);
        for p in &params {
            query = query.bind(p);
        }
        query.fetch_one(pool).await?
    };

    let rows: Vec<PostDetailRow> = {
        let sql = format!(
            "SELECT p.id, p.title, p.slug, p.date, p.summary, p.theme, p.cover_image_url,
                    p.content_markdown, p.content_html, p.status, p.published_at
             FROM posts p WHERE {where_sql}
             ORDER BY p.updated_at DESC, p.id DESC
             LIMIT ${idx} OFFSET ${}",
            idx + 1,
        );
        let mut query = sqlx::query_as(&sql);
        for p in &params {
            query = query.bind(p);
        }
        query.bind(page_size).bind(offset).fetch_all(pool).await?
    };

    let ids: Vec<i32> = rows.iter().map(|r| r.id).collect();
    let tag_map = read_tags_by_post_ids(pool, &ids).await?;

    let items = rows
        .into_iter()
        .map(|row| {
            let id = row.id;
            to_detail(row, tag_map.get(&id).cloned().unwrap_or_default())
        })
        .collect();

    Ok(ListAdminPostResult {
        items,
        total,
        page,
        page_size,
    })
}

/// 管理文章详情：GET /api/admin/posts/:id
pub async fn get_admin_by_id(
    pool: &PgPool,
    post_id: i32,
) -> Result<Option<ApiPostDetail>, ServiceError> {
    let Some(row) = read_post_by_id(pool, post_id).await? else {
        return Ok(None);
    };

    let tags = read_tags_by_post_ids(pool, &[post_id])
        .await?
        .remove(&post_id)
        .unwrap_or_default();

    Ok(Some(to_detail(row, tags)))
}

/// 创建文章：POST /api/admin/posts
pub async fn create(pool: &PgPool, input: UpsertPostInput) -> Result<ApiPostDetail, ServiceError> {
    assert_post_input(&input)?;

    let now = now_iso();
    let content_html = render_markdown_to_safe_html(&input.content_markdown);
    let theme = normalize_theme(input.theme.as_deref());
    let cover_image_url = input
        .cover_image_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let published_at = if input.status == PostStatus::Published {
        Some(now.clone())
    } else {
        None
    };

    let existing: Option<i32> = sqlx::query_scalar("SELECT id FROM posts WHERE slug = $1 LIMIT 1")
        .bind(&input.slug)
        .fetch_optional(pool)
        .await?;

    if existing.is_some() {
        return Err(ServiceError::BadRequest("slug 已存在".into()));
    }

    let post_id: i32 = sqlx::query_scalar(
        "INSERT INTO posts (title, slug, date, summary, theme, cover_image_url,
                            content_markdown, content_html, status, created_at, updated_at, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id",
    )
    .bind(input.title.trim())
    .bind(&input.slug)
    .bind(&input.date)
    .bind(input.summary.trim())
    .bind(&theme)
    .bind(&cover_image_url)
    .bind(&input.content_markdown)
    .bind(&content_html)
    .bind(input.status.as_str())
    .bind(&now)
    .bind(&now)
    .bind(&published_at)
    .fetch_one(pool)
    .await?;

    sync_post_tags(pool, post_id, &input.tags).await?;
    sync_search_index_for_post(pool, post_id).await?;

    get_admin_by_id(pool, post_id)
        .await?
        .ok_or_else(|| ServiceError::BadRequest("文章创建失败".into()))
}

/// 更新文章：PATCH /api/admin/posts/:id
pub async fn update(
    pool: &PgPool,
    post_id: i32,
    input: UpdatePostInput,
) -> Result<Option<ApiPostDetail>, ServiceError> {
    let Some(existing) = read_post_by_id(pool, post_id).await? else {
        return Ok(None);
    };

    let next_title = input
        .title
        .as_deref()
        .unwrap_or(&existing.title)
        .trim()
        .to_string();
    let next_slug = input
        .slug
        .as_deref()
        .unwrap_or(&existing.slug)
        .trim()
        .to_string();
    let next_date = input.date.as_deref().unwrap_or(&existing.date).to_string();
    let next_summary = input
        .summary
        .as_deref()
        .unwrap_or(&existing.summary)
        .trim()
        .to_string();
    let next_content_markdown = input
        .content_markdown
        .as_deref()
        .unwrap_or(&existing.content_markdown)
        .to_string();
    let next_content_html = match input.content_markdown.as_deref() {
        Some(md) => render_markdown_to_safe_html(md),
        None => existing.content_html.clone(),
    };
    let next_status = input
        .status
        .unwrap_or_else(|| PostStatus::from_str(&existing.status));
    let next_theme = match input.theme.as_deref() {
        Some(v) => normalize_theme(Some(v)),
        None => existing.theme.clone(),
    };
    let next_cover_image_url = match input.cover_image_url.as_deref() {
        Some(v) => {
            let trimmed = v.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        None => existing.cover_image_url.clone(),
    };

    let existing_tags = read_tags_by_post_ids(pool, &[post_id])
        .await?
        .remove(&post_id)
        .unwrap_or_default();
    let next_tags = match input.tags.as_deref() {
        Some(tags) => normalize_tags(tags),
        None => existing_tags,
    };

    let next_published_at = if next_status == PostStatus::Published {
        Some(existing.published_at.clone().unwrap_or_else(now_iso))
    } else {
        None
    };

    let validation_input = UpsertPostInput {
        title: next_title.clone(),
        slug: next_slug.clone(),
        date: next_date.clone(),
        summary: next_summary.clone(),
        theme: next_theme.clone(),
        cover_image_url: next_cover_image_url.clone(),
        content_markdown: next_content_markdown.clone(),
        status: next_status,
        tags: next_tags.clone(),
    };
    assert_post_input(&validation_input)?;

    let slug_owner: Option<i32> =
        sqlx::query_scalar("SELECT id FROM posts WHERE slug = $1 LIMIT 1")
            .bind(&next_slug)
            .fetch_optional(pool)
            .await?;

    if slug_owner.is_some_and(|owner| owner != post_id) {
        return Err(ServiceError::BadRequest("slug 已存在".into()));
    }

    sqlx::query(
        "UPDATE posts SET title = $1, slug = $2, date = $3, summary = $4, theme = $5,
                cover_image_url = $6, content_markdown = $7, content_html = $8,
                status = $9, updated_at = $10, published_at = $11
         WHERE id = $12",
    )
    .bind(&next_title)
    .bind(&next_slug)
    .bind(&next_date)
    .bind(&next_summary)
    .bind(&next_theme)
    .bind(&next_cover_image_url)
    .bind(&next_content_markdown)
    .bind(&next_content_html)
    .bind(next_status.as_str())
    .bind(now_iso())
    .bind(&next_published_at)
    .bind(post_id)
    .execute(pool)
    .await?;

    sync_post_tags(pool, post_id, &next_tags).await?;
    sync_search_index_for_post(pool, post_id).await?;

    get_admin_by_id(pool, post_id).await
}

/// 删除文章：DELETE /api/admin/posts/:id（post_tags/posts_search 级联）
pub async fn delete(pool: &PgPool, post_id: i32) -> Result<bool, ServiceError> {
    sqlx::query("DELETE FROM posts_search WHERE post_id = $1")
        .bind(post_id)
        .execute(pool)
        .await?;

    let result = sqlx::query("DELETE FROM posts WHERE id = $1")
        .bind(post_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

/// 发布：POST /api/admin/posts/:id/publish
pub async fn publish(pool: &PgPool, post_id: i32) -> Result<Option<ApiPostDetail>, ServiceError> {
    update(
        pool,
        post_id,
        UpdatePostInput {
            status: Some(PostStatus::Published),
            ..Default::default()
        },
    )
    .await
}

/// 取消发布：POST /api/admin/posts/:id/unpublish
pub async fn unpublish(pool: &PgPool, post_id: i32) -> Result<Option<ApiPostDetail>, ServiceError> {
    update(
        pool,
        post_id,
        UpdatePostInput {
            status: Some(PostStatus::Draft),
            ..Default::default()
        },
    )
    .await
}

/// 重建搜索索引：POST /api/admin/posts/rebuild-search-index
pub async fn rebuild_search_index(pool: &PgPool) -> Result<(), ServiceError> {
    sqlx::query("DELETE FROM posts_search")
        .execute(pool)
        .await?;

    let ids: Vec<i32> = sqlx::query_scalar("SELECT id FROM posts WHERE status = 'published'")
        .fetch_all(pool)
        .await?;

    for id in ids {
        sync_search_index_for_post(pool, id).await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_tags_filters_and_dedupes() {
        let tags = vec![
            " Rust ".to_string(),
            "rust".to_string(),
            "Web-Dev".to_string(),
            "bad tag!".to_string(),
            "".to_string(),
        ];
        let out = normalize_tags(&tags);
        assert_eq!(out, vec!["rust".to_string(), "web-dev".to_string()]);
    }

    #[test]
    fn normalize_theme_collapses_whitespace() {
        assert_eq!(normalize_theme(Some("  a   b  ")), Some("a b".to_string()));
        assert_eq!(normalize_theme(Some("   ")), None);
        assert_eq!(normalize_theme(None), None);
    }

    #[test]
    fn assert_post_input_validation() {
        let ok = UpsertPostInput {
            title: "T".into(),
            slug: "my-post".into(),
            date: "2026-04-01".into(),
            summary: "S".into(),
            theme: None,
            cover_image_url: None,
            content_markdown: "# M".into(),
            status: PostStatus::Draft,
            tags: vec!["t1".into()],
        };
        assert!(assert_post_input(&ok).is_ok());

        let mut bad = ok.clone();
        bad.title = "  ".into();
        assert_eq!(
            assert_post_input(&bad).unwrap_err().to_string(),
            "title 不能为空"
        );

        bad = ok.clone();
        bad.slug = "Bad Slug".into();
        assert!(assert_post_input(&bad).is_err());

        bad = ok.clone();
        bad.date = "2026/04/01".into();
        assert!(assert_post_input(&bad).is_err());

        bad = ok.clone();
        bad.tags = vec!["invalid tag".into()];
        assert!(assert_post_input(&bad).is_err());
    }
}
