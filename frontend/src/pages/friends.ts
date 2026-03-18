import { FRIEND_LINKS } from '../data/friends';
import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

export const renderFriendsPage: PageRenderer = () => {
  return `
<section class="page page-friends">
  <header class="page-header">
    <h1>友链</h1>
    <p>和优秀站点互相连接，欢迎常来串门 ✨</p>
  </header>

  ${
    FRIEND_LINKS.length
      ? `<ul class="friend-link-list">
          ${FRIEND_LINKS
            .map(
              (link) => `
            <li class="friend-link-card">
              <a href="${escapeHtml(link.url)}" class="friend-link-anchor" target="_blank" rel="noopener noreferrer">
                <img
                  class="friend-link-avatar"
                  src="${escapeHtml(link.avatar)}"
                  alt="${escapeHtml(link.name)} 头像"
                  loading="lazy"
                  decoding="async"
                />
                <div class="friend-link-content">
                  <h2>${escapeHtml(link.name)}</h2>
                  <p>${escapeHtml(link.description)}</p>
                  <span class="friend-link-url">${escapeHtml(link.url)}</span>
                </div>
              </a>
            </li>`
            )
            .join('')}
        </ul>`
      : '<p class="empty-hint">暂无友链。</p>'
  }
</section>
`;
};
