import type { PageRenderer } from '../types/router';

/**
 * 渲染首页（占位版）。
 *
 * 作为站点入口页，提供到文章列表和标签页的快速导航。
 * 返回值是会被 main.ts 注入到 #app 的 HTML 字符串。
 */
export const renderHomePage: PageRenderer = () => `
<main class="page-stack">
  <section class="home-welcome">
    <p class="home-eyebrow">Welcome · 约 2 分钟上手</p>
    <h1>先看到博客骨架价值，再按需扩展功能</h1>
    <p>当前版本已经接好路由、页面壳层和静态导航。你可以先快速浏览内容结构，再逐步接入 Markdown 与真实数据。</p>
    <div class="home-actions">
      <a class="action-button" href="/posts" data-link>开始查看文章结构</a>
      <a class="action-button action-button--ghost" href="/about" data-link>先随便逛逛（可跳过）</a>
    </div>
  </section>

  <section class="section-card" aria-labelledby="quick-start-title">
    <h2 class="section-title" id="quick-start-title">首次上手 3 步</h2>
    <div class="onboard-grid">
      <article class="onboard-step">
        <p class="step-index">STEP 01</p>
        <h3>看页面地图</h3>
        <p>先浏览“文章 / 标签 / 归档”，理解信息层级。</p>
      </article>

      <article class="onboard-step">
        <p class="step-index">STEP 02</p>
        <h3>替换占位文案</h3>
        <p>将首页与列表里的占位文本改成你的内容语气。</p>
      </article>

      <article class="onboard-step">
        <p class="step-index">STEP 03</p>
        <h3>接入 Markdown</h3>
        <p>把文章数据改为 Markdown 源，完成第一篇发布。</p>
      </article>
    </div>
  </section>

  <section class="section-card empty-note">
    <h2 class="section-title">内容已支持自动扫描</h2>
    <p>只要把合规 Markdown 放进 <code>src/content/posts/</code>，文章列表会自动出现。</p>
    <p><a href="/posts" data-link>查看文章列表</a></p>
  </section>
</main>
`;
