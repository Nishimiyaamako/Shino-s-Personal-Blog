import type { Database } from 'bun:sqlite';

const MIGRATIONS_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  summary TEXT NOT NULL,
  theme TEXT,
  cover_image_url TEXT,
  content_markdown TEXT NOT NULL,
  content_html TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'published')),
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  url TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friend_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  avatar TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS about_page (
  id INTEGER PRIMARY KEY,
  markdown TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_card (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT NOT NULL,
  avatar TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_card_id INTEGER NOT NULL DEFAULT 1,
  platform TEXT NOT NULL,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (profile_card_id) REFERENCES profile_card(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_config (
  id INTEGER PRIMARY KEY,
  site_title TEXT NOT NULL DEFAULT 'ShinoLog',
  site_subtitle TEXT NOT NULL DEFAULT '',
  copyright_owner TEXT NOT NULL DEFAULT 'NagaShino',
  powered_by TEXT NOT NULL DEFAULT 'Powered by Vite + TypeScript.',
  icp_record_text TEXT NOT NULL DEFAULT '',
  icp_record_url TEXT NOT NULL DEFAULT '',
  public_security_record_text TEXT NOT NULL DEFAULT '',
  public_security_record_url TEXT NOT NULL DEFAULT '',
  friend_link_template TEXT NOT NULL DEFAULT 'name: ''ShinoLog'',
description: ''某个状态混沌家伙的Blog'',
avatar: ''https://example.com/avatar.png'',
url: ''https://nagashino.top/''',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS posts_status_idx ON posts(status);
CREATE INDEX IF NOT EXISTS post_tags_post_idx ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS post_tags_tag_idx ON post_tags(tag_id);
CREATE INDEX IF NOT EXISTS friend_links_enabled_order_idx ON friend_links(enabled, display_order);

CREATE VIRTUAL TABLE IF NOT EXISTS posts_search USING fts5(
  post_id UNINDEXED,
  title,
  summary,
  tags,
  content
);

`;

export function runMigrations(sqlite: Database): void {
  sqlite.exec(MIGRATIONS_SQL);
  runPostMigrations(sqlite);
}

function runPostMigrations(sqlite: Database): void {
  const existing = new Set(
    (sqlite.query(`SELECT name FROM pragma_table_info('about_page')`).all() as Array<{ name: string }>).map((r) => r.name)
  );

  if (!existing.has('hero_title')) {
    sqlite.run(`ALTER TABLE about_page ADD COLUMN hero_title TEXT NOT NULL DEFAULT ''`);
  }
  if (!existing.has('hero_subtitle')) {
    sqlite.run(`ALTER TABLE about_page ADD COLUMN hero_subtitle TEXT NOT NULL DEFAULT ''`);
  }
  if (!existing.has('intro_paragraphs')) {
    sqlite.run(`ALTER TABLE about_page ADD COLUMN intro_paragraphs TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!existing.has('narrative_sections')) {
    sqlite.run(`ALTER TABLE about_page ADD COLUMN narrative_sections TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!existing.has('timeline_title')) {
    sqlite.run(`ALTER TABLE about_page ADD COLUMN timeline_title TEXT NOT NULL DEFAULT ''`);
  }
  if (!existing.has('timeline_events')) {
    sqlite.run(`ALTER TABLE about_page ADD COLUMN timeline_events TEXT NOT NULL DEFAULT '[]'`);
  }

  // 精选功能废弃：先删索引（索引引用列，不删索引无法 DROP COLUMN），再删列
  sqlite.run(`DROP INDEX IF EXISTS posts_featured_idx`);

  const postColumns = new Set(
    (sqlite.query(`SELECT name FROM pragma_table_info('posts')`).all() as Array<{ name: string }>).map((r) => r.name)
  );

  if (postColumns.has('is_featured')) {
    sqlite.run(`ALTER TABLE posts DROP COLUMN is_featured`);
  }
  if (postColumns.has('featured_order')) {
    sqlite.run(`ALTER TABLE posts DROP COLUMN featured_order`);
  }
}
