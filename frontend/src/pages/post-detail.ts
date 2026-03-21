import { getPostBySlug } from '../data/posts';
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
  <p><a href="/posts" data-link>返回文章列表</a></p>
</section>
`;
  }

  return `
<article class="page page-post-detail">
  <header class="page-header">
    <h1>${escapeHtml(post.title)}</h1>
    <p class="post-meta">
      <time datetime="${post.date}">${formatDateLabel(post.date)}</time>
      <span> · </span>
      <span>${post.tags.map((tag) => `#${escapeHtml(tag)}`).join(' / ')}</span>
    </p>
    <p>${escapeHtml(post.summary)}</p>
  </header>

  <div class="post-detail-layout">
    <section class="markdown-content">
      ${post.contentHtml}
    </section>
  </div>
</article>
`;
};
