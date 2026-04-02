import type { DatabaseContext } from '../db/client';
import type { ApiSearchItem } from '../types/api';

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
    .map((token) => `"${token.replaceAll('"', '""')}"`)
    .join(' AND ');

  const normalizedLimit = Math.max(1, Math.min(30, Number(limit) || 10));

  try {
    const rows = context.sqlite
      .query(`
        SELECT
          p.slug,
          p.title,
          p.summary,
          p.published_at AS publishedAt,
          COALESCE(group_concat(t.name), '') AS tags,
          snippet(posts_search, 4, '<mark>', '</mark>', ' ... ', 18) AS snippet,
          bm25(posts_search) AS score
        FROM posts_search
        INNER JOIN posts p ON p.id = posts_search.post_id
        LEFT JOIN post_tags pt ON pt.post_id = p.id
        LEFT JOIN tags t ON t.id = pt.tag_id
        WHERE posts_search MATCH ? AND p.status = 'published'
        GROUP BY p.id
        ORDER BY score ASC, p.published_at DESC
        LIMIT ?
      `)
      .all(ftsQuery, normalizedLimit) as Array<{
        slug: string;
        title: string;
        summary: string;
        publishedAt: string | null;
        tags: string;
        snippet: string | null;
      }>;

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
      snippet: row.snippet || row.summary,
      publishedAt: row.publishedAt ?? ''
    }));
  } catch {
    const likeQuery = `%${normalizedQuery}%`;
    const rows = context.sqlite
      .query(`
        SELECT
          p.slug,
          p.title,
          p.summary,
          p.published_at AS publishedAt,
          COALESCE(group_concat(t.name), '') AS tags
        FROM posts p
        LEFT JOIN post_tags pt ON pt.post_id = p.id
        LEFT JOIN tags t ON t.id = pt.tag_id
        WHERE p.status = 'published'
          AND (
            p.title LIKE ?
            OR p.summary LIKE ?
            OR p.content_markdown LIKE ?
            OR t.name LIKE ?
          )
        GROUP BY p.id
        ORDER BY p.published_at DESC
        LIMIT ?
      `)
      .all(likeQuery, likeQuery, likeQuery, likeQuery, normalizedLimit) as Array<{
        slug: string;
        title: string;
        summary: string;
        publishedAt: string | null;
        tags: string;
      }>;

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
      snippet: row.summary,
      publishedAt: row.publishedAt ?? ''
    }));
  }
}
