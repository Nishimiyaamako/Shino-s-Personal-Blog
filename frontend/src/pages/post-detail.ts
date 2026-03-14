import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

export const renderPostDetailPage: PageRenderer = ({ params }) => {
  const slug = escapeHtml(params.slug ?? '');

  return `
<main>
  <h1>文章详情（占位）</h1>
  <p>当前文章 slug：<code>${slug || '(empty)'}</code></p>
  <p><a href="/posts" data-link>返回文章列表</a></p>
</main>
`;
};
