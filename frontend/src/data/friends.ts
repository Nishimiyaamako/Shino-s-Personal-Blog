/**
 * 友链数据（前端本地占位）
 *
 * 说明：
 * - 字段结构与后端 `/api/friends` 对齐
 * - 当前页面先直接使用本地数据渲染
 * - 后续切换为请求接口时可复用同一类型
 */
export interface FriendLinkItem {
  id: string;
  name: string;
  url: string;
  description: string;
  avatar: string;
}

export const FRIEND_LINKS: FriendLinkItem[] = [
  {
    id: 'astro',
    name: 'Astro Blog',
    url: 'https://astro.build/blog/',
    description: '内容优先的前端框架博客，静态站与内容站实践非常多。',
    avatar: '/friends/astro.svg'
  },
  {
    id: 'bun',
    name: 'Bun Blog',
    url: 'https://bun.sh/blog',
    description: '围绕 JavaScript 运行时和工具链的工程更新，节奏很快。',
    avatar: '/friends/bun.svg'
  },
  {
    id: 'vercel',
    name: 'Vercel Blog',
    url: 'https://vercel.com/blog',
    description: '性能、部署与体验优化相关内容丰富，适合博客项目取经。',
    avatar: '/friends/vercel.svg'
  }
];
