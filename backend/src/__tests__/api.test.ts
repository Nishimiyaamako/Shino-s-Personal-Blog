import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createApp } from '../app';
import { ENV } from '../config/env';

const testDatabasePath = resolve('/tmp', `shino-blog-api-test-${Date.now()}.sqlite`);

let appInstance: Awaited<ReturnType<typeof createApp>>;

async function requestJson(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
  } = {}
): Promise<Response> {
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
  }

  if (options.token) {
    headers.set('authorization', `Bearer ${options.token}`);
  }

  return appInstance.app.handle(
    new Request(`http://localhost${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    })
  );
}

async function requestForm(
  path: string,
  options: {
    method?: string;
    body: FormData;
    token?: string;
  }
): Promise<Response> {
  const headers = new Headers();

  if (options.token) {
    headers.set('authorization', `Bearer ${options.token}`);
  }

  return appInstance.app.handle(
    new Request(`http://localhost${path}`, {
      method: options.method ?? 'POST',
      headers,
      body: options.body
    })
  );
}

async function login(): Promise<string> {
  const response = await requestJson('/api/admin/auth/login', {
    method: 'POST',
    body: {
      username: 'admin',
      password: 'admin123'
    }
  });

  expect(response.status).toBe(200);
  const payload = (await response.json()) as { token: string };
  expect(typeof payload.token).toBe('string');
  return payload.token;
}

beforeAll(async () => {
  appInstance = await createApp({ databasePath: testDatabasePath });
});

afterAll(() => {
  appInstance.dbContext.sqlite.close();
  rmSync(testDatabasePath, { force: true });
  rmSync(`${testDatabasePath}-wal`, { force: true });
  rmSync(`${testDatabasePath}-shm`, { force: true });
});

describe('admin auth', () => {
  test('login success with default admin', async () => {
    const token = await login();
    expect(token.length).toBeGreaterThan(20);
  });

  test('reject admin endpoint without token', async () => {
    const response = await requestJson('/api/admin/posts');
    expect(response.status).toBe(401);
  });
});

describe('post publish and search', () => {
  test('draft post is not visible in public list', async () => {
    const token = await login();

    const createResponse = await requestJson('/api/admin/posts', {
      method: 'POST',
      token,
      body: {
        title: 'Draft Article',
        slug: 'draft-article',
        date: '2026-04-01',
        summary: 'draft summary',
        tags: ['draft'],
        contentMarkdown: '# draft',
        status: 'draft'
      }
    });

    expect(createResponse.status).toBe(200);

    const listResponse = await requestJson('/api/posts');
    const listPayload = (await listResponse.json()) as { items: Array<{ slug: string }> };
    expect(listPayload.items.some((item) => item.slug === 'draft-article')).toBeFalse();
  });

  test('published post can be searched', async () => {
    const token = await login();

    const createResponse = await requestJson('/api/admin/posts', {
      method: 'POST',
      token,
      body: {
        title: 'Searchable Article',
        slug: 'searchable-article',
        date: '2026-04-01',
        summary: 'find me maybe',
        tags: ['search'],
        contentMarkdown: 'hello keyword-shino-search',
        status: 'published'
      }
    });

    expect(createResponse.status).toBe(200);

    const searchResponse = await requestJson('/api/search?q=keyword-shino-search');
    expect(searchResponse.status).toBe(200);

    const payload = (await searchResponse.json()) as {
      items: Array<{ slug: string }>;
    };

    expect(payload.items.some((item) => item.slug === 'searchable-article')).toBeTrue();
  });

  test('featured list uses manual featuredOrder asc', async () => {
    const token = await login();

    const postPayloads = [
      {
        title: 'Featured Later',
        slug: 'featured-later',
        date: '2026-04-01',
        summary: 'featured order 20',
        tags: ['featured'],
        contentMarkdown: '# later',
        status: 'published',
        isFeatured: true,
        featuredOrder: 20
      },
      {
        title: 'Featured First',
        slug: 'featured-first',
        date: '2026-04-01',
        summary: 'featured order 1',
        tags: ['featured'],
        contentMarkdown: '# first',
        status: 'published',
        isFeatured: true,
        featuredOrder: 1
      }
    ] as const;

    for (const payload of postPayloads) {
      const createResponse = await requestJson('/api/admin/posts', {
        method: 'POST',
        token,
        body: payload
      });

      expect(createResponse.status).toBe(200);
    }

    const featuredResponse = await requestJson('/api/home/featured?limit=2');
    expect(featuredResponse.status).toBe(200);

    const featuredPayload = (await featuredResponse.json()) as {
      items: Array<{ slug: string }>;
    };

    expect(featuredPayload.items[0]?.slug).toBe('featured-first');
    expect(featuredPayload.items[1]?.slug).toBe('featured-later');
  });

  test('search supports title, tag and markdown hits including Chinese', async () => {
    const token = await login();

    const createCases = [
      {
        title: '中文标题命中测试',
        slug: 'search-title-hit',
        date: '2026-04-01',
        summary: 'title hit',
        tags: ['search-title'],
        contentMarkdown: 'normal content',
        status: 'published'
      },
      {
        title: 'Tag Search Case',
        slug: 'search-tag-hit',
        date: '2026-04-01',
        summary: 'tag hit',
        tags: ['tag-hit-search'],
        contentMarkdown: 'normal content',
        status: 'published'
      },
      {
        title: 'Content Search Case',
        slug: 'search-content-hit',
        date: '2026-04-01',
        summary: 'content hit',
        tags: ['search-content'],
        contentMarkdown: '这里有正文关键字 星尘 计划',
        status: 'published'
      }
    ] as const;

    for (const payload of createCases) {
      const createResponse = await requestJson('/api/admin/posts', {
        method: 'POST',
        token,
        body: payload
      });

      expect(createResponse.status).toBe(200);
    }

    const titleSearch = await requestJson('/api/search?q=中文标题命中测试');
    expect(titleSearch.status).toBe(200);
    const titlePayload = (await titleSearch.json()) as { items: Array<{ slug: string }> };
    expect(titlePayload.items.some((item) => item.slug === 'search-title-hit')).toBeTrue();

    const tagSearch = await requestJson('/api/search?q=tag-hit-search');
    expect(tagSearch.status).toBe(200);
    const tagPayload = (await tagSearch.json()) as { items: Array<{ slug: string }> };
    expect(tagPayload.items.some((item) => item.slug === 'search-tag-hit')).toBeTrue();

    const contentSearch = await requestJson('/api/search?q=星尘');
    expect(contentSearch.status).toBe(200);
    const contentPayload = (await contentSearch.json()) as { items: Array<{ slug: string }> };
    expect(contentPayload.items.some((item) => item.slug === 'search-content-hit')).toBeTrue();
  });

  test('reject duplicated slug when creating posts', async () => {
    const token = await login();

    const payload = {
      title: 'Unique Slug Base',
      slug: 'duplicate-slug-case',
      date: '2026-04-01',
      summary: 'slug unique test',
      tags: ['slug'],
      contentMarkdown: 'first',
      status: 'published'
    } as const;

    const firstCreate = await requestJson('/api/admin/posts', {
      method: 'POST',
      token,
      body: payload
    });
    expect(firstCreate.status).toBe(200);

    const secondCreate = await requestJson('/api/admin/posts', {
      method: 'POST',
      token,
      body: {
        ...payload,
        title: 'Duplicate Slug Second'
      }
    });

    expect(secondCreate.status).toBe(400);
  });
});

describe('uploads', () => {
  test('reject unsupported mime type', async () => {
    const token = await login();
    const formData = new FormData();
    formData.set('file', new File(['hello'], 'hello.txt', { type: 'text/plain' }));

    const response = await requestForm('/api/admin/uploads/image', {
      body: formData,
      token
    });

    expect(response.status).toBe(400);
  });

  test('reject oversized image', async () => {
    const token = await login();
    const formData = new FormData();
    const oversizedBytes = new Uint8Array(5 * 1024 * 1024 + 1);
    formData.set('file', new File([oversizedBytes], 'large.png', { type: 'image/png' }));

    const response = await requestForm('/api/admin/uploads/image', {
      body: formData,
      token
    });

    expect(response.status).toBe(400);
  });

  test('upload image returns a public url', async () => {
    const token = await login();
    const formData = new FormData();
    const tinyImageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    formData.set('file', new File([tinyImageBytes], 'tiny.png', { type: 'image/png' }));

    const response = await requestForm('/api/admin/uploads/image', {
      body: formData,
      token
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { item: { url: string; fileName: string } };
    expect(payload.item.url.startsWith('/uploads/images/')).toBeTrue();
    expect(payload.item.fileName.endsWith('.png')).toBeTrue();

    rmSync(resolve(ENV.uploadsRoot, 'images', payload.item.fileName), { force: true });
  });
});
