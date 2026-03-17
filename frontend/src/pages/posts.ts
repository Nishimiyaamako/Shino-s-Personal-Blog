import type { PageRenderer } from '../types/router';
import { POSTS } from '../data/posts';
import { escapeHtml } from '../utils/escape-html';

/**
 * 渲染文章列表页（Markdown 自动扫描版）。
 */
export const renderPostsPage: PageRenderer = () => {
  if (POSTS.length === 0) {
    return `
<main class="page-stack">
  <section class="home-welcome">
    <h1>文章列表</h1>
    <p>还没有可展示的文章。你可以把 Markdown 文件放到 <code>src/content/posts/</code> 后重试。</p>
  </section>
</main>
`;
  }

  const postCards = POSTS.map((post) => {
    const title = escapeHtml(post.title);
    const date = escapeHtml(post.date);
    const summary = escapeHtml(post.summary);
    const tags = post.tags.map(escapeHtml).join(' · ');
    const slug = encodeURIComponent(post.slug);

    return `
    <li class="section-card post-card">
      <h2><a class="post-card-link" href="/posts/${slug}" data-link>${title}</a></h2>
      <p class="post-meta">${date} · ${tags}</p>
      <p>${summary}</p>
    </li>
`;
  }).join('');

  return `
<main class="page-stack">
  <section class="home-welcome">
    <h1>文章列表</h1>
    <p>以下内容来自 <code>src/content/posts/</code> 自动扫描。</p>
  </section>

  <ul class="post-list" aria-label="文章列表">
    ${postCards}
  </ul>
</main>
`;
};
