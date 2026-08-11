import { renderProfileContactList } from '../components/profile-card';
import { loadAboutViewModel } from '../data/about';
import { loadProfileCardConfig } from '../data/profile-card';
import { loadSiteConfig } from '../data/site-config';
import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

interface LandingSectionEntry {
  href: string;
  title: string;
  description: string;
  icon: string;
}

const LANDING_SECTIONS: readonly LandingSectionEntry[] = [
  {
    href: '/blog',
    title: '博客',
    description: '全部文章，支持主题筛选与日期排序。',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4.5" /></svg>'
  },
  {
    href: '/blog/archive',
    title: '归档',
    description: '按年份回顾所有写过的东西。',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4" width="17" height="5" rx="1.5" /><path d="M5.5 9v9.5A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5V9" /><path d="M10 13h4" /></svg>'
  },
  {
    href: '/blog/tags',
    title: '标签',
    description: '按标签浏览，快速找到感兴趣的话题。',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12.5 12.5 20a2 2 0 0 1-2.8 0L3 13.3V4h9.3l7.7 7.7a2 2 0 0 1 0 2.8Z" /><circle cx="8.4" cy="8.4" r="1.3" /></svg>'
  },
  {
    href: '/friends',
    title: '友链',
    description: '认识我的朋友们，也欢迎交换链接。',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="9" r="2.6" /><circle cx="16.2" cy="8.3" r="2.2" /><path d="M3.8 18.8a4.8 4.8 0 0 1 8.4 0" /><path d="M13 18.8a4.1 4.1 0 0 1 7.2 0" /></svg>'
  },
  {
    href: '/about',
    title: '关于',
    description: '关于我、这个站点以及它背后的故事。',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 10.2v6.2" /><circle cx="12" cy="7.4" r=".8" fill="currentColor" stroke="none" /></svg>'
  }
];

export const renderLandingPage: PageRenderer = () => {
  const siteConfig = loadSiteConfig();
  const profile = loadProfileCardConfig();
  const about = loadAboutViewModel();

  const slogan = (typeof siteConfig.slogan === 'string' ? siteConfig.slogan.trim() : '')
    || (siteConfig.siteSubtitle.trim() || profile.bio);
  const aboutPreviewParagraphs = about.introParagraphs.filter((paragraph) => paragraph.trim()).slice(0, 2);
  const aboutPreviewHtml = aboutPreviewParagraphs.length
    ? aboutPreviewParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')
    : '<p>关于我还在建设中，先去博客逛逛吧。</p>';

  return `
<section class="page page-landing">
  <div class="landing-hero">
    <img class="landing-hero-avatar" src="${escapeHtml(profile.avatar)}" alt="${escapeHtml(profile.name)} 的头像" />
    <p class="landing-hero-eyebrow">Personal Blog</p>
    <h1 class="landing-hero-title">${escapeHtml(siteConfig.siteTitle)}</h1>
    <p class="landing-hero-slogan">${escapeHtml(slogan)}</p>
    <div class="landing-hero-actions">
      <a class="landing-cta landing-cta--primary" href="/blog" data-link>进入博客</a>
      <a class="landing-cta landing-cta--ghost" href="/about" data-link>关于</a>
    </div>
  </div>

  <div class="landing-sections">
    ${LANDING_SECTIONS.map((section) => `
      <a class="landing-section-card" href="${section.href}" data-link>
        <span class="landing-section-icon" aria-hidden="true">${section.icon}</span>
        <span class="landing-section-copy">
          <strong class="landing-section-title">${section.title}</strong>
          <span class="landing-section-description">${escapeHtml(section.description)}</span>
        </span>
      </a>
    `).join('')}
  </div>

  <section class="landing-about-preview" aria-label="关于摘要">
    <header class="landing-section-head">
      <h2>关于</h2>
      <a href="/about" data-link>完整介绍 →</a>
    </header>
    <div class="landing-about-preview-body">
      ${aboutPreviewHtml}
    </div>
  </section>

  <section class="landing-social" aria-label="社交关注">
    <header class="landing-section-head">
      <h2>社交关注</h2>
    </header>
    ${renderProfileContactList()}
  </section>
</section>
`;
};
