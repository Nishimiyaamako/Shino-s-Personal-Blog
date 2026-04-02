import { Elysia } from 'elysia';
import type { DatabaseContext } from '../db/client';
import { verifyAdminCredentials } from '../auth/admin';
import { signAdminToken } from '../auth/jwt';
import { getAboutMarkdown, updateAboutMarkdown } from '../services/about';
import {
  createFriendLink,
  deleteFriendLink,
  listAdminFriendLinks,
  updateFriendLink
} from '../services/friends';
import { saveImageAsset } from '../services/media';
import {
  createPost,
  deletePost,
  listAdminPosts,
  publishPost,
  setPostFeatured,
  unpublishPost,
  updatePost,
  type UpsertPostInput
} from '../services/posts';
import { getProfileCard, updateProfileCard } from '../services/profile';
import { asPositiveInt, parseJsonBody, requireAdmin, toErrorPayload } from './helpers';

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

      return {
        items: listAdminPosts(context)
      };
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

      const ok = deletePost(context, postId);

      if (!ok) {
        set.status = 404;
        return { error: '文章不存在' };
      }

      return { ok: true };
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

      const item = publishPost(context, postId);

      if (!item) {
        set.status = 404;
        return { error: '文章不存在' };
      }

      return { item };
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

      const item = unpublishPost(context, postId);

      if (!item) {
        set.status = 404;
        return { error: '文章不存在' };
      }

      return { item };
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
    .get('/friend-links', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      return {
        items: listAdminFriendLinks(context)
      };
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

      const ok = deleteFriendLink(context, friendId);

      if (!ok) {
        set.status = 404;
        return { error: '友链不存在' };
      }

      return { ok: true };
    })
    .get('/about', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      return {
        markdown: getAboutMarkdown(context)
      };
    })
    .patch('/about', async ({ request, set }) => {
      const admin = await requireAdmin(request, set);
      if (!admin) {
        return { error: 'Unauthorized' };
      }

      try {
        const body = await parseJsonBody<{ markdown?: string }>(request);
        return updateAboutMarkdown(context, body.markdown ?? '');
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

      return getProfileCard(context);
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
    });
}
