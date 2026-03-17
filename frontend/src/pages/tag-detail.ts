import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

/**
 * 渲染标签详情页（占位版）。
 *
 * @param params 路由参数对象，预期包含 tag
 * @returns 标签详情页面 HTML 字符串
 *
 * 后续可以在这里根据 tag 过滤并展示对应文章列表。
 */
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
