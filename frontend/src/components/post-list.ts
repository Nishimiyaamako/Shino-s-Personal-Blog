import type { PostSummary } from '../types/content';
import { escapeHtml } from '../utils/escape-html';
import { formatDateLabel } from '../utils/date';

export function renderPostList(posts: PostSummary[], options: { emptyHint?: string } = {}): string {
  if (posts.length === 0) {
    return `<p class="empty-hint">${escapeHtml(options.emptyHint ?? '暂无文章。')}</p>`;
  }

  return `
<ul class="post-list">
  ${posts
    .map(
      (post) => `
  <li class="post-card">
    <article>
      <header class="post-card-header">
        <h3><a href="/posts/${post.slug}" data-link>${escapeHtml(post.title)}</a></h3>
        <time datetime="${post.date}">${formatDateLabel(post.date)}</time>
      </header>
      <p>${escapeHtml(post.summary)}</p>
      <ul class="tag-list">
        ${post.tags
          .map((tag) => `<li><a href="/tags/${tag}" data-link>#${escapeHtml(tag)}</a></li>`)
          .join('')}
      </ul>
    </article>
  </li>`
    )
    .join('')}
</ul>`;
}
