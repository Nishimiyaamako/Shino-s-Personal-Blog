import { eq } from 'drizzle-orm';
import { ENV } from '../config/env';
import type { DatabaseContext } from '../db/client';
import { adminUsersTable } from '../db/schema';

export async function ensureDefaultAdminUser(context: DatabaseContext): Promise<void> {
  const existing = await context.db
    .select({ id: adminUsersTable.id, passwordHash: adminUsersTable.passwordHash })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.username, ENV.adminUsername))
    .limit(1);

  const now = new Date().toISOString();
  const passwordHash = await Bun.password.hash(ENV.adminPassword);

  if (!existing.length) {
    await context.db.insert(adminUsersTable).values({
      username: ENV.adminUsername,
      passwordHash,
      createdAt: now
    });
    return;
  }

  const isSamePassword = await Bun.password.verify(ENV.adminPassword, existing[0]!.passwordHash);
  if (!isSamePassword) {
    await context.db
      .update(adminUsersTable)
      .set({ passwordHash })
      .where(eq(adminUsersTable.id, existing[0]!.id));
  }
}

export async function verifyAdminCredentials(
  context: DatabaseContext,
  username: string,
  password: string
): Promise<{ id: number; username: string } | null> {
  const rows = await context.db
    .select({ id: adminUsersTable.id, username: adminUsersTable.username, passwordHash: adminUsersTable.passwordHash })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.username, username.trim()))
    .limit(1);

  if (!rows.length) {
    return null;
  }

  const user = rows[0]!;
  const ok = await Bun.password.verify(password, user.passwordHash);

  if (!ok) {
    return null;
  }

  return {
    id: user.id,
    username: user.username
  };
}
