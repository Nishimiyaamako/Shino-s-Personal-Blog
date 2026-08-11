use std::collections::HashMap;

use sqlx::{FromRow, PgPool};

use crate::models::{ApiPostDetail, ApiPostSummary, ListPublishedPostResult, PostStatus};

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
