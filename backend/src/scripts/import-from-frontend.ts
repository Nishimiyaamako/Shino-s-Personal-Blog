import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { ENV } from '../config/env';
import { createDatabaseContext } from '../db/client';
import { createPost, rebuildSearchIndex, type UpsertPostInput } from '../services/posts';

interface FrontmatterRecord {
  title?: string;
  slug?: string;
  date?: string | Date;
  summary?: string;
  theme?: string;
  status?: 'draft' | 'published';
  tags?: string[];
}

interface ImportResult {
  posts: number;
  friends: number;
  about: boolean;
  profile: boolean;
}

function clearContentTables(databasePath?: string): void {
  const context = createDatabaseContext({ databasePath });
  try {
    context.sqlite.exec(`
      DELETE FROM post_tags;
      DELETE FROM tags;
      DELETE FROM posts_search;
      DELETE FROM posts;
      DELETE FROM media_assets;
      DELETE FROM friend_links;
      DELETE FROM about_page;
      DELETE FROM profile_contacts;
      DELETE FROM profile_card;
      DELETE FROM site_config;
    `);
  } finally {
    context.sqlite.close();
  }
}

async function importFrontendData(databasePath?: string): Promise<ImportResult> {
  const frontendRoot = resolve(ENV.backendRoot, '../frontend');
  const postsDir = resolve(frontendRoot, 'src/content/posts');

  const hasMarkdownFiles =
    existsSync(postsDir) && Array.from(new Bun.Glob('*.md').scanSync(postsDir)).length > 0;

  if (!hasMarkdownFiles) {
    console.warn(
      '[seed] No markdown files found in frontend/src/content/posts/, skipping seed to preserve existing data.'
    );
    return { posts: 0, friends: 0, about: false, profile: false };
  }

  clearContentTables(databasePath);

  const context = createDatabaseContext({ databasePath });
  try {
    const postFiles = Array.from(new Bun.Glob('*.md').scanSync(postsDir)).sort((a, b) => a.localeCompare(b, 'en'));

    for (const fileName of postFiles) {
      const raw = Bun.file(resolve(postsDir, fileName));
      const parsed = matter(await raw.text());
      const fm = parsed.data as FrontmatterRecord;

      const tags = Array.isArray(fm.tags) ? fm.tags.map((tag) => String(tag)) : [];
      const normalizedDate =
        fm.date instanceof Date
          ? fm.date.toISOString().slice(0, 10)
          : String(fm.date ?? '').trim();

      if (!fm.title || !fm.slug || !fm.date || !fm.summary || !fm.status) {
        throw new Error(`文章 frontmatter 缺少必要字段: ${fileName}`);
      }

      const input: UpsertPostInput = {
        title: String(fm.title),
        slug: String(fm.slug),
        date: normalizedDate,
        summary: String(fm.summary),
        theme: fm.theme ? String(fm.theme) : undefined,
        status: fm.status,
        tags,
        contentMarkdown: parsed.content.trim()
      };

      createPost(context, {
        ...input,
        isFeatured: false,
        featuredOrder: undefined
      });
    }

    rebuildSearchIndex(context);

    const now = new Date().toISOString();
    context.sqlite
      .query(`
        INSERT INTO site_config (id, site_title, site_subtitle, copyright_owner, powered_by,
          icp_record_text, icp_record_url, public_security_record_text, public_security_record_url,
          friend_link_template, updated_at)
        VALUES (1, 'ShinoLog', '', 'NagaShino', 'Powered by Vite + TypeScript.',
          '', '', '', '',
          'name: ''ShinoLog'',\ndescription: ''某个状态混沌家伙的Blog'',\navatar: ''https://example.com/avatar.png'',\nurl: ''https://nagashino.top/''',
          ?)
        ON CONFLICT(id) DO NOTHING
      `)
      .run(now);

    return {
      posts: postFiles.length,
      friends: 0,
      about: false,
      profile: false
    };
  } finally {
    context.sqlite.close();
  }
}

const result = await importFrontendData();

console.info('[seed] Imported from frontend:');
console.info(`- posts: ${result.posts}`);
console.info(`- friends: ${result.friends}`);
console.info(`- about: ${result.about ? 'ok' : 'skip'}`);
console.info(`- profile: ${result.profile ? 'ok' : 'skip'}`);
