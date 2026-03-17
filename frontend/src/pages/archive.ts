import type { PageRenderer } from '../types/router';

/**
 * 渲染“归档”页面（占位版）。
 *
 * 用于展示文章按时间分组后的列表。
 * 当前先提供最小可运行的占位内容。
 */
export const renderArchivePage: PageRenderer = () => `
<main>
  <h1>归档页（占位）</h1>
  <p>后续这里会按照年月组织文章归档。</p>
</main>
`;
