import { THEME_ORDER } from '../config/themes';
import {
  type ArchiveStat,
  type ArchiveTimelineData,
  type ArchiveTimelinePost,
  type ArchiveTimelineYear,
  type PostDetail,
  type PostSummary,
  type TagStat,
  type ThemeStat
} from '../types/content';
import { normalizeThemeKey } from '../utils/theme';

const SLUG_REGEXP = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TAG_REGEXP = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  const currentRemotePostMap = new Map((remotePublishedPostCache ?? []).map((post) => [post.slug, post] as const));
  const nextRemotePosts: PostDetail[] = normalizedSummaries.map((summary) => {
    const currentRemotePost = currentRemotePostMap.get(summary.slug);

    if (currentRemotePost) {
      return {
        ...currentRemotePost,
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
  return (remotePublishedPostCache ?? []).filter((post) => post.status === 'published');
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
