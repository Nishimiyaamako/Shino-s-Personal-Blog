import { marked } from 'marked';

/**
 * 博客文章数据结构（前端消费层）。
 *
 * 说明：
 * - 与未来后端 Post DTO 对齐核心字段：title/slug/date/tags/summary/content
 * - 当前来源是本地 Markdown；后续可替换为后端 API
 */
export interface PostItem {
  title: string;
  slug: string;
  date: string;
  tags: string[];
  summary: string;
  content: string;
  html: string;
  sourcePath: string;
}

interface RawFrontmatter {
  title?: unknown;
  slug?: unknown;
  date?: unknown;
  tags?: unknown;
  summary?: unknown;
}

interface ParsedMarkdown {
  frontmatter: RawFrontmatter;
  content: string;
}

const MARKDOWN_MODULES = import.meta.glob<string>('../content/posts/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});

marked.setOptions({
  gfm: true,
  breaks: true
});

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDateInYyyyMmDd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

function normalizeDate(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const normalizedValue = value.trim();
  return isDateInYyyyMmDd(normalizedValue) ? normalizedValue : null;
}

function normalizeTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const tags = value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean);

  return tags.length > 0 ? tags : null;
}

function unquote(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return trimmed;
  }

  const start = trimmed.at(0);
  const end = trimmed.at(-1);

  if ((start === '"' && end === '"') || (start === "'" && end === "'")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function parseInlineTagList(rawValue: string): string[] {
  const trimmed = rawValue.trim();

  if (!(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return [unquote(trimmed)].filter(Boolean);
  }

  const listContent = trimmed.slice(1, -1).trim();

  if (!listContent) {
    return [];
  }

  return listContent
    .split(',')
    .map((item) => unquote(item))
    .filter(Boolean);
}

/**
 * 解析简化版 frontmatter：
 * - 必须位于文件头（--- ... ---）
 * - 支持单行键值与 tags 列表（- item）
 */
function parseFrontmatter(rawMarkdown: string): ParsedMarkdown {
  const normalized = rawMarkdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

  if (!normalized.startsWith('---\n')) {
    return { frontmatter: {}, content: normalized };
  }

  const lines = normalized.split('\n');

  if (lines[0].trim() !== '---') {
    return { frontmatter: {}, content: normalized };
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');

  if (endIndex === -1) {
    return { frontmatter: {}, content: normalized };
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const content = lines.slice(endIndex + 1).join('\n');

  const frontmatter: RawFrontmatter = {};
  const tags: string[] = [];
  let collectingTags = false;

  for (const rawLine of frontmatterLines) {
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const keyValueMatch = /^([a-zA-Z][\w-]*):\s*(.*)$/.exec(trimmed);

    if (keyValueMatch) {
      const [, key, rawValue] = keyValueMatch;

      if (key === 'tags') {
        collectingTags = true;

        if (rawValue.trim()) {
          tags.push(...parseInlineTagList(rawValue));
        }

        continue;
      }

      collectingTags = false;

      if (key === 'title' || key === 'slug' || key === 'date' || key === 'summary') {
        frontmatter[key] = unquote(rawValue);
      }

      continue;
    }

    if (collectingTags) {
      const tagMatch = /^-\s+(.+)$/.exec(trimmed);

      if (tagMatch) {
        tags.push(unquote(tagMatch[1]));
      }
    }
  }

  if (tags.length > 0) {
    frontmatter.tags = tags;
  }

  return {
    frontmatter,
    content
  };
}

function createSummary(markdownContent: string): string {
  const plainText = markdownContent
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^\)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) {
    return '暂无摘要。';
  }

  return plainText.length > 120 ? `${plainText.slice(0, 120)}...` : plainText;
}

function buildPostItem(filePath: string, rawMarkdown: string): PostItem | null {
  const { frontmatter, content } = parseFrontmatter(rawMarkdown);

  const title = isNonEmptyString(frontmatter.title) ? frontmatter.title.trim() : null;
  const slug = isNonEmptyString(frontmatter.slug) ? frontmatter.slug.trim() : null;
  const date = normalizeDate(frontmatter.date);
  const tags = normalizeTags(frontmatter.tags);

  if (!title || !slug || !date || !tags) {
    console.warn(`[content] skip invalid frontmatter: ${filePath}`);
    return null;
  }

  const summary = isNonEmptyString(frontmatter.summary)
    ? frontmatter.summary.trim()
    : createSummary(content);

  return {
    title,
    slug,
    date,
    tags,
    summary,
    content,
    html: marked.parse(content) as string,
    sourcePath: filePath
  };
}

function buildPostCollection(): PostItem[] {
  const posts: PostItem[] = [];
  const usedSlugs = new Set<string>();

  for (const [filePath, rawMarkdown] of Object.entries(MARKDOWN_MODULES)) {
    const post = buildPostItem(filePath, rawMarkdown);

    if (!post) {
      continue;
    }

    if (usedSlugs.has(post.slug)) {
      console.warn(`[content] skip duplicate slug "${post.slug}": ${filePath}`);
      continue;
    }

    usedSlugs.add(post.slug);
    posts.push(post);
  }

  posts.sort((a, b) => {
    const timeA = new Date(`${a.date}T00:00:00Z`).getTime();
    const timeB = new Date(`${b.date}T00:00:00Z`).getTime();
    return timeB - timeA;
  });

  return posts;
}

export const POSTS = buildPostCollection();

export function getPostBySlug(rawSlug: string): PostItem | null {
  const slug = rawSlug.trim();
  return POSTS.find((post) => post.slug === slug) ?? null;
}
