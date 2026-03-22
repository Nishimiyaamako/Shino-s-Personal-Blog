import { renderPostList } from '../components/post-list';
import { loadPosts } from '../data/posts';
import type { PageRenderer } from '../types/router';

export const renderPostsPage: PageRenderer = () => {
  const posts = loadPosts();

  return `
<section class="page page-posts">
  <div class="post-theme-filter-shell" data-role="post-theme-filter-shell">
    ${renderPostList(posts, { emptyHint: '暂无已发布文章。', variant: 'posts' })}
    <p class="empty-hint post-theme-empty-hint" data-role="post-theme-empty-hint" hidden>当前主题下暂无已发布文章。</p>
  </div>
</section>
`;
};
