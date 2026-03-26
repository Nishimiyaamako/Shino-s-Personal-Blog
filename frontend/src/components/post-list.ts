import type { PostSummary } from '../types/content';
import { escapeHtml } from '../utils/escape-html';
import { formatDateLabel } from '../utils/date';
import { normalizeThemeKey } from '../utils/theme';

type PostListVariant = 'default' | 'home' | 'posts' | 'tag-panel';

interface RenderPostListOptions {
  emptyHint?: string;
  variant?: PostListVariant;
  prioritizedTag?: string;
  maxVisibleTags?: number;
}

interface VisiblePostLabelItem {
  kind: 'theme' | 'tag';
  label: string;
  themeKey?: string;
}

const COVER_IMAGE_ONLOAD_HANDLER =
  "const article = this.closest('.post-card-article'); if (article) { article.classList.add('has-cover'); article.classList.remove('no-cover'); } if (this.parentElement) { this.parentElement.classList.add('has-cover'); this.parentElement.classList.remove('is-pending'); } this.classList.remove('is-pending'); this.classList.remove('is-hidden');";
const COVER_IMAGE_ONERROR_HANDLER =
  "const article = this.closest('.post-card-article'); if (article) { article.classList.remove('has-cover'); article.classList.add('no-cover'); } if (this.parentElement) { this.parentElement.classList.remove('has-cover'); this.parentElement.classList.remove('is-pending'); } this.classList.add('is-hidden'); this.classList.remove('is-pending'); this.onerror = null;";

function renderCoverImage(coverUrl: string): string {
  // 防回归：不要在初始态用 display:none 隐藏 lazy 图片，否则可能永远不触发加载。
  return `<img class="post-card-cover-image is-pending" src="${escapeHtml(coverUrl)}" alt="" loading="lazy" decoding="async" onload="${COVER_IMAGE_ONLOAD_HANDLER}" onerror="${COVER_IMAGE_ONERROR_HANDLER}" />`;
}

function resolvePrioritizedTags(tags: string[], prioritizedTagLabel?: string): string[] {
  const normalizedPrioritizedTag = prioritizedTagLabel?.trim().toLowerCase() ?? '';

  if (!normalizedPrioritizedTag) {
    return [...tags];
  }

  const prioritizedTagIndex = tags.findIndex((tag) => tag.trim().toLowerCase() === normalizedPrioritizedTag);

  if (prioritizedTagIndex === -1) {
    return [...tags];
  }

  const prioritizedTag = tags[prioritizedTagIndex]!;
  const remainingTags = tags.filter((_, index) => index !== prioritizedTagIndex);

  return [prioritizedTag, ...remainingTags];
}

function resolveVisibleLabelItems(
  post: PostSummary,
  options: Pick<RenderPostListOptions, 'prioritizedTag' | 'maxVisibleTags'>
): VisiblePostLabelItem[] {
  const maxVisibleTags = Math.max(0, options.maxVisibleTags ?? 3);

  if (maxVisibleTags === 0) {
    return [];
  }

  const themeLabel = post.theme?.trim() ?? '';
  const normalizedThemeKey = themeLabel ? normalizeThemeKey(themeLabel) : '';
  const prioritizedTags = resolvePrioritizedTags(post.tags, options.prioritizedTag);
  const dedupedTags = normalizedThemeKey
    ? prioritizedTags.filter((tag) => normalizeThemeKey(tag) !== normalizedThemeKey)
    : prioritizedTags;
  const labelItems: VisiblePostLabelItem[] = [];

  if (themeLabel) {
    labelItems.push({
      kind: 'theme',
      label: themeLabel,
      themeKey: normalizedThemeKey
    });
  }

  for (const tag of dedupedTags) {
    if (labelItems.length >= maxVisibleTags) {
      break;
    }

    labelItems.push({
      kind: 'tag',
      label: tag
    });
  }

  return labelItems;
}

export function renderPostList(posts: PostSummary[], options: RenderPostListOptions = {}): string {
  if (posts.length === 0) {
    return `<p class="empty-hint">${escapeHtml(options.emptyHint ?? '暂无文章。')}</p>`;
  }

  const variant = options.variant ?? 'default';
  const listClassName = `post-list post-list--${variant}`;

  return `
<ul class="${listClassName}">
  ${posts
      .map((post) => {
        const isHomeVariant = variant === 'home';
        const coverUrl = `/images/covers/${post.slug}.webp`;
        const coverImage = renderCoverImage(coverUrl);
        const cardClassName = `post-card post-card--${variant}`;
        const visibleLabelItems = resolveVisibleLabelItems(post, options);
        const postThemeKey = post.theme ? normalizeThemeKey(post.theme) : '';
        const postThemeAttribute = postThemeKey ? ` data-post-theme-key="${escapeHtml(postThemeKey)}"` : '';

        if (isHomeVariant) {
          return `
  <li class="${cardClassName}" data-motion-card${postThemeAttribute}>
    <article class="post-card-article post-card-home-article">
      <div class="post-card-body">
        <header class="post-card-header">
          <h3 class="post-card-title"><a href="/posts/${post.slug}" data-link>${escapeHtml(post.title)}</a></h3>
          <time class="post-card-date" datetime="${post.date}">${formatDateLabel(post.date)}</time>
        </header>
        <p class="post-card-summary">${escapeHtml(post.summary)}</p>
        <ul class="tag-list tag-list--card">
          ${visibleLabelItems
              .map((item) =>
                item.kind === 'theme'
                  ? `<li><a class="tag-chip tag-chip--theme" href="/posts${item.themeKey ? `?theme=${encodeURIComponent(item.themeKey)}` : ''}" data-link${item.themeKey ? ` data-theme-key="${escapeHtml(item.themeKey)}"` : ''} aria-label="查看主题分类：${escapeHtml(item.label)}">${escapeHtml(item.label)}</a></li>`
                  : `<li><a href="/tags/${item.label}" data-link>#${escapeHtml(item.label)}</a></li>`
              )
              .join('')}
        </ul>
      </div>
      <a class="post-card-home-cover" href="/posts/${post.slug}" data-link aria-label="阅读：${escapeHtml(post.title)}">
        ${coverImage}
      </a>
    </article>
  </li>`;
        }

        const coverClassName = 'post-card-cover is-pending';

        return `
  <li class="${cardClassName}" data-motion-card${postThemeAttribute}>
    <article class="post-card-article">
      <a class="${coverClassName}" href="/posts/${post.slug}" data-link aria-label="阅读：${escapeHtml(post.title)}">
        ${coverImage}
        <span class="post-card-cover-placeholder" aria-hidden="true">${escapeHtml((post.tags[0] ?? 'post').toUpperCase())}</span>
      </a>
      <div class="post-card-body">
      <header class="post-card-header">
        <h3 class="post-card-title"><a href="/posts/${post.slug}" data-link>${escapeHtml(post.title)}</a></h3>
        <time class="post-card-date" datetime="${post.date}">${formatDateLabel(post.date)}</time>
      </header>
      <p class="post-card-summary">${escapeHtml(post.summary)}</p>
      <ul class="tag-list tag-list--card">
        ${visibleLabelItems
            .map((item) =>
              item.kind === 'theme'
                ? `<li><a class="tag-chip tag-chip--theme" href="/posts${item.themeKey ? `?theme=${encodeURIComponent(item.themeKey)}` : ''}" data-link${item.themeKey ? ` data-theme-key="${escapeHtml(item.themeKey)}"` : ''} aria-label="查看主题分类：${escapeHtml(item.label)}">${escapeHtml(item.label)}</a></li>`
                : `<li><a href="/tags/${item.label}" data-link>#${escapeHtml(item.label)}</a></li>`
            )
            .join('')}
      </ul>
      </div>
    </article>
  </li>`;
      })
      .join('')}
</ul>`;
}
