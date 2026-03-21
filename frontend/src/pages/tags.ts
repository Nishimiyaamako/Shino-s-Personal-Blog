import { renderPostList } from '../components/post-list';
import { getPostsByTag, getTagStats } from '../data/posts';
import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

const TAG_COLOR_VARIANTS = ['strawberry', 'bubble', 'mauve'] as const;

export const renderTagsPage: PageRenderer = () => {
  const tagStats = getTagStats();
  const countList = tagStats.map(({ count }) => count);
  const minCount = countList.length ? Math.min(...countList) : 0;
  const maxCount = countList.length ? Math.max(...countList) : 0;

  return `
<section class="page page-tags">
  ${tagStats.length
      ? `<section class="tag-filter-shell">
          <section class="tag-cloud-section" aria-label="标签云">
            <ul class="tag-cloud">
              ${tagStats
        .map(
          ({ tag, count }, index) =>
            `<li>
                      <button
                        type="button"
                        class="tag-bubble"
                        data-tag="${escapeHtml(tag)}"
                        data-count="${count}"
                        data-size="${resolveTagSize(count, minCount, maxCount)}"
                        data-color="${TAG_COLOR_VARIANTS[index % TAG_COLOR_VARIANTS.length]}"
                        style="--i: ${index}"
                      >
                        <span class="tag-name">#${escapeHtml(tag)}</span>
                        <span class="tag-count">${count}</span>
                      </button>
                  </li>`
        )
        .join('')}
            </ul>
          </section>
        </section>

        <section class="tag-result-shell">
          <section class="tag-posts-panel" data-role="tag-posts-panel" aria-live="polite" aria-hidden="true" hidden>
            <header class="tag-posts-panel-header">
              <div class="tag-posts-panel-title-group">
                <h2 class="tag-posts-panel-title" data-role="tag-posts-title"></h2>
                <p class="tag-posts-panel-meta" data-role="tag-posts-meta"></p>
              </div>
              <button
                type="button"
                class="tag-posts-panel-close"
                data-role="tag-posts-close"
                aria-label="关闭标签文章面板"
              >
                ×
              </button>
            </header>
            <div class="tag-posts-panel-body" data-role="tag-posts-content"></div>
          </section>
        </section>

        <div class="tag-posts-templates" aria-hidden="true">
          ${tagStats
        .map(
          ({ tag }) => `
            <template data-tag-template="${escapeHtml(tag)}">
              ${renderPostList(getPostsByTag(tag), { emptyHint: '当前标签下暂无已发布文章。', variant: 'tag-panel' })}
            </template>`
        )
        .join('')}
        </div>`
      : '<p class="empty-hint">暂无标签。</p>'
    }
</section>
`;
};

function resolveTagSize(count: number, minCount: number, maxCount: number): number {
  if (maxCount <= minCount) {
    return 3;
  }

  const normalizedCount = (count - minCount) / (maxCount - minCount);
  return Math.max(1, Math.min(5, Math.round(normalizedCount * 4) + 1));
}
