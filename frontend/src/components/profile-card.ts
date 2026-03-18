import { getPublishedWritingStats } from '../data/posts';
import { PROFILE_CARD_CONFIG } from '../data/profile-card';
import type { ProfilePlatform } from '../types/profile-card';
import { escapeHtml } from '../utils/escape-html';

export function renderProfileCard(): string {
  const profile = PROFILE_CARD_CONFIG;
  const writingStats = getPublishedWritingStats();
  const totalWordsInW = `${(writingStats.wordCount / 10000).toFixed(1)}W`;

  return `
<aside class="profile-card" aria-label="个人资料卡片">
  <div class="profile-card-header">
    <img class="profile-card-avatar" src="${escapeHtml(profile.avatar)}" alt="${escapeHtml(profile.name)} 的头像" />
    <div class="profile-card-meta">
      <h2>${escapeHtml(profile.name)}</h2>
      <p>${escapeHtml(profile.bio)}</p>
    </div>
  </div>

  <ul class="profile-contact-list">
    ${profile.contacts
      .map((contact) => {
        const attrs = getContactAnchorAttrs(contact.href);

        return `
    <li>
      <a href="${escapeHtml(contact.href)}" class="profile-contact-link"${attrs}>
        <span class="profile-contact-platform">
          ${renderPlatformIcon(contact.platform)}
          <span>${escapeHtml(formatPlatform(contact.platform))}</span>
        </span>
        <span class="profile-contact-label">${escapeHtml(contact.label)}</span>
      </a>
    </li>`;
      })
      .join('')}
  </ul>

  <div class="profile-card-divider" aria-hidden="true"></div>

  <section class="profile-stat-grid" aria-label="写作统计">
    <div class="profile-stat-card">
    <p class="profile-stat-label">文章数</p>
    <p class="profile-stat-value">${writingStats.postCount} 篇</p>
    </div>
    <div class="profile-stat-card">
      <p class="profile-stat-label">总字数</p>
      <p class="profile-stat-value">${totalWordsInW}</p>
    </div>
  </section>
</aside>
`;
}

function formatPlatform(platform: ProfilePlatform): string {
  if (platform === 'github') {
    return 'GitHub';
  }

  if (platform === 'bilibili') {
    return 'Bilibili';
  }

  return 'Gmail';
}

function getContactAnchorAttrs(href: string): string {
  if (href.startsWith('mailto:')) {
    return '';
  }

  return ' target="_blank" rel="noopener noreferrer"';
}

function renderPlatformIcon(platform: ProfilePlatform): string {
  if (platform === 'github') {
    return `<svg class="profile-contact-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49C4 14.09 3.48 13.21 3.32 12.76c-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52 0-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8"></path>
    </svg>`;
  }

  if (platform === 'bilibili') {
    return `<svg class="profile-contact-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M8.3 4.3a1 1 0 0 1 1.4 0l2.3 2.2 2.3-2.2a1 1 0 0 1 1.4 1.4L14.1 7h3.9a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h3.9L8.3 5.7a1 1 0 0 1 0-1.4ZM6 9a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H6Zm3.5 2.5a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1Zm5 0a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1Z"></path>
    </svg>`;
  }

  return `<svg class="profile-contact-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.2"></rect>
    <path d="M3.5 6 12 12.6 20.5 6"></path>
  </svg>`;
}
