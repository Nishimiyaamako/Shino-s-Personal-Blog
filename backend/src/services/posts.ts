import type { DatabaseContext } from '../db/client';
import { removePostSearchIndex, upsertPostSearchIndex } from '../db/search-index';
import type { ApiPostDetail, ApiPostSummary, PostStatus } from '../types/api';
import { renderMarkdownToSafeHtml } from './markdown';

const SLUG_REGEXP = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_REGEXP = /^\d{4}-\d{2}-\d{2}$/;
const TAG_REGEXP = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ListPublishedPostOptions {
  page?: number;
  pageSize?: number;
  tag?: string;
}

export interface ListPublishedPostResult {
  items: ApiPostSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpsertPostInput {
  title: string;
  slug: string;
  date: string;
  summary: string;
  theme?: string;
  coverImageUrl?: string;
  contentMarkdown: string;
  status: PostStatus;
  tags: string[];
}

export interface AdminPostRecord extends ApiPostDetail {}

export interface ListAdminPostOptions {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: PostStatus | 'all';
  tag?: string;
}

export interface ListAdminPostResult {
  items: AdminPostRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface PostRow {
  id: number;
  title: string;
  slug: string;
  date: string;
  summary: string;
  theme: string | null;
  coverImageUrl: string | null;
  contentMarkdown: string;
  contentHtml: string;
  status: PostStatus;
  publishedAt: string | null;
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function normalizeTags(tags: string[]): string[] {
  const normalizedSet = new Set<string>();

  for (const tag of tags) {
    const value = normalizeTag(tag);

    if (!TAG_REGEXP.test(value)) {
      continue;
    }

    normalizedSet.add(value);
  }

  return Array.from(normalizedSet);
}

function assertPostInput(input: UpsertPostInput): void {
  if (!input.title.trim()) {
    throw new Error('title 不能为空');
  }

  if (!SLUG_REGEXP.test(input.slug)) {
    throw new Error('slug 必须是 lower-kebab-case');
  }

  if (!DATE_REGEXP.test(input.date)) {
    throw new Error('date 必须是 YYYY-MM-DD');
  }

  if (!input.summary.trim()) {
    throw new Error('summary 不能为空');
  }

  if (!input.contentMarkdown.trim()) {
    throw new Error('contentMarkdown 不能为空');
  }

  const normalizedTags = normalizeTags(input.tags);

  if (!normalizedTags.length) {
    throw new Error('至少需要一个有效标签');
  }
}

function toSummary(row: PostRow, tags: string[]): ApiPostSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    date: row.date,
    theme: row.theme ?? undefined,
    tags,
    summary: row.summary,
    coverImageUrl: row.coverImageUrl ?? undefined
  };
}

function toDetail(row: PostRow, tags: string[]): AdminPostRecord {
  return {
    ...toSummary(row, tags),
    contentMarkdown: row.contentMarkdown,
    contentHtml: row.contentHtml,
    status: row.status,
    publishedAt: row.publishedAt ?? undefined
  };
}

function readTagsByPostIds(context: DatabaseContext, postIds: number[]): Map<number, string[]> {
  const result = new Map<number, string[]>();

  if (!postIds.length) {
    return result;
  }

  const placeholders = postIds.map(() => '?').join(', ');
  const sql = `
    SELECT pt.post_id AS postId, t.name AS tag
    FROM post_tags pt
    INNER JOIN tags t ON t.id = pt.tag_id
    WHERE pt.post_id IN (${placeholders})
    ORDER BY t.name ASC
  `;

  const rows = context.sqlite.query(sql).all(...postIds) as Array<{ postId: number; tag: string }>;

  for (const row of rows) {
    const current = result.get(row.postId) ?? [];
    current.push(row.tag);
    result.set(row.postId, current);
  }

  return result;
}

function readPostById(context: DatabaseContext, postId: number): PostRow | null {
  const row = context.sqlite
    .query(`
      SELECT
        p.id,
        p.title,
        p.slug,
        p.date,
        p.summary,
        p.theme,
        p.cover_image_url AS coverImageUrl,
        p.content_markdown AS contentMarkdown,
        p.content_html AS contentHtml,
        p.status,
        p.published_at AS publishedAt
      FROM posts p
      WHERE p.id = ?
      LIMIT 1
    `)
    .get(postId) as PostRow | null;

  return row;
}

function syncPostTags(context: DatabaseContext, postId: number, tags: string[]): string[] {
  const normalizedTags = normalizeTags(tags);

  context.sqlite.query('DELETE FROM post_tags WHERE post_id = ?').run(postId);

  for (const tag of normalizedTags) {
    context.sqlite.query('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tag);

    const tagRow = context.sqlite.query('SELECT id FROM tags WHERE name = ? LIMIT 1').get(tag) as { id: number } | null;

    if (!tagRow) {
      continue;
    }

    context.sqlite
      .query('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)')
      .run(postId, tagRow.id);
  }

  return normalizedTags;
}

function syncSearchIndexForPost(context: DatabaseContext, postId: number): void {
  const post = readPostById(context, postId);

  if (!post) {
    removePostSearchIndex(context.sqlite, postId);
    return;
  }

  if (post.status !== 'published') {
    removePostSearchIndex(context.sqlite, postId);
    return;
  }

  const tags = readTagsByPostIds(context, [postId]).get(postId) ?? [];

  upsertPostSearchIndex(context.sqlite, {
    postId,
    title: post.title,
    summary: post.summary,
    tags: tags.join(' '),
    content: post.contentMarkdown
  });
}

export function listPublishedPosts(
  context: DatabaseContext,
  options: ListPublishedPostOptions = {}
): ListPublishedPostResult {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(options.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const normalizedTag = options.tag ? normalizeTag(options.tag) : '';

  const params: Array<string | number> = [];
  const whereParts = ["p.status = 'published'"];

  if (normalizedTag) {
    whereParts.push(`
      EXISTS (
        SELECT 1
        FROM post_tags pt
        INNER JOIN tags t ON t.id = pt.tag_id
        WHERE pt.post_id = p.id AND t.name = ?
      )
    `);
    params.push(normalizedTag);
  }

  const whereSql = whereParts.join(' AND ');

  const totalRow = context.sqlite
    .query(`SELECT COUNT(1) AS count FROM posts p WHERE ${whereSql}`)
    .get(...params) as { count: number };

  const postRows = context.sqlite
    .query(`
      SELECT
        p.id,
        p.title,
        p.slug,
        p.date,
        p.summary,
        p.theme,
        p.cover_image_url AS coverImageUrl,
        p.content_markdown AS contentMarkdown,
        p.content_html AS contentHtml,
        p.status,
        p.published_at AS publishedAt
      FROM posts p
      WHERE ${whereSql}
      ORDER BY p.date DESC, p.id DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params, pageSize, offset) as PostRow[];

  const tagMap = readTagsByPostIds(
    context,
    postRows.map((row) => row.id)
  );

  return {
    items: postRows.map((row) => toSummary(row, tagMap.get(row.id) ?? [])),
    total: totalRow.count,
    page,
    pageSize
  };
}

export function getPublishedPostBySlug(context: DatabaseContext, slug: string): ApiPostDetail | null {
  const row = context.sqlite
    .query(`
      SELECT
        p.id,
        p.title,
        p.slug,
        p.date,
        p.summary,
        p.theme,
        p.cover_image_url AS coverImageUrl,
        p.content_markdown AS contentMarkdown,
        p.content_html AS contentHtml,
        p.status,
        p.published_at AS publishedAt
      FROM posts p
      WHERE p.slug = ? AND p.status = 'published'
      LIMIT 1
    `)
    .get(slug) as PostRow | null;

  if (!row) {
    return null;
  }

  const tags = readTagsByPostIds(context, [row.id]).get(row.id) ?? [];
  return toDetail(row, tags);
}

export function listAdminPosts(
  context: DatabaseContext,
  options: ListAdminPostOptions = {}
): ListAdminPostResult {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(options.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const searchQuery = options.q?.trim() ?? '';
  const statusFilter = options.status === 'draft' || options.status === 'published' ? options.status : null;
  const tagFilter = options.tag?.trim() ? normalizeTag(options.tag) : '';

  if (tagFilter && !TAG_REGEXP.test(tagFilter)) {
    return {
      items: [],
      total: 0,
      page,
      pageSize
    };
  }

  const whereParts: string[] = [];
  const params: Array<string | number> = [];

  if (statusFilter) {
    whereParts.push('p.status = ?');
    params.push(statusFilter);
  }

  if (searchQuery) {
    whereParts.push(`
      (
        p.title LIKE ?
        OR p.summary LIKE ?
        OR p.slug LIKE ?
        OR p.content_markdown LIKE ?
      )
    `);
    const likeValue = `%${searchQuery}%`;
    params.push(likeValue, likeValue, likeValue, likeValue);
  }

  if (tagFilter) {
    whereParts.push(`
      EXISTS (
        SELECT 1
        FROM post_tags pt
        INNER JOIN tags t ON t.id = pt.tag_id
        WHERE pt.post_id = p.id AND t.name = ?
      )
    `);
    params.push(tagFilter);
  }

  const whereSql = whereParts.length ? whereParts.join(' AND ') : '1=1';
  const totalRow = context.sqlite
    .query(`SELECT COUNT(1) AS count FROM posts p WHERE ${whereSql}`)
    .get(...params) as { count: number };

  const rows = context.sqlite
    .query(`
      SELECT
        p.id,
        p.title,
        p.slug,
        p.date,
        p.summary,
        p.theme,
        p.cover_image_url AS coverImageUrl,
        p.content_markdown AS contentMarkdown,
        p.content_html AS contentHtml,
        p.status,
        p.published_at AS publishedAt
      FROM posts p
      WHERE ${whereSql}
      ORDER BY p.updated_at DESC, p.id DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params, pageSize, offset) as PostRow[];

  const tagMap = readTagsByPostIds(
    context,
    rows.map((row) => row.id)
  );

  return {
    items: rows.map((row) => toDetail(row, tagMap.get(row.id) ?? [])),
    total: totalRow.count,
    page,
    pageSize
  };
}

export function getAdminPostById(context: DatabaseContext, postId: number): AdminPostRecord | null {
  const row = readPostById(context, postId);

  if (!row) {
    return null;
  }

  const tags = readTagsByPostIds(context, [postId]).get(postId) ?? [];
  return toDetail(row, tags);
}

export function createPost(context: DatabaseContext, input: UpsertPostInput): AdminPostRecord {
  assertPostInput(input);

  const now = new Date().toISOString();
  const normalizedTags = normalizeTags(input.tags);
  const contentHtml = renderMarkdownToSafeHtml(input.contentMarkdown);
  const normalizedTheme = input.theme?.trim() ? input.theme.trim().replace(/\s+/g, ' ') : null;
  const publishedAt = input.status === 'published' ? now : null;

  const existingSlug = context.sqlite.query('SELECT id FROM posts WHERE slug = ? LIMIT 1').get(input.slug) as {
    id: number;
  } | null;

  if (existingSlug) {
    throw new Error('slug 已存在');
  }

  const insertResult = context.sqlite
    .query(`
      INSERT INTO posts (
        title,
        slug,
        date,
        summary,
        theme,
        cover_image_url,
        content_markdown,
        content_html,
        status,
        created_at,
        updated_at,
        published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      input.title.trim(),
      input.slug,
      input.date,
      input.summary.trim(),
      normalizedTheme,
      input.coverImageUrl?.trim() || null,
      input.contentMarkdown,
      contentHtml,
      input.status,
      now,
      now,
      publishedAt
    );

  const postId = Number(insertResult.lastInsertRowid);
  syncPostTags(context, postId, normalizedTags);
  syncSearchIndexForPost(context, postId);

  const created = getAdminPostById(context, postId);

  if (!created) {
    throw new Error('文章创建失败');
  }

  return created;
}

export function updatePost(
  context: DatabaseContext,
  postId: number,
  input: Partial<UpsertPostInput>
): AdminPostRecord | null {
  const existing = readPostById(context, postId);

  if (!existing) {
    return null;
  }

  const nextSlug = (input.slug ?? existing.slug).trim();
  const nextTitle = (input.title ?? existing.title).trim();
  const nextDate = input.date ?? existing.date;
  const nextSummary = (input.summary ?? existing.summary).trim();
  const nextContentMarkdown = input.contentMarkdown ?? existing.contentMarkdown;
  const nextContentHtml =
    input.contentMarkdown !== undefined
      ? renderMarkdownToSafeHtml(nextContentMarkdown)
      : existing.contentHtml;
  const nextStatus = input.status ?? existing.status;
  const nextTheme =
    input.theme === undefined
      ? existing.theme
      : input.theme.trim()
        ? input.theme.trim().replace(/\s+/g, ' ')
        : null;
  const nextCoverImageUrl =
    input.coverImageUrl === undefined
      ? existing.coverImageUrl
      : input.coverImageUrl.trim()
        ? input.coverImageUrl.trim()
        : null;

  const existingTags = readTagsByPostIds(context, [postId]).get(postId) ?? [];
  const nextTags = input.tags ? normalizeTags(input.tags) : existingTags;

  const nextPublishedAt =
    nextStatus === 'published'
      ? existing.publishedAt ?? new Date().toISOString()
      : null;

  const validationInput: UpsertPostInput = {
    title: nextTitle,
    slug: nextSlug,
    date: nextDate,
    summary: nextSummary,
    theme: nextTheme ?? undefined,
    coverImageUrl: nextCoverImageUrl ?? undefined,
    contentMarkdown: nextContentMarkdown,
    status: nextStatus,
    tags: nextTags
  };

  assertPostInput(validationInput);

  const slugOwner = context.sqlite.query('SELECT id FROM posts WHERE slug = ? LIMIT 1').get(nextSlug) as {
    id: number;
  } | null;

  if (slugOwner && slugOwner.id !== postId) {
    throw new Error('slug 已存在');
  }

  context.sqlite
    .query(`
      UPDATE posts
      SET
        title = ?,
        slug = ?,
        date = ?,
        summary = ?,
        theme = ?,
        cover_image_url = ?,
        content_markdown = ?,
        content_html = ?,
        status = ?,
        updated_at = ?,
        published_at = ?
      WHERE id = ?
    `)
    .run(
      nextTitle,
      nextSlug,
      nextDate,
      nextSummary,
      nextTheme,
      nextCoverImageUrl,
      nextContentMarkdown,
      nextContentHtml,
      nextStatus,
      new Date().toISOString(),
      nextPublishedAt,
      postId
    );

  syncPostTags(context, postId, nextTags);
  syncSearchIndexForPost(context, postId);

  return getAdminPostById(context, postId);
}

export function deletePost(context: DatabaseContext, postId: number): boolean {
  removePostSearchIndex(context.sqlite, postId);
  const result = context.sqlite.query('DELETE FROM posts WHERE id = ?').run(postId);
  return result.changes > 0;
}

export function publishPost(context: DatabaseContext, postId: number): AdminPostRecord | null {
  const updated = updatePost(context, postId, { status: 'published' });
  return updated;
}

export function unpublishPost(context: DatabaseContext, postId: number): AdminPostRecord | null {
  const updated = updatePost(context, postId, {
    status: 'draft'
  });

  return updated;
}

export function rebuildSearchIndex(context: DatabaseContext): void {
  context.sqlite.exec('DELETE FROM posts_search');

  const rows = context.sqlite
    .query(`
      SELECT p.id
      FROM posts p
      WHERE p.status = 'published'
    `)
    .all() as Array<{ id: number }>;

  for (const row of rows) {
    syncSearchIndexForPost(context, row.id);
  }
}
