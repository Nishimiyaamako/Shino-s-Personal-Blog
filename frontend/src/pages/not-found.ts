import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

export const renderNotFoundPage: PageRenderer = ({ pathname }) => `
<section class="page page-not-found">
  <h1>404 - 页面未找到</h1>
  <p>未匹配到路径：<code>${escapeHtml(pathname)}</code></p>
  <p><a href="/" data-link>返回首页</a></p>
</section>
`;
