import { renderPostList } from '../components/post-list';
import { getPostsByTag } from '../data/posts';
import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

export const renderTagDetailPage: PageRenderer = ({ params }) => {
  const rawTag = params.tag ?? '';
  const normalizedTag = rawTag.trim().toLowerCase();
  const posts = getPostsByTag(normalizedTag);

  return `
<section class="page page-tag-detail">
  <header class="page-header">
    <h1>#${escapeHtml(normalizedTag || rawTag || '(empty)')}</h1>
    <p>共 ${posts.length} 篇已发布文章。</p>
  </header>

  ${renderPostList(posts, { emptyHint: '当前标签下暂无已发布文章。' })}
</section>
`;
};
