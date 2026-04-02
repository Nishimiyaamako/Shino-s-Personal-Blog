import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { ensureDefaultAdminUser } from './auth/admin';
import { ENV } from './config/env';
import { createDatabaseContext, type DatabaseContext } from './db/client';
import { createAdminRoutes } from './routes/admin';
import { createPublicRoutes } from './routes/public';

const SAFE_UPLOAD_FILE_REGEXP = /^[A-Za-z0-9._-]+$/;

export interface AppContext {
  app: any;
  dbContext: DatabaseContext;
}

export async function createApp(options: { databasePath?: string } = {}): Promise<AppContext> {
  const dbContext = createDatabaseContext({
    databasePath: options.databasePath ?? ENV.databasePath
  });

  await ensureDefaultAdminUser(dbContext);

  const app = new Elysia()
    .use(
      cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      })
    )
    .get('/uploads/images/:fileName', ({ params, set }) => {
      if (!SAFE_UPLOAD_FILE_REGEXP.test(params.fileName)) {
        set.status = 400;
        return { error: '非法文件名' };
      }

      const filePath = resolve(ENV.uploadsRoot, 'images', params.fileName);

      if (!existsSync(filePath)) {
        set.status = 404;
        return { error: '文件不存在' };
      }

      return Bun.file(filePath);
    })
    .use(createPublicRoutes(dbContext))
    .use(createAdminRoutes(dbContext));

  return {
    app,
    dbContext
  };
}
