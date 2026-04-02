import type { FriendLink } from '../types/friend-link';

export const FRIEND_LINKS: FriendLink[] = [
  {
    name: 'Duo 云站',
    description: 'MathForest官方🌲|程序及数学可视化✨|屑魔女游世界🔮',
    avatar: 'https://www.mduo.cloud/elaina_q.jpg',
    url: 'https://www.mduo.cloud/'
  },
  {
    name: 'YukiKi',
    description: '欢迎来到我的世界,这里没有神,只有我构筑的代码、记忆和光',
    avatar: 'https://www.mduo.cloud/yueosa.jpg',
    url: 'https://blog.yeastar.xin/'
  },
  {
    name: '二叉树树',
    description: 'Protect What You Love.',
    avatar: 'https://q2.qlogo.cn/headimg_dl?dst_uin=2726730791&spec=0',
    url: 'https://2x.nz/'
  }


];

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
