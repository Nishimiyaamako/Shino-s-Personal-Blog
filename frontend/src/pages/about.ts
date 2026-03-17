import type { PageRenderer } from '../types/router';

/**
 * 渲染“关于”页面（占位版）。
 *
 * 这里先返回静态 HTML 字符串，
 * 后续可以在这里补充作者介绍、联系方式、博客目标等内容。
 */
export const renderAboutPage: PageRenderer = () => `
<main>
  <h1>关于页（占位）</h1>
  <p>这里会放个人介绍、博客理念与联系信息。</p>
</main>
`;
