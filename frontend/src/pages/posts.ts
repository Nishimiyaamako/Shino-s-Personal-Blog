import { renderPostList } from '../components/post-list';
import { loadPosts } from '../data/posts';
import type { PageRenderer } from '../types/router';

export const renderPostsPage: PageRenderer = () => {
  const posts = loadPosts();

  return `
<section class="page page-posts">
  <header class="page-header">
    <h1>文章</h1>
    <p>按发布日期倒序展示，仅包含已发布内容。</p>
  </header>

  ${renderPostList(posts, { emptyHint: '暂无已发布文章。' })}
</section>
`;
};
