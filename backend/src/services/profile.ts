import type { DatabaseContext } from '../db/client';
import type { ApiProfileCard, ApiProfileContact } from '../types/api';

const DEFAULT_PROFILE: ApiProfileCard = {
  name: 'Shino',
  bio: 'Luna say maybe',
  avatar: 'https://placehold.co/120x120/png?text=ME',
  contacts: []
};

interface ProfileCardRow {
  name: string;
  bio: string;
  avatar: string;
}

interface ProfileContactRow {
  id: number;
  platform: string;
  label: string;
  href: string;
  displayOrder: number;
}

function readContacts(context: DatabaseContext): ApiProfileContact[] {
  const rows = context.sqlite
    .query(`
      SELECT id, platform, label, href, display_order AS displayOrder
      FROM profile_contacts
      WHERE profile_card_id = 1
      ORDER BY display_order ASC, id ASC
    `)
    .all() as ProfileContactRow[];

  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    label: row.label,
    href: row.href,
    displayOrder: row.displayOrder
  }));
}

function ensureProfileCard(context: DatabaseContext): ProfileCardRow {
  const row = context.sqlite
    .query('SELECT name, bio, avatar FROM profile_card WHERE id = 1 LIMIT 1')
    .get() as ProfileCardRow | null;

  if (row) {
    return row;
  }

  context.sqlite
    .query('INSERT INTO profile_card (id, name, bio, avatar, updated_at) VALUES (1, ?, ?, ?, ?)')
    .run(
      DEFAULT_PROFILE.name,
      DEFAULT_PROFILE.bio,
      DEFAULT_PROFILE.avatar,
      new Date().toISOString()
    );

  return {
    name: DEFAULT_PROFILE.name,
    bio: DEFAULT_PROFILE.bio,
    avatar: DEFAULT_PROFILE.avatar
  };
}

export function getProfileCard(context: DatabaseContext): ApiProfileCard {
  const profile = ensureProfileCard(context);

  return {
    name: profile.name,
    bio: profile.bio,
    avatar: profile.avatar,
    contacts: readContacts(context)
  };
}

export function updateProfileCard(
  context: DatabaseContext,
  payload: {
    name: string;
    bio: string;
    avatar: string;
    contacts: Array<{ platform: string; label: string; href: string; displayOrder?: number }>;
  }
): ApiProfileCard {
  const name = payload.name.trim();
  const bio = payload.bio.trim();
  const avatar = payload.avatar.trim();

  if (!name || !bio || !avatar) {
    throw new Error('name/bio/avatar 不能为空');
  }

  const contacts = payload.contacts
    .map((contact, index) => ({
      platform: contact.platform.trim(),
      label: contact.label.trim(),
      href: contact.href.trim(),
      displayOrder: Number(contact.displayOrder ?? index)
    }))
    .filter((contact) => contact.platform && contact.href);

  const now = new Date().toISOString();

  context.sqlite
    .query(`
      INSERT INTO profile_card (id, name, bio, avatar, updated_at)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        bio = excluded.bio,
        avatar = excluded.avatar,
        updated_at = excluded.updated_at
    `)
    .run(name, bio, avatar, now);

  context.sqlite.query('DELETE FROM profile_contacts WHERE profile_card_id = 1').run();

  for (const contact of contacts) {
    context.sqlite
      .query(`
        INSERT INTO profile_contacts (profile_card_id, platform, label, href, display_order)
        VALUES (1, ?, ?, ?, ?)
      `)
      .run(contact.platform, contact.label, contact.href, contact.displayOrder);
  }

  return {
    name,
    bio,
    avatar,
    contacts: readContacts(context)
  };
}
