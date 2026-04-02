import { loadFriendLinks } from '../data/friends';
import type { FriendLink } from '../types/friend-link';
import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

export const renderFriendsPage: PageRenderer = () => {
  const friendLinks = loadFriendLinks();
  const friendLinkTemplate = `name: 'ShinoLog',
description: '某个状态混沌家伙的Blog',
avatar: 'https://example.com/avatar.png',
url: 'https://nagashino.top/'`;

  return `
<section class="page page-friends">
  <div data-role="friend-link-list-slot">
    ${renderFriendLinkList(friendLinks)}
  </div>
  <section class="friend-link-add-card" aria-label="添加我的链接">
    <button
      type="button"
      class="friend-link-copy-button"
      data-role="friend-link-copy"
      aria-label="复制友链模板"
    >
      复制
    </button>
    <p class="friend-link-add-title">添加我</p>
    <pre class="friend-link-add-url"><code data-role="friend-link-add-url">${escapeHtml(friendLinkTemplate)}</code></pre>
  </section>
</section>
`;
};

export function renderFriendLinkList(links: FriendLink[]): string {
  if (!links.length) {
    return '<p class="empty-hint">暂无友链。</p>';
  }

  return `<ul class="friend-link-list">
    ${links
      .map(
        (link) => `
          <li class="friend-link-card" data-motion-card>
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
      </ul>`;
}
