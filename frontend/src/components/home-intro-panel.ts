import { HOME_INTRO_PANEL_CONFIG } from '../data/home-intro-panel';
import type { HomeTechStackItem, HomeTechStackKey } from '../types/home-intro-panel';
import { escapeHtml } from '../utils/escape-html';

const TECH_GLYPH_MAP: Record<HomeTechStackKey, string> = {
  typescript: 'TS',
  javascript: 'JS',
  vite: 'VT',
  bun: 'BN',
  elysia: 'EL',
  nodejs: 'ND',
  docker: 'DK',
  nginx: 'NX',
  linux: 'LX',
  postgresql: 'PG',
  redis: 'RD',
  tailwind: 'TW'
};

export function renderHomeIntroPanel(): string {
  const { facts, techStack, hobbies } = HOME_INTRO_PANEL_CONFIG;

  return `
<section class="home-intro-panel page-section" aria-label="个人信息展示板">
  <div class="home-intro-panel-grid">
    <dl class="home-intro-fact-list" aria-label="基础信息">
      ${facts
        .map(
          (item) => `
        <div class="home-intro-fact-row">
          <dt>${escapeHtml(item.label)}</dt>
          <dd>${escapeHtml(item.value)}</dd>
        </div>`
        )
        .join('')}
    </dl>

    <div class="home-intro-side">
      <section class="home-intro-tech" aria-label="掌握技术栈">
        <p class="home-intro-side-title">Tech Stack · 技术栈</p>
        ${renderTechStackWindow(techStack)}
      </section>

      <section class="home-intro-hobby" aria-label="爱好">
        <p class="home-intro-side-title">Hobbies · 爱好</p>
        <ul class="home-intro-hobby-list">
          ${hobbies
            .map(
              (hobby) =>
                `<li class="home-intro-hobby-item"><span>${escapeHtml(hobby)}</span></li>`
            )
            .join('')}
        </ul>
      </section>
    </div>
  </div>
</section>
`;
}

function renderTechStackWindow(techStack: HomeTechStackItem[]): string {
  if (!techStack.length) {
    return '<p class="empty-hint">技术栈正在整理中。</p>';
  }

  return `
<div class="home-intro-tech-window" role="region" aria-label="技术栈循环窗口">
  <div class="home-intro-tech-track">
    ${renderTechStackList(techStack)}
    ${renderTechStackList(techStack, { clone: true })}
  </div>
</div>`;
}

function renderTechStackList(techStack: HomeTechStackItem[], options: { clone?: boolean } = {}): string {
  const cloneAttr = options.clone ? ' aria-hidden="true"' : '';

  return `
<ul class="home-intro-tech-list"${cloneAttr}>
  ${techStack
    .map(
      (stack) => `
    <li class="home-intro-tech-item">
      <span class="home-intro-tech-badge" data-tech="${escapeHtml(stack.key)}" title="${escapeHtml(stack.label)}">
        ${renderTechStackIcon(stack.key)}
        <span class="home-intro-visually-hidden">${escapeHtml(stack.label)}</span>
      </span>
    </li>`
    )
    .join('')}
</ul>`;
}

function renderTechStackIcon(key: HomeTechStackKey): string {
  const glyph = TECH_GLYPH_MAP[key];

  return `<svg class="home-intro-tech-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="1.4"></rect>
    <text x="12" y="15" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor">${glyph}</text>
  </svg>`;
}
