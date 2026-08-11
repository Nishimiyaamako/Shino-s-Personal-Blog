import type { DatabaseContext } from '../db/client';
import type { ApiSearchItem } from '../types/api';

/**
 * 搜索排序权重配置
 * - 文本相关性: 50% - FTS bm25 分数决定基础准度
 * - 发布时间衰减: 25% - 越新的文章得分越高
 * - 内容质量分: 15% - 基于阅读量、点赞数、评论数
 * - 权威性/常青度: 10% - 置顶、精选标记
 */

// 时间衰减参数：3年（约1095天）后时间得分趋近于0
const DECAY_HALF_LIFE_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 质量分计算参数
const QUALITY_WEIGHT_VIEW = 0.4;
const QUALITY_WEIGHT_LIKE = 0.4;
const QUALITY_WEIGHT_COMMENT = 0.2;

interface SearchRow {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string | null;
  tags: string;
  snippet: string | null;
  bm25Score: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

/**
 * 计算时间衰减得分 (0-1)
 * 使用指数衰减公式: score = exp(-ln(2) * days / halfLife)
 */
function calculateTimeDecayScore(publishedAt: string | null): number {
  if (!publishedAt) return 0;

  const publishDate = new Date(publishedAt);
  if (Number.isNaN(publishDate.getTime())) return 0;

  const now = new Date();
  const daysSincePublished = (now.getTime() - publishDate.getTime()) / MS_PER_DAY;

  // 指数衰减: 半衰期1年，3年后得分约0.125
  return Math.exp(-Math.LN2 * daysSincePublished / DECAY_HALF_LIFE_DAYS);
}

/**
 * 计算内容质量分 (0-1)
 * 基于阅读量、点赞数、评论数的归一化得分
 */
function calculateQualityScore(
  viewCount: number,
  likeCount: number,
  commentCount: number,
  maxViewCount: number,
  maxLikeCount: number,
  maxCommentCount: number
): number {
  // 避免除以0
  const normalizedView = maxViewCount > 0 ? viewCount / maxViewCount : 0;
  const normalizedLike = maxLikeCount > 0 ? likeCount / maxLikeCount : 0;
  const normalizedComment = maxCommentCount > 0 ? commentCount / maxCommentCount : 0;

  return (
    normalizedView * QUALITY_WEIGHT_VIEW +
    normalizedLike * QUALITY_WEIGHT_LIKE +
    normalizedComment * QUALITY_WEIGHT_COMMENT
  );
}

/**
 * 计算最终排序得分
 * 权重分配:
 * - 文本相关性: 50%
 * - 时间衰减: 25%
 * - 内容质量: 15%
 * - 权威性: 10%（精选字段废弃后恒为 0，保留权重占位）
 */
function calculateFinalScore(
  bm25Score: number,
  timeDecayScore: number,
  qualityScore: number,
  authorityScore: number
): number {
  // bm25 分数越小表示越匹配，需要反转 (取负值或倒数)
  // 这里使用归一化后的 bm25 分数，假设典型范围在 -10 到 0 之间
  const normalizedBm25 = Math.max(0, Math.min(1, 1 - Math.abs(bm25Score) / 10));

  return (
    normalizedBm25 * 0.5 +
    timeDecayScore * 0.25 +
    qualityScore * 0.15 +
    authorityScore * 0.10
  );
}

export function searchPublishedPosts(
  context: DatabaseContext,
  queryText: string,
  limit = 10
): ApiSearchItem[] {
  const normalizedQuery = queryText.trim();

  if (!normalizedQuery) {
    return [];
  }

  const ftsTokens = normalizedQuery
    .split(/[^\p{L}\p{N}_-]+/u)
    .map((token) => token.trim())
    .filter(Boolean);

  if (!ftsTokens.length) {
    return [];
  }

  const ftsQuery = ftsTokens
    .map((token) => `"${token.replaceAll('"', '""')}"*`)
    .join(' OR ');

  const normalizedLimit = Math.max(1, Math.min(30, Number(limit) || 10));

  try {
    // 首先获取 FTS 匹配结果（snippet 和 bm25 必须在直接查询 FTS 表时使用）
    const ftsRows = context.sqlite
      .query(`
        SELECT
          post_id,
          snippet(posts_search, 1, '<mark>', '</mark>', ' ... ', 18) AS snippet,
          bm25(posts_search) AS bm25Score
        FROM posts_search
        WHERE posts_search MATCH ?
      `)
      .all(ftsQuery) as Array<{ post_id: number; snippet: string | null; bm25Score: number }>;

    if (ftsRows.length === 0) {
      return [];
    }

    // 获取匹配的 post_id 列表
    const postIds = ftsRows.map(r => r.post_id);
    const placeholders = postIds.map(() => '?').join(',');

    // 再关联 posts 表和其他数据
    const rows = context.sqlite
      .query(`
        SELECT
          p.slug,
          p.title,
          p.summary,
          p.published_at AS publishedAt,
          COALESCE(group_concat(t.name), '') AS tags,
          p.view_count AS viewCount,
          p.like_count AS likeCount,
          p.comment_count AS commentCount,
          p.id AS postId
        FROM posts p
        LEFT JOIN post_tags pt ON pt.post_id = p.id
        LEFT JOIN tags t ON t.id = pt.tag_id
        WHERE p.id IN (${placeholders}) AND p.status = 'published'
        GROUP BY p.id
      `)
      .all(...postIds) as Array<SearchRow & { postId: number }>;

    // 合并 FTS 结果
    const snippetMap = new Map(ftsRows.map(r => [r.post_id, { snippet: r.snippet, bm25Score: r.bm25Score }]));
    const rowsWithSnippet = rows.map(row => ({
      ...row,
      snippet: snippetMap.get(row.postId)?.snippet ?? null,
      bm25Score: snippetMap.get(row.postId)?.bm25Score ?? 0
    }));

    if (rowsWithSnippet.length === 0) {
      return [];
    }

    // 计算统计数据的最大值用于归一化
    const maxViewCount = Math.max(...rowsWithSnippet.map((r) => r.viewCount), 1);
    const maxLikeCount = Math.max(...rowsWithSnippet.map((r) => r.likeCount), 1);
    const maxCommentCount = Math.max(...rowsWithSnippet.map((r) => r.commentCount), 1);

    // 计算每篇文章的最终得分并排序
    const scoredRows = rowsWithSnippet.map((row) => {
      const timeDecayScore = calculateTimeDecayScore(row.publishedAt);
      const qualityScore = calculateQualityScore(
        row.viewCount,
        row.likeCount,
        row.commentCount,
        maxViewCount,
        maxLikeCount,
        maxCommentCount
      );
      const authorityScore = 0;
      const finalScore = calculateFinalScore(
        row.bm25Score,
        timeDecayScore,
        qualityScore,
        authorityScore
      );

      return {
        ...row,
        finalScore
      };
    });

    // 按最终得分降序排序，取前 N 条
    scoredRows.sort((a, b) => b.finalScore - a.finalScore);

    return scoredRows.slice(0, normalizedLimit).map((row) => ({
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
      snippet: row.snippet || row.summary,
      publishedAt: row.publishedAt ?? ''
    }));
  } catch (error) {
    // 记录错误日志以便调试
    console.error('FTS search failed, falling back to LIKE query:', error);
    // 降级到简单的 LIKE 查询
    const likeQuery = `%${normalizedQuery}%`;
    const rows = context.sqlite
      .query(`
        SELECT
          p.slug,
          p.title,
          p.summary,
          p.published_at AS publishedAt,
          COALESCE(group_concat(t.name), '') AS tags,
          p.view_count AS viewCount,
          p.like_count AS likeCount,
          p.comment_count AS commentCount
        FROM posts p
        LEFT JOIN post_tags pt ON pt.post_id = p.id
        LEFT JOIN tags t ON t.id = pt.tag_id
        WHERE p.status = 'published'
          AND (
            p.title LIKE ?
            OR p.summary LIKE ?
          )
        GROUP BY p.id
      `)
      .all(likeQuery, likeQuery) as Array<{
        slug: string;
        title: string;
        summary: string;
        publishedAt: string | null;
        tags: string;
        viewCount: number;
        likeCount: number;
        commentCount: number;
      }>;

    if (rows.length === 0) {
      return [];
    }

    // 计算统计数据的最大值
    const maxViewCount = Math.max(...rows.map((r) => r.viewCount), 1);
    const maxLikeCount = Math.max(...rows.map((r) => r.likeCount), 1);
    const maxCommentCount = Math.max(...rows.map((r) => r.commentCount), 1);

    // 降级模式下，文本相关性简化为布尔值（匹配=1，不匹配=0）
    const scoredRows = rows.map((row) => {
      const timeDecayScore = calculateTimeDecayScore(row.publishedAt);
      const qualityScore = calculateQualityScore(
        row.viewCount,
        row.likeCount,
        row.commentCount,
        maxViewCount,
        maxLikeCount,
        maxCommentCount
      );
      const authorityScore = 0;
      // 降级模式：文本相关性权重降低，时间衰减和质量分权重提高
      const finalScore = 0.3 + timeDecayScore * 0.3 + qualityScore * 0.2 + authorityScore * 0.2;

      return {
        ...row,
        finalScore
      };
    });

    scoredRows.sort((a, b) => b.finalScore - a.finalScore);

    return scoredRows.slice(0, normalizedLimit).map((row) => ({
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
      snippet: row.summary,
      publishedAt: row.publishedAt ?? ''
    }));
  }
}
