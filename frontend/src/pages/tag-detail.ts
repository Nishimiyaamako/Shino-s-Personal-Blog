import { renderPostList } from '../components/post-list';
import { getPostsByTag } from '../data/posts';
import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

export const renderTagDetailPage: PageRenderer = ({ params }) => {
  const rawTag = params.tag ?? '';
  const normalizedTag = rawTag.trim().toLowerCase();
  const posts = getPostsByTag(normalizedTag);
  const displayTag = normalizedTag || rawTag || '(empty)';

  return `
<section class="page page-tag-detail">
  <header class="tag-detail-header">
    <p class="tag-detail-eyebrow">Tag Detail</p>
    <div class="tag-detail-title-row">
      <h1 class="tag-detail-badge">#${escapeHtml(displayTag)}</h1>
      <p class="tag-detail-count">${posts.length} 篇</p>
    </div>
    <a href="/tags" data-link class="tag-detail-back-link">← 返回标签页</a>
  </header>

  ${renderPostList(posts, {
    emptyHint: '当前标签下暂无已发布文章。',
    variant: 'posts',
    prioritizedTag: normalizedTag
  })}
</section>
`;
};
