import type { PageRenderer } from '../types/router';

/**
 * 渲染标签总览页（占位版）。
 *
 * 用于展示站点所有标签入口，
 * 便于用户按主题浏览文章。
 */
export const renderTagsPage: PageRenderer = () => `
<main>
  <h1>标签总览（占位）</h1>
  <p>后续这里会展示所有标签及对应文章数量。</p>
  <ul>
    <li><a href="/tags/typescript" data-link>/tags/typescript</a></li>
    <li><a href="/tags/engineering" data-link>/tags/engineering</a></li>
  </ul>
</main>
`;
