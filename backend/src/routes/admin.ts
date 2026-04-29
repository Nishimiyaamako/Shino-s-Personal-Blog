import { Elysia } from 'elysia';
import type { DatabaseContext } from '../db/client';
import { verifyAdminCredentials } from '../auth/admin';
import { signAdminToken } from '../auth/jwt';
import { getAbout, updateAbout } from '../services/about';
import {
  createFriendLink,
  deleteFriendLink,
  listAdminFriendLinks,
  updateFriendLink
} from '../services/friends';
import { deleteMediaAsset, listMediaAssets, saveImageAsset } from '../services/media';
import {
  createPost,
  deletePost,
  getAdminPostById,
  listAdminPosts,
  publishPost,
  rebuildSearchIndex,
  setPostFeatured,
  unpublishPost,
  updatePost,
  type UpsertPostInput
} from '../services/posts';
import { getProfileCard, updateProfileCard } from '../services/profile';
import { getSiteConfig, updateSiteConfig } from '../services/site-config';
import { asPositiveInt, parseJsonBody, requireAdmin, toErrorPayload, validateUrl } from './helpers';

export function createAdminRoutes(context: DatabaseContext) {
  return new Elysia({ prefix: '/api/admin' })
    .post('/auth/login', async ({ request, set }) => {
      try {
        const body = await parseJsonBody<{ username?: string; password?: string }>(request);
        const username = body.username?.trim() ?? '';
        const password = body.password ?? '';

        if (!username || !password) {
          set.status = 400;
          return { error: 'username/password 不能为空' };
        }

        const user = await verifyAdminCredentials(context, username, password);

        if (!user) {
          set.status = 401;
          return { error: '账号或密码错误' };
        }

        const token = await signAdminToken({
          sub: String(user.id),
          username: user.username
        });

        return {
          token,
          user: {
            id: user.id,
            username: user.username
          }
        };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .get('/posts', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);

      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        const searchParams = new URL(request.url).searchParams;
        const queryStatus = searchParams.get('status');

        return listAdminPosts(context, {
          q: searchParams.get('q') ?? undefined,
          status: queryStatus === 'draft' || queryStatus === 'published' ? queryStatus : 'all',
          tag: searchParams.get('tag') ?? undefined,
          page: Number(searchParams.get('page') ?? ''),
          pageSize: Number(searchParams.get('pageSize') ?? '')
        });
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .get('/posts/:id', async ({ request, params, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      const postId = asPositiveInt(params.id);
      if (!postId) {
        set.status = 400;
        return { error: '无效文章 id' };
      }

      try {
        const post = getAdminPostById(context, postId);
        if (!post) {
          set.status = 404;
          return { error: '文章不存在' };
        }
        return { item: post };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .post('/posts', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        const body = await parseJsonBody<UpsertPostInput>(request);
        const created = createPost(context, body);
        return { item: created };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .patch('/posts/:id', async ({ request, params, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      const postId = asPositiveInt(params.id);
      if (!postId) {
        set.status = 400;
        return { error: '无效文章 id' };
      }

      try {
        const body = await parseJsonBody<Partial<UpsertPostInput>>(request);
        const updated = updatePost(context, postId, body);

        if (!updated) {
          set.status = 404;
          return { error: '文章不存在' };
        }

        return { item: updated };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .delete('/posts/:id', async ({ request, params, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      const postId = asPositiveInt(params.id);
      if (!postId) {
        set.status = 400;
        return { error: '无效文章 id' };
      }

      try {
        const ok = deletePost(context, postId);

        if (!ok) {
          set.status = 404;
          return { error: '文章不存在' };
        }

        return { ok: true };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .post('/posts/:id/publish', async ({ request, params, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      const postId = asPositiveInt(params.id);
      if (!postId) {
        set.status = 400;
        return { error: '无效文章 id' };
      }

      try {
        const item = publishPost(context, postId);

        if (!item) {
          set.status = 404;
          return { error: '文章不存在' };
        }

        return { item };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .post('/posts/:id/unpublish', async ({ request, params, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      const postId = asPositiveInt(params.id);
      if (!postId) {
        set.status = 400;
        return { error: '无效文章 id' };
      }

      try {
        const item = unpublishPost(context, postId);

        if (!item) {
          set.status = 404;
          return { error: '文章不存在' };
        }

        return { item };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .post('/posts/rebuild-search-index', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        rebuildSearchIndex(context);
        return { ok: true };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .patch('/posts/:id/featured', async ({ request, params, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      const postId = asPositiveInt(params.id);
      if (!postId) {
        set.status = 400;
        return { error: '无效文章 id' };
      }

      try {
        const body = await parseJsonBody<{ isFeatured: boolean; featuredOrder?: number }>(request);
        const item = setPostFeatured(context, postId, {
          isFeatured: Boolean(body.isFeatured),
          featuredOrder: body.featuredOrder
        });

        if (!item) {
          set.status = 404;
          return { error: '文章不存在' };
        }

        return { item };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .post('/uploads/image', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        const formData = await request.formData();
        const rawFile = formData.get('file');

        if (!(rawFile instanceof File)) {
          set.status = 400;
          return { error: 'file 字段缺失' };
        }

        const uploaded = await saveImageAsset(context, rawFile);
        return {
          item: uploaded
        };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .get('/media', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        const searchParams = new URL(request.url).searchParams;
        const page = Math.max(1, Number(searchParams.get('page') || 1));
        const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 20)));
        const sort = searchParams.get('sort') === 'size' ? 'size' : 'created_at';
        const order = searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';
        const filterParam = searchParams.get('filter') || 'all';
        const filter = (filterParam === 'orphaned' || filterParam === 'referenced') ? filterParam : 'all';

        return listMediaAssets(context, { page, pageSize, sort, order, filter });
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .delete('/media/:id', async ({ request, params, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      const id = Number(params.id);
      if (!Number.isFinite(id) || id < 1) {
        set.status = 400;
        return { error: '无效的 ID' };
      }

      try {
        deleteMediaAsset(context, id);
        return { ok: true };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .get('/friend-links', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        return {
          items: listAdminFriendLinks(context)
        };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .post('/friend-links', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        const body = await parseJsonBody<{
          name: string;
          description: string;
          avatar: string;
          url: string;
          enabled?: boolean;
          displayOrder?: number;
        }>(request);

        validateUrl(body.url, '友链 URL');
        validateUrl(body.avatar, '友链头像 URL');

        return {
          item: createFriendLink(context, body)
        };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .patch('/friend-links/:id', async ({ request, params, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      const friendId = asPositiveInt(params.id);

      if (!friendId) {
        set.status = 400;
        return { error: '无效友链 id' };
      }

      try {
        const body = await parseJsonBody<{
          name?: string;
          description?: string;
          avatar?: string;
          url?: string;
          enabled?: boolean;
          displayOrder?: number;
        }>(request);

        if (body.url !== undefined) {
          validateUrl(body.url, '友链 URL');
        }
        if (body.avatar !== undefined) {
          validateUrl(body.avatar, '友链头像 URL');
        }

        const item = updateFriendLink(context, friendId, body);

        if (!item) {
          set.status = 404;
          return { error: '友链不存在' };
        }

        return { item };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .delete('/friend-links/:id', async ({ request, params, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      const friendId = asPositiveInt(params.id);

      if (!friendId) {
        set.status = 400;
        return { error: '无效友链 id' };
      }

      try {
        const ok = deleteFriendLink(context, friendId);

        if (!ok) {
          set.status = 404;
          return { error: '友链不存在' };
        }

        return { ok: true };
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .get('/about', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        return getAbout(context);
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .patch('/about', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        const body = await parseJsonBody(request);
        return updateAbout(context, body as Parameters<typeof updateAbout>[1]);
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .get('/profile-card', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        return getProfileCard(context);
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .patch('/profile-card', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        const body = await parseJsonBody<{
          name?: string;
          bio?: string;
          avatar?: string;
          contacts?: Array<{ platform: string; label: string; href: string; displayOrder?: number }>;
        }>(request);

        return updateProfileCard(context, {
          name: body.name ?? '',
          bio: body.bio ?? '',
          avatar: body.avatar ?? '',
          contacts: body.contacts ?? []
        });
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .get('/site-config', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        return getSiteConfig(context);
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    })
    .patch('/site-config', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        const body = await parseJsonBody<{
          siteTitle?: string;
          siteSubtitle?: string;
          copyrightOwner?: string;
          poweredBy?: string;
          icpRecordText?: string;
          icpRecordUrl?: string;
          publicSecurityRecordText?: string;
          publicSecurityRecordUrl?: string;
          friendLinkTemplate?: string;
        }>(request);

        if (body.icpRecordUrl !== undefined) {
          validateUrl(body.icpRecordUrl, 'ICP 备案 URL');
        }
        if (body.publicSecurityRecordUrl !== undefined) {
          validateUrl(body.publicSecurityRecordUrl, '公安备案 URL');
        }

        return updateSiteConfig(context, body);
      } catch (error) {
        set.status = 400;
        return toErrorPayload(error);
      }
    });
}
