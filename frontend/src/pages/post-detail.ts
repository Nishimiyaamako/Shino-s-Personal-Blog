import { getPostBySlug } from '../data/posts';
import type { PostDetail } from '../types/content';
import type { PageRenderer } from '../types/router';
import { formatDateLabel } from '../utils/date';
import { escapeHtml } from '../utils/escape-html';

export const renderPostDetailPage: PageRenderer = ({ params }) => {
  const slug = params.slug ?? '';
  const post = getPostBySlug(slug);

  if (!post) {
    return `
<section class="page page-not-found">
  <h1>404 - 页面未找到</h1>
  <p>未匹配到文章：<code>${escapeHtml(slug)}</code></p>
  <p><a href="/blog" data-link>返回文章列表</a></p>
</section>
`;
  }

  return renderPostDetailBody(post);
};

export function renderPostDetailBody(post: PostDetail): string {
  return `
<article class="page page-post-detail" data-role="post-detail-page" data-post-slug="${escapeHtml(post.slug)}">
  <header class="page-header" data-role="post-detail-header">
    <h1>${escapeHtml(post.title)}</h1>
    <p class="post-meta">
      <time datetime="${post.date}">${formatDateLabel(post.date)}</time>
      <span> · </span>
      <span>${post.tags.map((tag) => `#${escapeHtml(tag)}`).join(' / ')}</span>
    </p>
    <p>${escapeHtml(post.summary)}</p>
  </header>

  <div class="post-detail-back-row">
    <button type="button" class="post-detail-back-button" data-role="post-detail-back" aria-label="返回上一页">
      ← 返回
    </button>
  </div>

  <div class="post-detail-layout">
    <section class="markdown-content" data-role="post-detail-markdown">
      ${post.contentHtml}
    </section>
  </div>
</article>
`;
}
