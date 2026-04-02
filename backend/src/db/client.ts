import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { ENV } from '../config/env';
import { runMigrations } from './migrate';
import * as schema from './schema';

export interface DatabaseContext {
  sqlite: Database;
  db: ReturnType<typeof drizzle<typeof schema>>;
}

let dbContext: DatabaseContext | null = null;

export function createDatabaseContext(options: { databasePath?: string } = {}): DatabaseContext {
  const databasePath = options.databasePath ?? ENV.databasePath;
  const sqlite = new Database(databasePath, { create: true, strict: true });

  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec('PRAGMA journal_mode = WAL;');

  runMigrations(sqlite);

  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

export function getDatabaseContext(options: { reset?: boolean; databasePath?: string } = {}): DatabaseContext {
  if (!dbContext || options.reset) {
    dbContext?.sqlite.close();
    dbContext = createDatabaseContext({ databasePath: options.databasePath });
  }

  return dbContext;
}

export function closeDatabaseContext(): void {
  if (!dbContext) {
    return;
  }

  dbContext.sqlite.close();
  dbContext = null;
}
