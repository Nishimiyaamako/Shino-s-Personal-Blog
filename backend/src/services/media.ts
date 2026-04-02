import { mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ENV } from '../config/env';
import type { DatabaseContext } from '../db/client';

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
