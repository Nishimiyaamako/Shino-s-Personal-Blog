import { getTagStats } from '../data/posts';
import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

export const renderTagsPage: PageRenderer = () => {
  const tagStats = getTagStats();

  return `
<section class="page page-tags">
  <header class="page-header">
    <h1>标签</h1>
    <p>按文章数量排序。</p>
  </header>

  ${
    tagStats.length
      ? `<ul class="stats-list">
          ${tagStats
            .map(
              ({ tag, count }) =>
                `<li><a href="/tags/${tag}" data-link>#${escapeHtml(tag)}</a> <span>${count} 篇</span></li>`
            )
            .join('')}
        </ul>`
      : '<p class="empty-hint">暂无标签。</p>'
  }
</section>
`;
};
