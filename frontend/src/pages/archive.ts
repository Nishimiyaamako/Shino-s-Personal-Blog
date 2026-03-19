import { getArchiveTimeline } from '../data/posts';
import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

export const renderArchivePage: PageRenderer = () => {
  const archiveTimeline = getArchiveTimeline();
  const timelineGroupsHtml = archiveTimeline.years
    .map(
      (yearGroup, yearIndex) => `
      <section class="archive-year-group" style="--yi: ${yearIndex}">
        <div class="archive-year-marker">
          <span class="archive-year-dot" aria-hidden="true"></span>
          <h2 class="archive-year-label">${yearGroup.year}</h2>
          <span class="archive-year-count">${yearGroup.posts.length} 篇</span>
        </div>
        <div class="archive-posts-container">
          ${yearGroup.posts
            .map((post, postIndex) => {
              const sideClass = post.month % 2 === 1 ? 'is-left' : 'is-right';
              const monthText = String(post.month).padStart(2, '0');
              const dayText = String(post.day).padStart(2, '0');

              return `
              <article class="archive-post-item ${sideClass}" style="--pi: ${postIndex}">
                <div class="archive-post-card">
                  <time class="archive-post-date" datetime="${post.date}">${monthText}-${dayText}</time>
                  <a class="archive-post-link" href="/posts/${escapeHtml(post.slug)}" data-link>${escapeHtml(post.title)}</a>
                </div>
                <span class="archive-post-dot" aria-hidden="true"></span>
              </article>`;
            })
            .join('')}
        </div>
      </section>`
    )
    .join('');

  return `
<section class="page page-archive">
  <header class="page-header">
    <p>共 ${archiveTimeline.totalPosts} 篇文章，记录一路走过的脚印。</p>
  </header>
  ${
    archiveTimeline.years.length
      ? `<section class="archive-timeline" aria-label="文章归档时间线">
          ${timelineGroupsHtml}
          <p class="archive-timeline-end"><span class="archive-timeline-end-dot" aria-hidden="true"></span><span>故事从这里开始</span></p>
        </section>`
      : '<p class="empty-hint">暂无归档内容，第一篇故事正在路上。</p>'
  }
</section>
`;
};
