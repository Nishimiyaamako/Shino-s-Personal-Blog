import { getTagStats } from '../data/posts';
import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';
import { resolveTagColorVariant } from '../utils/tag-color';

const TAG_POSTS_PANEL_ID = 'tag-posts-panel';
const TAG_POSTS_PANEL_TITLE_ID = 'tag-posts-panel-title';

export const renderTagsPage: PageRenderer = () => {
  const tagStats = getTagStats();
  const countList = tagStats.map(({ count }) => count);
  const minCount = countList.length ? Math.min(...countList) : 0;
  const maxCount = countList.length ? Math.max(...countList) : 0;

  return `
<section class="page page-tags">
  ${tagStats.length
      ? `<section class="tag-filter-shell">
          <header class="tag-filter-head">
            <h1>标签总览</h1>
            <p>点击标签可在本页展开对应文章列表。</p>
          </header>
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
                        data-color="${resolveTagColorVariant(tag)}"
                        aria-pressed="false"
                        aria-expanded="false"
                        aria-controls="${TAG_POSTS_PANEL_ID}"
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
          <section
            id="${TAG_POSTS_PANEL_ID}"
            class="tag-posts-panel"
            data-role="tag-posts-panel"
            role="region"
            aria-live="polite"
            aria-labelledby="${TAG_POSTS_PANEL_TITLE_ID}"
            aria-hidden="true"
            hidden
          >
            <header class="tag-posts-panel-header">
              <div class="tag-posts-panel-title-group">
                <h2 id="${TAG_POSTS_PANEL_TITLE_ID}" class="tag-posts-panel-title" data-role="tag-posts-title"></h2>
                <p class="tag-posts-panel-meta" data-role="tag-posts-meta"></p>
              </div>
              <button
                type="button"
                class="tag-posts-panel-close"
                data-role="tag-posts-close"
                aria-label="关闭标签文章面板"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
                </svg>
              </button>
            </header>
            <div class="tag-posts-panel-body" data-role="tag-posts-content"></div>
          </section>
        </section>`
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
