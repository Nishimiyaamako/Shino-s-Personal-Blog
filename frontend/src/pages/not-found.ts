import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

/**
 * 渲染 404 页面（未找到页面）。
 *
 * @param pathname 当前未匹配到的路径
 * @returns 404 页面 HTML 字符串
 *
 * 这里会把路径做 HTML 转义，避免把原始字符串直接插入页面造成风险。
 */
export const renderNotFoundPage: PageRenderer = ({ pathname }) => `
<main>
  <h1>404 - 页面未找到</h1>
  <p>未匹配到路径：<code>${escapeHtml(pathname)}</code></p>
  <p><a href="/" data-link>返回首页</a></p>
</main>
`;
