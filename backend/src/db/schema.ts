import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const adminUsersTable = sqliteTable(
  'admin_users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: text('created_at').notNull()
  },
  (table) => ({
    usernameUnique: uniqueIndex('admin_users_username_unique').on(table.username)
  })
);

export const postsTable = sqliteTable(
  'posts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    date: text('date').notNull(),
    summary: text('summary').notNull(),
    theme: text('theme'),
    coverImageUrl: text('cover_image_url'),
    contentMarkdown: text('content_markdown').notNull(),
    contentHtml: text('content_html').notNull(),
    status: text('status', { enum: ['draft', 'published'] }).notNull(),
    viewCount: integer('view_count').notNull().default(0),
    likeCount: integer('like_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    publishedAt: text('published_at')
  },
  (table) => ({
    slugUnique: uniqueIndex('posts_slug_unique').on(table.slug)
  })
);

export const tagsTable = sqliteTable(
  'tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull()
  },
  (table) => ({
    nameUnique: uniqueIndex('tags_name_unique').on(table.name)
  })
);

export const postTagsTable = sqliteTable(
  'post_tags',
  {
    postId: integer('post_id').notNull(),
    tagId: integer('tag_id').notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.tagId] })
  })
);

export const mediaAssetsTable = sqliteTable(
  'media_assets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    url: text('url').notNull(),
    createdAt: text('created_at').notNull()
  },
  (table) => ({
    urlUnique: uniqueIndex('media_assets_url_unique').on(table.url)
  })
);

export const friendLinksTable = sqliteTable('friend_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  avatar: text('avatar').notNull(),
  url: text('url').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const aboutPageTable = sqliteTable('about_page', {
  id: integer('id').primaryKey(),
  markdown: text('markdown').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const profileCardTable = sqliteTable('profile_card', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  bio: text('bio').notNull(),
  avatar: text('avatar').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const siteConfigTable = sqliteTable('site_config', {
  id: integer('id').primaryKey(),
  siteTitle: text('site_title').notNull().default('ShinoLog'),
  siteSubtitle: text('site_subtitle').notNull().default(''),
  copyrightOwner: text('copyright_owner').notNull().default('NagaShino'),
  poweredBy: text('powered_by').notNull().default('Powered by Vite + TypeScript.'),
  icpRecordText: text('icp_record_text').notNull().default(''),
  icpRecordUrl: text('icp_record_url').notNull().default(''),
  publicSecurityRecordText: text('public_security_record_text').notNull().default(''),
  publicSecurityRecordUrl: text('public_security_record_url').notNull().default(''),
  friendLinkTemplate: text('friend_link_template').notNull().default("name: 'ShinoLog',\ndescription: '某个状态混沌家伙的Blog',\navatar: 'https://example.com/avatar.png',\nurl: 'https://nagashino.top/'"),
  updatedAt: text('updated_at').notNull()
});

export const profileContactsTable = sqliteTable('profile_contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileCardId: integer('profile_card_id').notNull().default(1),
  platform: text('platform').notNull(),
  label: text('label').notNull(),
  href: text('href').notNull(),
  displayOrder: integer('display_order').notNull().default(0)
});
