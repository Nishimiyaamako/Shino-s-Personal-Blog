import type { PageRenderer } from '../types/router';
import { getPostBySlug } from '../data/posts';
import { escapeHtml } from '../utils/escape-html';

/**
 * 渲染文章详情页（Markdown 自动渲染版）。
 *
 * @param params 路由参数对象，预期包含 slug
 * @returns 文章详情页面 HTML 字符串
 */
export const renderPostDetailPage: PageRenderer = ({ params }) => {
  const slug = params.slug ?? '';
  const post = getPostBySlug(slug);

  if (!post) {
    const escapedSlug = escapeHtml(slug);

    return `
<main class="page-stack">
  <section class="home-welcome">
    <h1>文章不存在</h1>
    <p>未找到 slug 为 <code>${escapedSlug || '(empty)'}</code> 的文章。</p>
    <p><a href="/posts" data-link>返回文章列表</a></p>
  </section>
</main>
`;
  }

  const escapedTitle = escapeHtml(post.title);
  const escapedDate = escapeHtml(post.date);
  const escapedTags = post.tags.map(escapeHtml).join(' · ');

  return `
<main class="page-stack">
  <article class="post-article section-card">
    <header class="post-header">
      <h1>${escapedTitle}</h1>
      <p class="post-meta">${escapedDate} · ${escapedTags}</p>
    </header>

    <div class="post-content">
      ${post.html}
    </div>
  </article>

  <p><a href="/posts" data-link>← 返回文章列表</a></p>
</main>
`;
};
