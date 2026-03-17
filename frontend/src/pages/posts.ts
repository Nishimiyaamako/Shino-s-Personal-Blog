import type { PageRenderer } from '../types/router';

export const renderPostsPage: PageRenderer = () => `
<main>
  <h1>文章列表（占位）</h1>
  <p>后续这里会展示 Markdown 文章摘要列表。</p>
  <ul>
    <li><a href="/posts/hello-world" data-link>/posts/hello-world</a></li>
    <li><a href="/posts/first-week-note" data-link>/posts/first-week-note</a></li>
  </ul>
</main>
`;
