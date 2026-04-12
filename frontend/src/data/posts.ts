import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { THEME_ORDER } from '../config/themes';
import {
  ContentValidationError,
  type ArchiveStat,
  type ArchiveTimelineData,
  type ArchiveTimelinePost,
  type ArchiveTimelineYear,
  type PostDetail,
  type PostFrontmatter,
  type PostSummary,
  type TagStat,
  type ThemeStat
} from '../types/content';
import { normalizeThemeKey } from '../utils/theme';

const SLUG_REGEXP = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_REGEXP = /^\d{4}-\d{2}-\d{2}$/;
const TAG_REGEXP = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RAW_POST_MODULES = import.meta.glob('../content/posts/*.md', {
  eager: true,
  import: 'default',
  query: '?raw'
}) as Record<string, string>;

marked.use({
  gfm: true,
  breaks: false,
  async: false
});

let allPostCache: PostDetail[] | null = null;
let remotePublishedPostCache: PostDetail[] | null = null;
let remotePublishedPostFingerprint = '';

export interface PublishedWritingStats {
  postCount: number;
  wordCount: number;
}

export function loadPosts(): PostSummary[] {
  return getPublishedPosts().map((post) => toSummary(post));
}

export function loadHomeFeaturedPosts(limit = 5): PostSummary[] {
  const normalizedLimit = Math.max(1, Number(limit) || 5);
  const publishedPosts = getPublishedPosts();
  const featuredPosts = publishedPosts
    .filter((post) => typeof post.featuredOrder === 'number')
    .sort((left, right) => {
      const leftOrder = left.featuredOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.featuredOrder ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return right.date.localeCompare(left.date, 'en');
    });

  if (featuredPosts.length) {
    return featuredPosts.slice(0, normalizedLimit).map((post) => toSummary(post));
  }

  return publishedPosts.slice(0, normalizedLimit).map((post) => toSummary(post));
}

export function applyRemotePublishedPostSummaries(summaries: PostSummary[]): boolean {
  const normalizedSummaries = summaries
    .map((summary) => normalizeRemoteSummary(summary))
    .filter((summary) => summary.title && summary.slug && summary.date && summary.summary);
  const localPostMap = new Map(getAllPosts().map((post) => [post.slug, post] as const));
  const currentRemotePostMap = new Map((remotePublishedPostCache ?? []).map((post) => [post.slug, post] as const));
  const nextRemotePosts: PostDetail[] = normalizedSummaries.map((summary) => {
    const currentRemotePost = currentRemotePostMap.get(summary.slug);

    if (currentRemotePost) {
      return {
        ...currentRemotePost,
        ...summary
      };
    }

    const localPost = localPostMap.get(summary.slug);

    if (localPost) {
      return {
        ...localPost,
        ...summary
      };
    }

    return {
      ...summary,
      status: 'published',
      contentMarkdown: '',
      contentHtml: '<p>该文章正文稍后加载。</p>'
    };
  });

  nextRemotePosts.sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date, 'en');
    }

    return left.slug.localeCompare(right.slug, 'en');
  });

  const nextFingerprint = buildPostFingerprint(nextRemotePosts);

  if (nextFingerprint === remotePublishedPostFingerprint) {
    return false;
  }

  remotePublishedPostCache = nextRemotePosts;
  remotePublishedPostFingerprint = nextFingerprint;
  return true;
}

export function applyRemotePostDetail(detail: PostDetail): boolean {
  const normalizedDetail = normalizeRemoteDetail(detail);

  if (!normalizedDetail.slug) {
    return false;
  }

  const baseRemotePosts = remotePublishedPostCache ? [...remotePublishedPostCache] : [...getPublishedPosts()];
  const targetIndex = baseRemotePosts.findIndex((post) => post.slug === normalizedDetail.slug);

  if (targetIndex === -1) {
    baseRemotePosts.push(normalizedDetail);
  } else {
    baseRemotePosts[targetIndex] = {
      ...baseRemotePosts[targetIndex],
      ...normalizedDetail
    };
  }

  baseRemotePosts.sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date, 'en');
    }

    return left.slug.localeCompare(right.slug, 'en');
  });

  const nextFingerprint = buildPostFingerprint(baseRemotePosts);

  if (nextFingerprint === remotePublishedPostFingerprint) {
    return false;
  }

  remotePublishedPostCache = baseRemotePosts;
  remotePublishedPostFingerprint = nextFingerprint;
  return true;
}

export function clearRemotePostOverrides(): void {
  remotePublishedPostCache = null;
  remotePublishedPostFingerprint = '';
}

export function getPostBySlug(slug: string): PostDetail | null {
  if (!SLUG_REGEXP.test(slug)) {
    return null;
  }

  return getPublishedPosts().find((post) => post.slug === slug) ?? null;
}

export function hasPublishedPostSlug(slug: string): boolean {
  return getPostBySlug(slug) !== null;
}

export function getPostsByTag(tag: string): PostSummary[] {
  const normalizedTag = normalizeTag(tag);

  if (!normalizedTag || !TAG_REGEXP.test(normalizedTag)) {
    return [];
  }

  return getPublishedPosts()
    .filter((post) => post.tags.includes(normalizedTag))
    .map((post) => toSummary(post));
}

export function getTagStats(): TagStat[] {
  const countMap = new Map<string, number>();

  for (const post of getPublishedPosts()) {
    for (const tag of post.tags) {
      countMap.set(tag, (countMap.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(countMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.tag.localeCompare(right.tag, 'en');
    });
}

export function getThemeStats(): ThemeStat[] {
  interface ThemeAccumulator {
    key: string;
    label: string;
    count: number;
    latestPostDate: string;
  }

  const countMap = new Map<string, ThemeAccumulator>();
  const themeOrderMap = new Map<string, number>(
    THEME_ORDER.map((themeKey, index) => [normalizeThemeKey(themeKey), index])
  );

  for (const post of getPublishedPosts()) {
    if (!post.theme) {
      continue;
    }

    const key = normalizeThemeKey(post.theme);

    if (!key) {
      continue;
    }

    const existing = countMap.get(key);
    if (existing) {
      existing.count += 1;
      if (post.date.localeCompare(existing.latestPostDate, 'en') > 0) {
        existing.latestPostDate = post.date;
      }
      continue;
    }

    countMap.set(key, {
      key,
      label: post.theme,
      count: 1,
      latestPostDate: post.date
    });
  }

  const sortedThemeAccumulators = Array.from(countMap.values()).sort((left, right) => {
    const leftOrderIndex = themeOrderMap.get(left.key);
    const rightOrderIndex = themeOrderMap.get(right.key);
    const hasLeftWeight = leftOrderIndex !== undefined;
    const hasRightWeight = rightOrderIndex !== undefined;

    if (hasLeftWeight && hasRightWeight && leftOrderIndex !== rightOrderIndex) {
      return leftOrderIndex - rightOrderIndex;
    }

    if (hasLeftWeight !== hasRightWeight) {
      return hasLeftWeight ? -1 : 1;
    }

    if (left.latestPostDate !== right.latestPostDate) {
      return right.latestPostDate.localeCompare(left.latestPostDate, 'en');
    }

    return left.label.localeCompare(right.label, 'zh-Hans-CN');
  });

  return sortedThemeAccumulators.map(({ key, label, count }) => ({
    key,
    label,
    count
  }));
}

export function getArchiveStats(): ArchiveStat[] {
  const countMap = new Map<string, ArchiveStat>();

  for (const post of getPublishedPosts()) {
    const [yearText, monthText] = post.date.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const key = `${yearText}-${monthText}`;
    const current = countMap.get(key);

    if (current) {
      current.count += 1;
      continue;
    }

    countMap.set(key, {
      key,
      year,
      month,
      count: 1
    });
  }

  return Array.from(countMap.values()).sort((left, right) => right.key.localeCompare(left.key, 'en'));
}

export function getArchiveTimeline(): ArchiveTimelineData {
  const yearMap = new Map<number, ArchiveTimelinePost[]>();

  for (const post of getPublishedPosts()) {
    const [yearText, monthText, dayText] = post.date.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const currentPosts = yearMap.get(year) ?? [];

    currentPosts.push({
      title: post.title,
      slug: post.slug,
      date: post.date,
      month,
      day
    });

    yearMap.set(year, currentPosts);
  }

  const years: ArchiveTimelineYear[] = Array.from(yearMap.entries())
    .sort((left, right) => right[0] - left[0])
    .map(([year, posts]) => ({
      year,
      posts: posts.sort((left, right) => right.date.localeCompare(left.date, 'en'))
    }));

  return {
    totalPosts: years.reduce((total, year) => total + year.posts.length, 0),
    years
  };
}

export function getPublishedWritingStats(): PublishedWritingStats {
  const publishedPosts = getPublishedPosts();
  const wordCount = publishedPosts.reduce((total, post) => total + countPlainTextChars(post.contentMarkdown), 0);

  return {
    postCount: publishedPosts.length,
    wordCount
  };
}

function getPublishedPosts(): PostDetail[] {
  if (remotePublishedPostCache) {
    return remotePublishedPostCache.filter((post) => post.status === 'published');
  }

  return getAllPosts().filter((post) => post.status === 'published');
}

function getAllPosts(): PostDetail[] {
  if (allPostCache) {
    return allPostCache;
  }

  const parsedPosts: PostDetail[] = [];

  for (const [sourcePath, rawMarkdown] of Object.entries(RAW_POST_MODULES)) {
    try {
      parsedPosts.push(parseMarkdownPost(sourcePath, rawMarkdown));
    } catch (error) {
      reportValidationError(error, sourcePath);
    }
  }

  parsedPosts.sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date, 'en');
    }

    return left.slug.localeCompare(right.slug, 'en');
  });

  allPostCache = parsedPosts;
  return allPostCache;
}

function parseMarkdownPost(sourcePath: string, rawMarkdown: string): PostDetail {
  const { frontmatter, contentMarkdown } = extractFrontmatter(rawMarkdown, sourcePath);
  const postFrontmatter = validatePostFrontmatter(frontmatter, sourcePath);

  const renderedMarkdown = marked.parse(contentMarkdown);
  const unsafeHtml = typeof renderedMarkdown === 'string' ? renderedMarkdown : '';

  return {
    ...postFrontmatter,
    contentMarkdown,
    contentHtml: DOMPurify.sanitize(unsafeHtml)
  };
}

function extractFrontmatter(
  rawMarkdown: string,
  sourcePath: string
): { frontmatter: Record<string, unknown>; contentMarkdown: string } {
  const matched = rawMarkdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!matched) {
    throw new ContentValidationError('Frontmatter 块缺失（需要使用 --- 包裹）', sourcePath, 'frontmatter');
  }

  const [, frontmatterBlock, markdownBody] = matched;
  const frontmatter = parseFrontmatterBlock(frontmatterBlock, sourcePath);
  const contentMarkdown = markdownBody.trim();

  if (!contentMarkdown) {
    throw new ContentValidationError('正文内容不能为空', sourcePath, 'content');
  }

  return { frontmatter, contentMarkdown };
}

function parseFrontmatterBlock(frontmatterBlock: string, sourcePath: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = frontmatterBlock.split(/\r?\n/);

  let index = 0;
  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      index += 1;
      continue;
    }

    const pairMatch = rawLine.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);

    if (!pairMatch) {
      throw new ContentValidationError(`无法解析 frontmatter 行：${rawLine}`, sourcePath, 'frontmatter');
    }

    const [, rawKey, rawValue] = pairMatch;
    const key = rawKey.trim();
    const value = rawValue.trim();

    if (!value) {
      const tagsFromList: string[] = [];
      let nextIndex = index + 1;

      while (nextIndex < lines.length) {
        const listLine = lines[nextIndex];
        const listMatch = listLine.match(/^\s*-\s+(.+)$/);

        if (!listMatch) {
          break;
        }

        tagsFromList.push(stripQuotes(listMatch[1].trim()));
        nextIndex += 1;
      }

      result[key] = tagsFromList;
      index = nextIndex;
      continue;
    }

    result[key] = parseFrontmatterValue(value);
    index += 1;
  }

  return result;
}

function parseFrontmatterValue(rawValue: string): string | string[] {
  if (!rawValue.startsWith('[') || !rawValue.endsWith(']')) {
    return stripQuotes(rawValue);
  }

  const listBody = rawValue.slice(1, -1).trim();

  if (!listBody) {
    return [];
  }

  return listBody
    .split(',')
    .map((value) => stripQuotes(value.trim()))
    .filter(Boolean);
}

function validatePostFrontmatter(frontmatter: Record<string, unknown>, sourcePath: string): PostFrontmatter {
  const title = expectNonEmptyString(frontmatter.title, 'title', sourcePath);
  const slug = expectSlug(frontmatter.slug, sourcePath);
  const date = expectIsoDate(frontmatter.date, sourcePath);
  const theme = expectOptionalTheme(frontmatter.theme, sourcePath);
  const tags = expectTagArray(frontmatter.tags, sourcePath);
  const summary = expectNonEmptyString(frontmatter.summary, 'summary', sourcePath);
  const status = expectStatus(frontmatter.status, sourcePath);

  return {
    title,
    slug,
    date,
    theme,
    tags,
    summary,
    status
  };
}

function expectNonEmptyString(value: unknown, field: string, sourcePath: string): string {
  if (typeof value !== 'string') {
    throw new ContentValidationError(`${field} 必须是 string`, sourcePath, field);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new ContentValidationError(`${field} 不能为空`, sourcePath, field);
  }

  return normalized;
}

function expectSlug(value: unknown, sourcePath: string): string {
  const slug = expectNonEmptyString(value, 'slug', sourcePath);

  if (!SLUG_REGEXP.test(slug)) {
    throw new ContentValidationError(
      'slug 必须匹配 /^[a-z0-9]+(?:-[a-z0-9]+)*$/',
      sourcePath,
      'slug'
    );
  }

  return slug;
}

function expectIsoDate(value: unknown, sourcePath: string): string {
  const dateText = expectNonEmptyString(value, 'date', sourcePath);

  if (!DATE_REGEXP.test(dateText)) {
    throw new ContentValidationError('date 必须是 YYYY-MM-DD 格式', sourcePath, 'date');
  }

  const [yearText, monthText, dayText] = dateText.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new ContentValidationError('date 不是有效日历日期', sourcePath, 'date');
  }

  return dateText;
}

function expectOptionalTheme(value: unknown, sourcePath: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ContentValidationError('theme 必须是 string', sourcePath, 'theme');
  }

  const normalized = value.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return undefined;
  }

  return normalized;
}

function expectTagArray(value: unknown, sourcePath: string): string[] {
  if (!Array.isArray(value)) {
    throw new ContentValidationError('tags 必须是 string[]', sourcePath, 'tags');
  }

  const normalizedSet = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') {
      throw new ContentValidationError('tags 数组元素必须是 string', sourcePath, 'tags');
    }

    const normalized = normalizeTag(item);

    if (!TAG_REGEXP.test(normalized)) {
      throw new ContentValidationError(
        'tag 必须匹配 /^[a-z0-9]+(?:-[a-z0-9]+)*$/',
        sourcePath,
        'tags'
      );
    }

    normalizedSet.add(normalized);
  }

  if (normalizedSet.size === 0) {
    throw new ContentValidationError('tags 至少需要一个有效标签', sourcePath, 'tags');
  }

  return Array.from(normalizedSet);
}

function expectStatus(value: unknown, sourcePath: string): PostFrontmatter['status'] {
  if (value === 'draft' || value === 'published') {
    return value;
  }

  throw new ContentValidationError('status 必须是 draft 或 published', sourcePath, 'status');
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function countPlainTextChars(markdown: string): number {
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\r\n]*`/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return plainText.replace(/\s+/g, '').length;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function reportValidationError(error: unknown, sourcePath: string): void {
  if (error instanceof ContentValidationError) {
    console.error(`[content] Skip invalid post: ${error.sourcePath} - ${error.message}`);
    return;
  }

  if (error instanceof Error) {
    console.error(`[content] Skip invalid post: ${sourcePath} - ${error.message}`);
    return;
  }

  console.error(`[content] Skip invalid post: ${sourcePath}`);
}

function toSummary(post: PostDetail): PostSummary {
  return {
    title: post.title,
    slug: post.slug,
    date: post.date,
    theme: post.theme,
    tags: [...post.tags],
    summary: post.summary,
    coverImageUrl: post.coverImageUrl,
    featuredOrder: post.featuredOrder
  };
}

function normalizeRemoteSummary(summary: PostSummary): PostSummary {
  return {
    title: summary.title.trim(),
    slug: summary.slug.trim(),
    date: summary.date.trim(),
    theme: summary.theme?.trim() || undefined,
    tags: summary.tags.map((tag) => tag.trim()).filter(Boolean),
    summary: summary.summary.trim(),
    coverImageUrl: summary.coverImageUrl?.trim() || undefined,
    featuredOrder: typeof summary.featuredOrder === 'number' ? summary.featuredOrder : undefined
  };
}

function normalizeRemoteDetail(detail: PostDetail): PostDetail {
  return {
    ...normalizeRemoteSummary(detail),
    status: detail.status,
    contentMarkdown: detail.contentMarkdown,
    contentHtml: detail.contentHtml
  };
}

function buildPostFingerprint(posts: PostDetail[]): string {
  return posts
    .map((post) =>
      [
        post.slug,
        post.date,
        post.summary,
        post.coverImageUrl ?? '',
        post.featuredOrder ?? '',
        post.status,
        post.contentHtml.length,
        post.contentMarkdown.length
      ].join('|')
    )
    .join('||');
}
