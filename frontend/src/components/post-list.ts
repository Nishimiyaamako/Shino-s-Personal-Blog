import type { PostSummary } from '../types/content';
import { escapeHtml } from '../utils/escape-html';
import { formatDateLabel } from '../utils/date';

type PostListVariant = 'default' | 'home' | 'posts' | 'tag-panel';

interface RenderPostListOptions {
  emptyHint?: string;
  variant?: PostListVariant;
}

const COVER_IMAGE_ONLOAD_HANDLER =
  "const article = this.closest('.post-card-article'); if (article) { article.classList.add('has-cover'); article.classList.remove('no-cover'); } if (this.parentElement) { this.parentElement.classList.add('has-cover'); this.parentElement.classList.remove('is-pending'); } this.classList.remove('is-pending'); this.classList.remove('is-hidden');";
const COVER_IMAGE_ONERROR_HANDLER =
  "const article = this.closest('.post-card-article'); if (article) { article.classList.remove('has-cover'); article.classList.add('no-cover'); } if (this.parentElement) { this.parentElement.classList.remove('has-cover'); this.parentElement.classList.remove('is-pending'); } this.classList.add('is-hidden'); this.classList.remove('is-pending'); this.onerror = null;";

function renderCoverImage(coverUrl: string): string {
  // 防回归：不要在初始态用 display:none 隐藏 lazy 图片，否则可能永远不触发加载。
  return `<img class="post-card-cover-image is-pending" src="${escapeHtml(coverUrl)}" alt="" loading="lazy" decoding="async" onload="${COVER_IMAGE_ONLOAD_HANDLER}" onerror="${COVER_IMAGE_ONERROR_HANDLER}" />`;
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
      .map((post, index) => {
        const isHomeVariant = variant === 'home';
        const coverUrl = `/images/covers/${post.slug}.webp`;
        const coverImage = renderCoverImage(coverUrl);
        const cardClassName = `post-card post-card--${variant}${isHomeVariant ? ' onload-animation' : ''}`;
        const cardStyle = isHomeVariant ? ` style="--onload-delay: ${80 + index * 50}ms;"` : '';

        if (isHomeVariant) {
          return `
  <li class="${cardClassName}"${cardStyle}>
    <article class="post-card-article post-card-home-article">
      <div class="post-card-body">
        <header class="post-card-header">
          <h3 class="post-card-title"><a href="/posts/${post.slug}" data-link>${escapeHtml(post.title)}</a></h3>
          <time class="post-card-date" datetime="${post.date}">${formatDateLabel(post.date)}</time>
        </header>
        <p class="post-card-summary">${escapeHtml(post.summary)}</p>
        <ul class="tag-list">
          ${post.tags
              .map((tag) => `<li><a href="/tags/${tag}" data-link>#${escapeHtml(tag)}</a></li>`)
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
  <li class="${cardClassName}"${cardStyle}>
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
      <ul class="tag-list">
        ${post.tags
            .map((tag) => `<li><a href="/tags/${tag}" data-link>#${escapeHtml(tag)}</a></li>`)
            .join('')}
      </ul>
      </div>
    </article>
  </li>`;
      })
      .join('')}
</ul>`;
}
