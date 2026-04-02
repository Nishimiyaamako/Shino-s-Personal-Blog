import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { ENV } from '../config/env';
import { createDatabaseContext } from '../db/client';
import { updateAboutMarkdown } from '../services/about';
import { createFriendLink } from '../services/friends';
import { createPost, rebuildSearchIndex, type UpsertPostInput } from '../services/posts';
import { updateProfileCard } from '../services/profile';

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
    `);
  } finally {
    context.sqlite.close();
  }
}

function parsePostMarkdownFile(markdownPath: string): UpsertPostInput {
  const raw = readFileSync(markdownPath, 'utf-8');
  const parsed = matter(raw);
  const frontmatter = parsed.data as FrontmatterRecord;

  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.map((tag) => String(tag)) : [];
  const normalizedDate =
    frontmatter.date instanceof Date
      ? frontmatter.date.toISOString().slice(0, 10)
      : String(frontmatter.date ?? '').trim();

  if (!frontmatter.title || !frontmatter.slug || !frontmatter.date || !frontmatter.summary || !frontmatter.status) {
    throw new Error(`文章 frontmatter 缺少必要字段: ${markdownPath}`);
  }

  return {
    title: String(frontmatter.title),
    slug: String(frontmatter.slug),
    date: normalizedDate,
    summary: String(frontmatter.summary),
    theme: frontmatter.theme ? String(frontmatter.theme) : undefined,
    status: frontmatter.status,
    tags,
    contentMarkdown: parsed.content.trim()
  };
}

async function importFrontendData(databasePath?: string): Promise<ImportResult> {
  clearContentTables(databasePath);

  const context = createDatabaseContext({ databasePath });
  try {
    const frontendRoot = resolve(ENV.backendRoot, '../frontend');
    const postsDir = resolve(frontendRoot, 'src/content/posts');
    const coversDir = resolve(frontendRoot, 'public/images/covers');
    const aboutMarkdownPath = resolve(frontendRoot, 'src/content/about.md');
    const friendsModulePath = resolve(frontendRoot, 'src/data/friends.ts');
    const profileModulePath = resolve(frontendRoot, 'src/data/profile-card.ts');

    const postFiles = Array.from(new Bun.Glob('*.md').scanSync(postsDir)).sort((a, b) => a.localeCompare(b, 'en'));
    const postInputs = postFiles.map((fileName) => parsePostMarkdownFile(resolve(postsDir, fileName)));

    const featuredSlugs = postInputs
      .filter((post) => post.status === 'published')
      .sort((left, right) => right.date.localeCompare(left.date, 'en'))
      .slice(0, 5)
      .map((post) => post.slug);

    const featuredOrderMap = new Map<string, number>();
    featuredSlugs.forEach((slug, index) => {
      featuredOrderMap.set(slug, index + 1);
    });

    for (const input of postInputs) {
      const coverPath = resolve(coversDir, `${input.slug}.webp`);

      if (existsSync(coverPath)) {
        const targetCoverPath = resolve(ENV.uploadsRoot, 'images', `${input.slug}.webp`);
        copyFileSync(coverPath, targetCoverPath);
        input.coverImageUrl = `/uploads/images/${input.slug}.webp`;
      }

      const featuredOrder = featuredOrderMap.get(input.slug);

      createPost(context, {
        ...input,
        isFeatured: featuredOrder !== undefined,
        featuredOrder
      });
    }

    const aboutMarkdown = readFileSync(aboutMarkdownPath, 'utf-8');
    updateAboutMarkdown(context, aboutMarkdown);

    const friendsModule = await import(pathToFileURL(friendsModulePath).href);
    const profileModule = await import(pathToFileURL(profileModulePath).href);

    const friendLinks = (friendsModule as { FRIEND_LINKS?: Array<Record<string, unknown>> }).FRIEND_LINKS ?? [];

    friendLinks.forEach((item, index) => {
      createFriendLink(context, {
        name: String(item.name ?? ''),
        description: String(item.description ?? ''),
        avatar: String(item.avatar ?? ''),
        url: String(item.url ?? ''),
        enabled: true,
        displayOrder: index
      });
    });

    const profileConfig = (profileModule as { PROFILE_CARD_CONFIG?: Record<string, unknown> }).PROFILE_CARD_CONFIG;

    updateProfileCard(context, {
      name: String(profileConfig?.name ?? 'Shino'),
      bio: String(profileConfig?.bio ?? 'Luna say maybe'),
      avatar: String(profileConfig?.avatar ?? 'https://placehold.co/120x120/png?text=ME'),
      contacts: Array.isArray(profileConfig?.contacts)
        ? profileConfig.contacts.map((item, index) => {
            const contact = item as Record<string, unknown>;
            return {
              platform: String(contact.platform ?? ''),
              label: String(contact.label ?? ''),
              href: String(contact.href ?? ''),
              displayOrder: index
            };
          })
        : []
    });

    rebuildSearchIndex(context);

    return {
      posts: postInputs.length,
      friends: friendLinks.length,
      about: true,
      profile: true
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
