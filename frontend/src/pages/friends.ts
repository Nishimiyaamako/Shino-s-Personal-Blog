import { FRIEND_LINKS } from '../data/friends';
import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

export const renderFriendsPage: PageRenderer = () => {
  const friendLinkTemplate = `name: 'ShinoLog',
description: '某个状态混沌家伙的Blog',
avatar: 'https://example.com/avatar.png',
url: 'https://nagashino.top/'`;

  return `
<section class="page page-friends">
  ${FRIEND_LINKS.length
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
