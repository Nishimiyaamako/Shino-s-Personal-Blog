import type { PageRenderer } from '../types/router';

export const renderTagsPage: PageRenderer = () => `
<main>
  <h1>标签总览（占位）</h1>
  <p>后续这里会展示所有标签及对应文章数量。</p>
  <ul>
    <li><a href="/tags/typescript" data-link>/tags/typescript</a></li>
    <li><a href="/tags/engineering" data-link>/tags/engineering</a></li>
  </ul>
</main>
`;
