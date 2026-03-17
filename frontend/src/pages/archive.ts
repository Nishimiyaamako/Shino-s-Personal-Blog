import { getArchiveStats } from '../data/posts';
import type { PageRenderer } from '../types/router';
import { formatArchiveLabel } from '../utils/date';

export const renderArchivePage: PageRenderer = () => {
  const archiveStats = getArchiveStats();

  return `
<section class="page page-archive">
  <header class="page-header">
    <h1>归档</h1>
    <p>按年月统计已发布文章数量。</p>
  </header>

  ${
    archiveStats.length
      ? `<ul class="stats-list">
          ${archiveStats
            .map((archive) => `<li><span>${formatArchiveLabel(archive.key)}</span><span>${archive.count} 篇</span></li>`)
            .join('')}
        </ul>`
      : '<p class="empty-hint">暂无归档内容。</p>'
  }
</section>
`;
};
