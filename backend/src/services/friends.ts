import type { DatabaseContext } from '../db/client';
import type { ApiFriendLink } from '../types/api';

interface FriendRow {
  id: number;
  name: string;
  description: string;
  avatar: string;
  url: string;
  enabled: number;
  displayOrder: number;
}

function toFriendLink(row: FriendRow): ApiFriendLink {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    avatar: row.avatar,
    url: row.url,
    enabled: Boolean(row.enabled),
    displayOrder: row.displayOrder
  };
}

function assertFriendInput(input: {
  name: string;
  description: string;
  avatar: string;
  url: string;
}): void {
  if (!input.name.trim()) {
    throw new Error('name 不能为空');
  }

  if (!input.description.trim()) {
    throw new Error('description 不能为空');
  }

  if (!input.avatar.trim()) {
    throw new Error('avatar 不能为空');
  }

  if (!input.url.trim()) {
    throw new Error('url 不能为空');
  }
}

export function listPublicFriendLinks(context: DatabaseContext): ApiFriendLink[] {
  const rows = context.sqlite
    .query(`
      SELECT id, name, description, avatar, url, enabled, display_order AS displayOrder
      FROM friend_links
      WHERE enabled = 1
      ORDER BY display_order ASC, id ASC
    `)
    .all() as FriendRow[];

  return rows.map(toFriendLink);
}

export function listAdminFriendLinks(context: DatabaseContext): ApiFriendLink[] {
  const rows = context.sqlite
    .query(`
      SELECT id, name, description, avatar, url, enabled, display_order AS displayOrder
      FROM friend_links
      ORDER BY display_order ASC, id ASC
    `)
    .all() as FriendRow[];

  return rows.map(toFriendLink);
}

export function createFriendLink(
  context: DatabaseContext,
  input: {
    name: string;
    description: string;
    avatar: string;
    url: string;
    enabled?: boolean;
    displayOrder?: number;
  }
): ApiFriendLink {
  assertFriendInput(input);

  const now = new Date().toISOString();

  const result = context.sqlite
    .query(`
      INSERT INTO friend_links (
        name,
        description,
        avatar,
        url,
        enabled,
        display_order,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      input.name.trim(),
      input.description.trim(),
      input.avatar.trim(),
      input.url.trim(),
      input.enabled === false ? 0 : 1,
      Number(input.displayOrder ?? 0),
      now,
      now
    );

  const createdId = Number(result.lastInsertRowid);
  const created = context.sqlite
    .query(`
      SELECT id, name, description, avatar, url, enabled, display_order AS displayOrder
      FROM friend_links
      WHERE id = ?
      LIMIT 1
    `)
    .get(createdId) as FriendRow;

  return toFriendLink(created);
}

export function updateFriendLink(
  context: DatabaseContext,
  friendId: number,
  input: {
    name?: string;
    description?: string;
    avatar?: string;
    url?: string;
    enabled?: boolean;
    displayOrder?: number;
  }
): ApiFriendLink | null {
  const existing = context.sqlite
    .query(`
      SELECT id, name, description, avatar, url, enabled, display_order AS displayOrder
      FROM friend_links
      WHERE id = ?
      LIMIT 1
    `)
    .get(friendId) as FriendRow | null;

  if (!existing) {
    return null;
  }

  const next = {
    name: input.name?.trim() ?? existing.name,
    description: input.description?.trim() ?? existing.description,
    avatar: input.avatar?.trim() ?? existing.avatar,
    url: input.url?.trim() ?? existing.url,
    enabled: input.enabled ?? Boolean(existing.enabled),
    displayOrder: Number(input.displayOrder ?? existing.displayOrder)
  };

  assertFriendInput(next);

  context.sqlite
    .query(`
      UPDATE friend_links
      SET
        name = ?,
        description = ?,
        avatar = ?,
        url = ?,
        enabled = ?,
        display_order = ?,
        updated_at = ?
      WHERE id = ?
    `)
    .run(
      next.name,
      next.description,
      next.avatar,
      next.url,
      next.enabled ? 1 : 0,
      next.displayOrder,
      new Date().toISOString(),
      friendId
    );

  return {
    id: existing.id,
    ...next
  };
}

export function deleteFriendLink(context: DatabaseContext, friendId: number): boolean {
  const result = context.sqlite.query('DELETE FROM friend_links WHERE id = ?').run(friendId);
  return result.changes > 0;
}
