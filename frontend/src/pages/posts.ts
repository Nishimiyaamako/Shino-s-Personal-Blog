import { renderPostList } from '../components/post-list';
import { loadPosts } from '../data/posts';
import type { PageRenderer } from '../types/router';

export const renderPostsPage: PageRenderer = () => {
  const posts = loadPosts();

  return `
<section class="page page-posts">
  ${renderPostList(posts, { emptyHint: '暂无已发布文章。', variant: 'posts' })}
</section>
`;
};
