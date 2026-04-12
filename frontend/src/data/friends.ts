import type { FriendLink } from '../types/friend-link';

export const FRIEND_LINKS: FriendLink[] = [];

let remoteFriendLinksOverride: FriendLink[] | null = null;

export function loadFriendLinks(): FriendLink[] {
  return remoteFriendLinksOverride ? [...remoteFriendLinksOverride] : [...FRIEND_LINKS];
}

export function applyRemoteFriendLinks(links: FriendLink[]): boolean {
  const normalizedLinks = links
    .map((link) => ({
      name: link.name.trim(),
      description: link.description.trim(),
      avatar: link.avatar.trim(),
      url: link.url.trim()
    }))
    .filter((link) => link.name && link.url);
  const nextFingerprint = normalizedLinks
    .map((link) => `${link.name}|${link.url}|${link.avatar}|${link.description}`)
    .join('||');
  const currentFingerprint = (remoteFriendLinksOverride ?? FRIEND_LINKS)
    .map((link) => `${link.name}|${link.url}|${link.avatar}|${link.description}`)
    .join('||');

  if (nextFingerprint === currentFingerprint) {
    return false;
  }

  remoteFriendLinksOverride = normalizedLinks;
  return true;
}
