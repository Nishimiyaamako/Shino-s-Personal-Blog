import { FRIEND_LINKS } from '../data/friends';
import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

/**
 * 仅允许 http/https 外链，避免把非法协议直接写进 href。
 */
function toSafeExternalUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }

    return '#';
  } catch {
    return '#';
  }
}

function renderFriendCard(friend: (typeof FRIEND_LINKS)[number]): string {
  const safeUrl = toSafeExternalUrl(friend.url);
  const escapedName = escapeHtml(friend.name);
  const escapedDescription = escapeHtml(friend.description);
  const escapedAvatar = escapeHtml(friend.avatar);

  if (safeUrl === '#') {
    return `
  <article class="friend-card friend-card--disabled" aria-disabled="true">
    <img class="friend-avatar" src="${escapedAvatar}" alt="${escapedName} 头像" loading="lazy" decoding="async" />

    <div class="friend-body">
      <h3 class="friend-name">${escapedName}</h3>
      <p>${escapedDescription}</p>
      <p>链接待补充</p>
    </div>
  </article>
`;
  }

  return `
  <a class="friend-card friend-card--link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">
    <img class="friend-avatar" src="${escapedAvatar}" alt="${escapedName} 头像" loading="lazy" decoding="async" />

    <div class="friend-body">
      <h3 class="friend-name">${escapedName}</h3>
      <p>${escapedDescription}</p>
      <p>点击访问</p>
    </div>
  </a>
`;
}

/**
 * 渲染友链页（首版本地数据）。
 */
export const renderFriendsPage: PageRenderer = () => `
<main class="page-stack">
  <section class="home-welcome">
    <p class="home-eyebrow">Friend Links</p>
    <h1>友链</h1>
    <p>这些站点和内容方向与本博客长期同频，先用本地数据渲染，后续会切换到后端接口。</p>
  </section>

  <section class="friends-grid" aria-label="友链列表">
    ${FRIEND_LINKS.map(renderFriendCard).join('')}
  </section>

  <section class="section-card empty-note">
    <h2 class="section-title">后续计划</h2>
    <p>后端已预留 <code>GET /api/friends</code> 占位接口，下一步会把本页数据改为接口拉取。</p>
  </section>
</main>
`;
