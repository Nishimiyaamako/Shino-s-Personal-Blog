import { renderPostList } from '../components/post-list';
import { loadPosts } from '../data/posts';
import type { PageRenderer } from '../types/router';

export const renderHomePage: PageRenderer = () => {
  const latestPosts = loadPosts().slice(0, 5);

  return `
<section class="page page-home">
  <header class="hero-card">
    <p class="eyebrow">Personal Blog</p>
    <h1>你好呀，我在这里记录技术与生活。</h1>
    <p>这是一个内容优先的个人博客：专注清晰表达、持续积累、长期迭代。</p>
  </header>

  <section class="page-section">
    <div class="section-head">
      <h2>最新文章</h2>
      <a href="/posts" data-link>查看全部</a>
    </div>
    ${renderPostList(latestPosts, { emptyHint: '还没有已发布文章，先去写第一篇吧。' })}
  </section>
</section>
`;
};
