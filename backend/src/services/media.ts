import { mkdirSync, unlinkSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ENV } from '../config/env';
import type { DatabaseContext } from '../db/client';
import type { ApiMediaAsset, ApiMediaListResponse } from '../types/api';

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg'
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export async function saveImageAsset(
  context: DatabaseContext,
  file: File
): Promise<{ url: string; fileName: string; size: number; mimeType: string }> {
  const mimeType = file.type;

  if (!IMAGE_MIME_TO_EXT[mimeType]) {
    throw new Error('仅支持 png/jpeg/webp/gif/svg 图片');
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('图片大小不能超过 5MB');
  }

  const originalExt = extname(file.name).toLowerCase();
  const extension = originalExt || IMAGE_MIME_TO_EXT[mimeType];
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const outputDir = resolve(ENV.uploadsRoot, 'images');
  const outputPath = resolve(outputDir, fileName);
  const url = `/uploads/images/${fileName}`;

  mkdirSync(outputDir, { recursive: true });

  await Bun.write(outputPath, await file.arrayBuffer());

  context.sqlite
    .query(`
      INSERT INTO media_assets (file_name, mime_type, size, url, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(fileName, mimeType, file.size, url, new Date().toISOString());

  return {
    url,
    fileName,
    size: file.size,
    mimeType
  };
}

function buildPostReferenceMap(context: DatabaseContext): Map<string, Array<{ postId: number; postTitle: string }>> {
  const map = new Map<string, Array<{ postId: number; postTitle: string }>>();

  const posts = context.sqlite
    .query(`SELECT id, title, cover_image_url, content_markdown FROM posts WHERE status IN ('draft', 'published')`)
    .all() as Array<{ id: number; title: string; cover_image_url: string | null; content_markdown: string }>;

  for (const post of posts) {
    const ref: { postId: number; postTitle: string } = { postId: post.id, postTitle: post.title };

    if (post.cover_image_url) {
      const existing = map.get(post.cover_image_url) || [];
      existing.push(ref);
      map.set(post.cover_image_url, existing);
    }

    if (post.content_markdown) {
      const imgRegex = /!\[.*?\]\(([^)\s]+)\)/g;
      let match: RegExpExecArray | null;
      while ((match = imgRegex.exec(post.content_markdown)) !== null) {
        const url = match[1];
        const existing = map.get(url) || [];
        if (!existing.some((e) => e.postId === ref.postId)) {
          existing.push(ref);
          map.set(url, existing);
        }
      }
    }
  }

  return map;
}

export interface MediaListOptions {
  page: number;
  pageSize: number;
  sort: 'created_at' | 'size';
  order: 'ASC' | 'DESC';
  filter: 'all' | 'referenced' | 'orphaned';
}

export function listMediaAssets(context: DatabaseContext, options: MediaListOptions): ApiMediaListResponse {
  const { page, pageSize, sort, order, filter } = options;

  const refMap = buildPostReferenceMap(context);

  const statsRow = context.sqlite
    .query(`SELECT COUNT(*) AS total_count, COALESCE(SUM(size), 0) AS total_size FROM media_assets`)
    .get() as { total_count: number; total_size: number };

  const referencedUrls = new Set(refMap.keys());

  let orphanedCount: number;
  if (referencedUrls.size === 0) {
    orphanedCount = statsRow.total_count;
  } else {
    const allUrls = context.sqlite
      .query(`SELECT url FROM media_assets`)
      .all() as Array<{ url: string }>;
    orphanedCount = allUrls.filter((r) => !referencedUrls.has(r.url)).length;
  }

  let rows: Array<{
    id: number;
    file_name: string;
    mime_type: string;
    size: number;
    url: string;
    created_at: string;
  }>;

  const offset = (page - 1) * pageSize;
  const sortCol = sort === 'size' ? 'size' : 'created_at';

  if (filter === 'all') {
    rows = context.sqlite
      .query(`SELECT id, file_name, mime_type, size, url, created_at FROM media_assets ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`)
      .all(pageSize, offset) as typeof rows;
  } else if (filter === 'orphaned') {
    const orphanedUrls = (context.sqlite.query(`SELECT url FROM media_assets`).all() as Array<{ url: string }>)
      .filter((r) => !referencedUrls.has(r.url))
      .map((r) => r.url);

    if (orphanedUrls.length === 0) {
      rows = [];
    } else {
      const placeholders = orphanedUrls.map(() => '?').join(',');
      rows = context.sqlite
        .query(`SELECT id, file_name, mime_type, size, url, created_at FROM media_assets WHERE url IN (${placeholders}) ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`)
        .all(...orphanedUrls, pageSize, offset) as typeof rows;
    }
  } else {
    if (referencedUrls.size === 0) {
      rows = [];
    } else {
      const placeholders = Array.from(referencedUrls).map(() => '?').join(',');
      rows = context.sqlite
        .query(`SELECT id, file_name, mime_type, size, url, created_at FROM media_assets WHERE url IN (${placeholders}) ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`)
        .all(...Array.from(referencedUrls), pageSize, offset) as typeof rows;
    }
  }

  const items: ApiMediaAsset[] = rows.map((row) => {
    const references = refMap.get(row.url) || [];
    return {
      id: row.id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      size: row.size,
      url: row.url,
      createdAt: row.created_at,
      references,
      isOrphaned: references.length === 0
    };
  });

  const total = filter === 'all' ? statsRow.total_count : filter === 'orphaned' ? orphanedCount : statsRow.total_count - orphanedCount;

  return {
    items,
    total,
    page,
    pageSize,
    stats: {
      totalCount: statsRow.total_count,
      totalSize: statsRow.total_size,
      orphanedCount
    }
  };
}

export function deleteMediaAsset(context: DatabaseContext, id: number): void {
  const row = context.sqlite
    .query(`SELECT url FROM media_assets WHERE id = ?`)
    .get(id) as { url: string } | undefined;

  if (!row) {
    throw new Error('文件记录不存在');
  }

  const filePath = resolve(ENV.uploadsRoot, 'images', row.url.replace('/uploads/images/', ''));

  try {
    unlinkSync(filePath);
  } catch {
    // file may already be gone on disk, still remove the DB record
  }

  context.sqlite.query(`DELETE FROM media_assets WHERE id = ?`).run(id);
}
