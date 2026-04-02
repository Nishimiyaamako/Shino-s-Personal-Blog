import { Elysia } from 'elysia';
import type { DatabaseContext } from '../db/client';
import { getAboutMarkdown } from '../services/about';
import { listPublicFriendLinks } from '../services/friends';
import { listFeaturedPosts, listPublishedPosts, getPublishedPostBySlug } from '../services/posts';
import { getProfileCard } from '../services/profile';
import { searchPublishedPosts } from '../services/search';

export function createPublicRoutes(context: DatabaseContext) {
  return new Elysia({ prefix: '/api' })
    .get('/health', () => ({ ok: true, timestamp: new Date().toISOString() }))
    .get('/posts', ({ query }) => {
      const page = Number(query.page ?? 1);
      const pageSize = Number(query.pageSize ?? 20);
      const tag = typeof query.tag === 'string' ? query.tag : '';

      return listPublishedPosts(context, {
        page,
        pageSize,
        tag
      });
    })
    .get('/posts/:slug', ({ params, set }) => {
      const post = getPublishedPostBySlug(context, params.slug);

      if (!post) {
        set.status = 404;
        return { error: '文章不存在' };
      }

      return post;
    })
    .get('/home/featured', ({ query }) => {
      const limit = Number(query.limit ?? 5);
      return {
        items: listFeaturedPosts(context, limit)
      };
    })
    .get('/friend-links', () => ({
      items: listPublicFriendLinks(context)
    }))
    .get('/about', () => ({ markdown: getAboutMarkdown(context) }))
    .get('/profile-card', () => getProfileCard(context))
    .get('/search', ({ query }) => {
      const q = typeof query.q === 'string' ? query.q : '';
      const limit = Number(query.limit ?? 10);

      return {
        items: searchPublishedPosts(context, q, limit)
      };
    });
}
