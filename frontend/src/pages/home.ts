import { renderHomeIntroPanel } from '../components/home-intro-panel';
import { renderPostList } from '../components/post-list';
import { loadPosts } from '../data/posts';
import type { PageRenderer } from '../types/router';

export const renderHomePage: PageRenderer = () => {
  const latestPosts = loadPosts().slice(0, 5);

  return `
<section class="page page-home">
  ${renderHomeIntroPanel()}
  <div class="section-head">
    <h2>精选 · 最新</h2>
    <a href="/posts" data-link class="tag-detail-back-link">查看全部</a>
  </div>
  ${renderPostList(latestPosts, { emptyHint: '还没有已发布文章，先去写第一篇吧。', variant: 'home' })}
</section>
`;
};
