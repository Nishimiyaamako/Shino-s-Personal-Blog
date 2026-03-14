import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

export const renderTagDetailPage: PageRenderer = ({ params }) => {
  const tag = escapeHtml(params.tag ?? '');

  return `
<main>
  <h1>标签详情（占位）</h1>
  <p>当前标签：<code>${tag || '(empty)'}</code></p>
  <p><a href="/tags" data-link>返回标签总览</a></p>
</main>
`;
};
