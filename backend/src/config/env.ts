import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(CURRENT_FILE_DIR, '../..');

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readString(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  return raw ? raw : fallback;
}

export const ENV = {
  backendRoot: BACKEND_ROOT,
  port: readNumber('PORT', 3001),
  nodeEnv: readString('NODE_ENV', 'development'),
  databasePath: readString('DATABASE_PATH', resolve(BACKEND_ROOT, 'data/blog.sqlite')),
  uploadsRoot: readString('UPLOADS_ROOT', resolve(BACKEND_ROOT, 'uploads')),
  jwtSecret: readString('ADMIN_JWT_SECRET', 'change-this-secret-in-production'),
  jwtExpiresInHours: readNumber('ADMIN_JWT_EXPIRES_HOURS', 24),
  adminUsername: readString('ADMIN_USERNAME', 'admin'),
  adminPassword: readString('ADMIN_PASSWORD', 'admin123')
} as const;

mkdirSync(dirname(ENV.databasePath), { recursive: true });
mkdirSync(ENV.uploadsRoot, { recursive: true });
mkdirSync(resolve(ENV.uploadsRoot, 'images'), { recursive: true });

export function isProduction(): boolean {
  return ENV.nodeEnv === 'production';
}
