import type { PageRenderer } from '../types/router';

export const renderAboutPage: PageRenderer = () => `
<section class="page page-about">
  <header class="page-header">
    <h1>关于</h1>
    <p>这是一个由 Vite + TypeScript 构建的个人博客实验场。</p>
  </header>

  <section class="page-section">
    <h2>写作方向</h2>
    <p>以工程实践、学习笔记、个人思考为主，追求结构清晰与长期可维护。</p>
  </section>

  <section class="page-section">
    <h2>当前阶段</h2>
    <p>第一阶段聚焦内容本体与页面结构，后续再逐步接入搜索、评论和后台能力。</p>
  </section>
</section>
`;
