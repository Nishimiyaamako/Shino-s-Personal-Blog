use chrono::{DateTime, Utc};
use regex::Regex;
use sqlx::{FromRow, PgPool};

use crate::models::ApiSearchItem;
use crate::services::posts::parse_number;

/// 搜索排序权重（对齐旧 backend/src/services/search.ts）
/// - 文本相关性 50%（旧 FTS5 bm25 归一化 → PG ts_rank 按最大 rank 归一化）
/// - 时间衰减 25%（指数衰减，半衰期 365 天）
/// - 内容质量 15%（view/like/comment 归一化加权 0.4/0.4/0.2）
/// - 权威性 10%（精选废弃后恒为 0，保留占位）
const DECAY_HALF_LIFE_DAYS: f64 = 365.0;
const MS_PER_DAY: f64 = 24.0 * 60.0 * 60.0 * 1000.0;

#[derive(Debug, FromRow)]
struct SearchRow {
    slug: String,
    title: String,
    summary: String,
    published_at: Option<String>,
    view_count: i32,
    like_count: i32,
    comment_count: i32,
    /// 逗号连接的有序标签（string_agg ORDER BY name）
    tags: String,
    /// ts_rank 文本相关性（已 ::float8）
    rank: f64,
    snippet: String,
}

#[derive(Debug, FromRow)]
struct LikeRow {
    slug: String,
    title: String,
    summary: String,
    published_at: Option<String>,
    view_count: i32,
    like_count: i32,
    comment_count: i32,
    tags: String,
}

/// 分词：与旧后端 `query.split(/[^\p{L}\p{N}_-]+/u)` 一致
pub fn tokenize(query: &str) -> Vec<String> {
    static SPLIT_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let re =
        SPLIT_RE.get_or_init(|| Regex::new(r"[^\p{L}\p{N}_-]+").expect("invalid tokenize regex"));
    re.split(query)
        .map(|t| t.trim())
        .filter(|t| !t.is_empty())
        .map(str::to_string)
        .collect()
}

/// 构建 PG tsquery（前缀匹配 + OR）：对应旧 FTS5 `"token"* OR "token2"*`
fn build_tsquery(tokens: &[String]) -> String {
    tokens
        .iter()
        .map(|t| format!("{t}:*"))
        .collect::<Vec<_>>()
        .join(" | ")
}

/// 时间衰减得分：exp(-ln2 * days / halfLife)，与旧 calculateTimeDecayScore 一致
pub fn calculate_time_decay_score(published_at: Option<&str>) -> f64 {
    let Some(ts) = published_at else {
        return 0.0;
    };
    let Ok(dt) = DateTime::parse_from_rfc3339(ts) else {
        return 0.0;
    };
    let days = (Utc::now() - dt.with_timezone(&Utc)).num_milliseconds() as f64 / MS_PER_DAY;
    (-std::f64::consts::LN_2 * days / DECAY_HALF_LIFE_DAYS).exp()
}

/// 内容质量分（0-1）：view/like/comment 相对当前结果集最大值的归一化加权
fn calculate_quality_score(
    view_count: i64,
    like_count: i64,
    comment_count: i64,
    max_view: i64,
    max_like: i64,
    max_comment: i64,
) -> f64 {
    let normalized_view = if max_view > 0 {
        view_count as f64 / max_view as f64
    } else {
        0.0
    };
    let normalized_like = if max_like > 0 {
        like_count as f64 / max_like as f64
    } else {
        0.0
    };
    let normalized_comment = if max_comment > 0 {
        comment_count as f64 / max_comment as f64
    } else {
        0.0
    };

    normalized_view * 0.4 + normalized_like * 0.4 + normalized_comment * 0.2
}

/// 最终得分：50% 文本相关 + 25% 时间衰减 + 15% 质量（权威 10% 恒 0）
fn calculate_final_score(relevance: f64, time_decay: f64, quality: f64) -> f64 {
    relevance * 0.5 + time_decay * 0.25 + quality * 0.15
}

fn to_search_items(rows: Vec<SearchRow>, limit: usize) -> Vec<ApiSearchItem> {
    if rows.is_empty() {
        return vec![];
    }

    let max_rank = rows.iter().map(|r| r.rank).fold(0.0_f64, f64::max);
    let max_view = i64::from(rows.iter().map(|r| r.view_count).max().unwrap_or(0).max(1));
    let max_like = i64::from(rows.iter().map(|r| r.like_count).max().unwrap_or(0).max(1));
    let max_comment = i64::from(
        rows.iter()
            .map(|r| r.comment_count)
            .max()
            .unwrap_or(0)
            .max(1),
    );

    let mut scored: Vec<(f64, SearchRow)> = rows
        .into_iter()
        .map(|row| {
            let relevance = if max_rank > 0.0 {
                (row.rank / max_rank).clamp(0.0, 1.0)
            } else {
                0.0
            };
            let time_decay = calculate_time_decay_score(row.published_at.as_deref());
            let quality = calculate_quality_score(
                i64::from(row.view_count),
                i64::from(row.like_count),
                i64::from(row.comment_count),
                max_view,
                max_like,
                max_comment,
            );
            let score = calculate_final_score(relevance, time_decay, quality);
            (score, row)
        })
        .collect();

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit);

    scored
        .into_iter()
        .map(|(_, row)| ApiSearchItem {
            slug: row.slug,
            title: row.title,
            summary: row.summary.clone(),
            tags: row
                .tags
                .split(',')
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect(),
            snippet: if row.snippet.trim().is_empty() {
                row.summary
            } else {
                row.snippet
            },
            published_at: row.published_at.unwrap_or_default(),
        })
        .collect()
}

/// FTS 主路径：posts_search @@ tsquery + ts_headline 高亮 + ts_rank
async fn search_fts(pool: &PgPool, ts_query: &str) -> Result<Vec<SearchRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT
           p.slug, p.title, p.summary, p.published_at,
           p.view_count, p.like_count, p.comment_count,
           COALESCE((
             SELECT string_agg(t.name, ',' ORDER BY t.name)
             FROM post_tags pt INNER JOIN tags t ON t.id = pt.tag_id
             WHERE pt.post_id = p.id
           ), '') AS tags,
           ts_rank(ps.search_doc, q.query)::float8 AS rank,
           ts_headline('simple', ps.title, q.query,
             'StartSel=<mark>, StopSel=</mark>, MaxWords=18, MinWords=5, MaxFragments=1, FragmentDelimiter= ... ')
             AS snippet
         FROM posts_search ps
         CROSS JOIN to_tsquery('simple', $1) AS q(query)
         INNER JOIN posts p ON p.id = ps.post_id
         WHERE ps.search_doc @@ q.query AND p.status = 'published'",
    )
    .bind(ts_query)
    .fetch_all(pool)
    .await
}

/// LIKE 降级路径：FTS 异常时退化（对应旧后端 catch 分支，公式 0.3/0.3/0.2）
async fn search_like(
    pool: &PgPool,
    normalized_query: &str,
) -> Result<Vec<ApiSearchItem>, sqlx::Error> {
    let like_value = format!("%{normalized_query}%");

    let rows: Vec<LikeRow> = sqlx::query_as(
        "SELECT
           p.slug, p.title, p.summary, p.published_at,
           p.view_count, p.like_count, p.comment_count,
           COALESCE((
             SELECT string_agg(t.name, ',' ORDER BY t.name)
             FROM post_tags pt INNER JOIN tags t ON t.id = pt.tag_id
             WHERE pt.post_id = p.id
           ), '') AS tags
         FROM posts p
         WHERE p.status = 'published' AND (p.title LIKE $1 OR p.summary LIKE $1)
         GROUP BY p.id",
    )
    .bind(&like_value)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(vec![]);
    }

    let max_view = i64::from(rows.iter().map(|r| r.view_count).max().unwrap_or(0).max(1));
    let max_like = i64::from(rows.iter().map(|r| r.like_count).max().unwrap_or(0).max(1));
    let max_comment = i64::from(
        rows.iter()
            .map(|r| r.comment_count)
            .max()
            .unwrap_or(0)
            .max(1),
    );

    let mut scored: Vec<(f64, LikeRow)> = rows
        .into_iter()
        .map(|row| {
            let time_decay = calculate_time_decay_score(row.published_at.as_deref());
            let quality = calculate_quality_score(
                i64::from(row.view_count),
                i64::from(row.like_count),
                i64::from(row.comment_count),
                max_view,
                max_like,
                max_comment,
            );
            // 降级模式：0.3 + 时间 0.3 + 质量 0.2（权威 0.2 恒 0）
            let score = 0.3 + time_decay * 0.3 + quality * 0.2;
            (score, row)
        })
        .collect();

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    Ok(scored
        .into_iter()
        .map(|(_, row)| ApiSearchItem {
            slug: row.slug,
            title: row.title,
            summary: row.summary.clone(),
            tags: row
                .tags
                .split(',')
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect(),
            snippet: row.summary,
            published_at: row.published_at.unwrap_or_default(),
        })
        .collect())
}

/// 全文搜索：GET /api/search（对应 searchPublishedPosts）
/// - 空查询/无有效 token → []
/// - FTS 命中 → 按最终得分排序取前 limit（1..=30，默认 10）
/// - FTS 异常 → LIKE 降级
pub async fn search_published(
    pool: &PgPool,
    query_text: &str,
    limit: Option<&String>,
) -> Result<Vec<ApiSearchItem>, sqlx::Error> {
    let normalized_query = query_text.trim();

    if normalized_query.is_empty() {
        return Ok(vec![]);
    }

    let tokens = tokenize(normalized_query);

    if tokens.is_empty() {
        return Ok(vec![]);
    }

    let normalized_limit = parse_number(limit, 10).clamp(1, 30) as usize;
    let ts_query = build_tsquery(&tokens);

    match search_fts(pool, &ts_query).await {
        Ok(rows) => Ok(to_search_items(rows, normalized_limit)),
        Err(e) => {
            tracing::warn!(error = %e, "FTS search failed, falling back to LIKE query");
            search_like(pool, normalized_query).await
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenize_splits_on_non_alnum() {
        assert_eq!(tokenize("中文标题命中测试"), vec!["中文标题命中测试"]);
        assert_eq!(
            tokenize("keyword-shino-search"),
            vec!["keyword-shino-search"]
        );
        assert_eq!(tokenize("hello world 星尘"), vec!["hello", "world", "星尘"]);
        assert_eq!(tokenize("  a!!b__c--d  "), vec!["a", "b__c--d"]);
        assert_eq!(tokenize(""), Vec::<String>::new());
        assert_eq!(tokenize("!!!"), Vec::<String>::new());
    }

    #[test]
    fn build_tsquery_prefix_or() {
        assert_eq!(build_tsquery(&["a".into(), "b".into()]), "a:* | b:*");
    }

    #[test]
    fn time_decay_zero_for_null_or_invalid() {
        assert_eq!(calculate_time_decay_score(None), 0.0);
        assert_eq!(calculate_time_decay_score(Some("not-a-date")), 0.0);
    }

    #[test]
    fn time_decay_half_life() {
        // 365 天前发布 → 0.5
        let past = (Utc::now() - chrono::Duration::days(365)).to_rfc3339();
        let score = calculate_time_decay_score(Some(&past));
        assert!((score - 0.5).abs() < 0.01, "expected ~0.5, got {score}");
    }

    #[test]
    fn quality_score_normalizes() {
        let score = calculate_quality_score(50, 25, 10, 100, 50, 100);
        // 0.5*0.4 + 0.5*0.4 + 0.1*0.2
        assert!((score - 0.42).abs() < 1e-9);
        // 全 0 计数（max 兜底 1）→ 0
        assert_eq!(calculate_quality_score(0, 0, 0, 1, 1, 1), 0.0);
    }

    #[test]
    fn final_score_weights() {
        // 满分：1*0.5 + 1*0.25 + 1*0.15 = 0.9（权威 0.1 恒 0）
        assert!((calculate_final_score(1.0, 1.0, 1.0) - 0.9).abs() < 1e-9);
    }
}
