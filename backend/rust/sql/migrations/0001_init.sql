-- 0001_init.sql — Shino's Bolg Postgres schema
-- 与旧 SQLite schema（backend/src/db/migrate.ts）等价，差异：
--   * 无 is_featured / featured_order 列（精选功能已废弃）
--   * site_config 含 slogan（默认 ''）
--   * 时间戳保持 TEXT ISO 8601 原样（避免时区语义变化）
--   * 全文搜索：posts_search 镜像表（对应旧 FTS5 posts_search，应用层维护，含 tags 列）

CREATE TABLE admin_users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE posts (
  id serial PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  date text NOT NULL,
  summary text NOT NULL,
  theme text,
  cover_image_url text,
  content_markdown text NOT NULL,
  content_html text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  view_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  published_at text
);

CREATE INDEX posts_status_idx ON posts(status);

CREATE TABLE tags (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE post_tags (
  post_id integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id integer NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX post_tags_post_idx ON post_tags(post_id);
CREATE INDEX post_tags_tag_idx ON post_tags(tag_id);

CREATE TABLE media_assets (
  id serial PRIMARY KEY,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size integer NOT NULL,
  url text NOT NULL UNIQUE,
  created_at text NOT NULL
);

CREATE TABLE friend_links (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  avatar text NOT NULL,
  url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE INDEX friend_links_enabled_order_idx ON friend_links(enabled, display_order);

CREATE TABLE about_page (
  id integer PRIMARY KEY,
  markdown text NOT NULL,
  hero_title text NOT NULL DEFAULT '',
  hero_subtitle text NOT NULL DEFAULT '',
  intro_paragraphs text NOT NULL DEFAULT '[]',
  narrative_sections text NOT NULL DEFAULT '[]',
  timeline_title text NOT NULL DEFAULT '',
  timeline_events text NOT NULL DEFAULT '[]',
  updated_at text NOT NULL
);

CREATE TABLE profile_card (
  id integer PRIMARY KEY,
  name text NOT NULL,
  bio text NOT NULL,
  avatar text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE profile_contacts (
  id serial PRIMARY KEY,
  profile_card_id integer NOT NULL DEFAULT 1 REFERENCES profile_card(id) ON DELETE CASCADE,
  platform text NOT NULL,
  label text NOT NULL,
  href text NOT NULL,
  display_order integer NOT NULL DEFAULT 0
);

CREATE TABLE site_config (
  id integer PRIMARY KEY,
  site_title text NOT NULL DEFAULT 'ShinoLog',
  site_subtitle text NOT NULL DEFAULT '',
  slogan text NOT NULL DEFAULT '',
  copyright_owner text NOT NULL DEFAULT 'NagaShino',
  powered_by text NOT NULL DEFAULT 'Powered by Vite + TypeScript.',
  icp_record_text text NOT NULL DEFAULT '',
  icp_record_url text NOT NULL DEFAULT '',
  public_security_record_text text NOT NULL DEFAULT '',
  public_security_record_url text NOT NULL DEFAULT '',
  friend_link_template text NOT NULL DEFAULT 'name: ''ShinoLog'',
description: ''某个状态混沌家伙的Blog'',
avatar: ''https://example.com/avatar.png'',
url: ''https://nagashino.top/''',
  updated_at text NOT NULL
);

-- 全文搜索镜像表：对应旧 SQLite FTS5 posts_search（title/summary/tags/content 四列）
-- search_doc 生成列按 'simple' 配置（对中文按连续片段切分，近似 FTS5 unicode61 行为）
CREATE TABLE posts_search (
  post_id integer PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  tags text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  search_doc tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', title || ' ' || summary || ' ' || tags || ' ' || content)
  ) STORED
);

CREATE INDEX posts_search_doc_idx ON posts_search USING GIN (search_doc);
