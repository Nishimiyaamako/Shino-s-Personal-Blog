import { getPublishedWritingStats } from '../data/posts';
import { loadProfileCardConfig } from '../data/profile-card';
import { getIconifyIcon } from '../data/platform-presets';
import type { ProfilePlatform } from '../types/profile-card';
import { escapeHtml } from '../utils/escape-html';

export function renderProfileCard(): string {
  const profile = loadProfileCardConfig();
  const writingStats = getPublishedWritingStats();
  const totalWordsInW = `${(writingStats.wordCount / 10000).toFixed(1)}W`;

  return `
<aside class="profile-card" aria-label="个人资料卡片" data-role="profile-card">
  <div class="profile-card-header">
    <img class="profile-card-avatar" data-role="profile-avatar" src="${escapeHtml(profile.avatar)}" alt="${escapeHtml(profile.name)} 的头像" />
    <div class="profile-card-meta">
      <h2 data-role="profile-name">${escapeHtml(profile.name)}</h2>
      <p data-role="profile-bio">${escapeHtml(profile.bio)}</p>
    </div>
  </div>

  <ul class="profile-contact-list" data-role="profile-contact-list">
    ${profile.contacts
      .map((contact) => {
        const attrs = getContactAnchorAttrs(contact.href);
        const platformLabel = contact.label?.trim() ? contact.label.trim() : formatPlatform(contact.platform);

        return `
    <li>
      <a href="${escapeHtml(contact.href)}" class="profile-contact-link"${attrs}>
        <span class="profile-contact-platform">
          ${renderPlatformIcon(contact.platform)}
          <span>${escapeHtml(platformLabel)}</span>
        </span>
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
  const normalizedPlatform = platform.trim().toLowerCase();

  if (normalizedPlatform === 'github') {
    return 'GitHub';
  }

  if (normalizedPlatform === 'bilibili') {
    return 'Bilibili';
  }

  if (normalizedPlatform === 'gmail') {
    return 'Gmail';
  }

  if (!normalizedPlatform) {
    return 'Contact';
  }

  return normalizedPlatform
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getContactAnchorAttrs(href: string): string {
  if (href.startsWith('mailto:')) {
    return '';
  }

  return ' target="_blank" rel="noopener noreferrer"';
}

function renderPlatformIcon(platform: ProfilePlatform): string {
  const icon = getIconifyIcon(platform);
  return `<iconify-icon icon="${escapeHtml(icon)}" class="profile-contact-icon" aria-hidden="true"></iconify-icon>`;
}
