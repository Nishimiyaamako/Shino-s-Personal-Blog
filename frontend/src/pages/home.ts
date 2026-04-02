import { renderPostList } from '../components/post-list';
import { loadHomeFeaturedPosts } from '../data/posts';
import type { PageRenderer } from '../types/router';

export const renderHomePage: PageRenderer = () => {
  const latestPosts = loadHomeFeaturedPosts(5);

  return `
<section class="page page-home">
  <div class="section-head">
    <h2>精选 · 最新</h2>
    <a href="/posts" data-link class="tag-detail-back-link">查看全部</a>
  </div>
  <div data-role="home-featured-list">
    ${renderPostList(latestPosts, { emptyHint: '还没有已发布文章，先去写第一篇吧。', variant: 'home' })}
  </div>
</section>
`;
};
