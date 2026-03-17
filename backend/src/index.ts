import { Elysia } from 'elysia';

interface FriendLinkItem {
  id: string;
  name: string;
  url: string;
  description: string;
  avatar: string;
}

const FRIEND_LINKS: FriendLinkItem[] = [
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

const app = new Elysia({ prefix: '/api' })
  .get('/health', () => ({
    ok: true,
    message: 'personal blog backend is healthy'
  }))
  .get('/stats', () => ({
    ok: true,
    data: {
      posts: 0,
      tags: 0,
      friends: FRIEND_LINKS.length
    }
  }))
  .get('/friends', () => ({
    ok: true,
    data: FRIEND_LINKS
  }));

const port = Number(process.env.PORT ?? 3000);

app.listen(port);

console.info(`[backend] API server is running at http://localhost:${port}`);
