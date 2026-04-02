import { ensureDefaultAdminUser } from '../auth/admin';
import { createDatabaseContext } from '../db/client';

const context = createDatabaseContext();
await ensureDefaultAdminUser(context);

console.info('[migrate] database migrated and admin user ensured.');
