import type { PageRenderer } from '../types/router';

export const renderHomePage: PageRenderer = () => `
<main>
  <h1>首114514页（占位）</h1>
  <p>Personal Blog 前端最小骨架已完成，可继续接入 Markdown 内容。</p>
  <ul>
    <li><a href="/posts" data-link>查看文章列表</a></li>
    <li><a href="/tags" data-link>查看标签页</a></li>
  </ul>
</main>
`;
