import type { AboutApiResponse } from '../types/about';
import type {
  AdminFriendLink,
  AdminLoginResponse,
  AdminPost,
  AdminProfileCard,
  ApiListResponse,
  PublicPostsResponse,
  SearchResultItem,
  UploadImageResponse
} from '../types/api';
import type { PostDetail, PostStatus, PostSummary } from '../types/content';
import type { FriendLink } from '../types/friend-link';
import type { ProfileCardConfig } from '../types/profile-card';

const ADMIN_TOKEN_STORAGE_KEY = 'shino.admin.token';
const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

function toApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path) || path.startsWith('//')) {
    return path;
  }

  if (!API_BASE_URL) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(toApiUrl(url), {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.headers ?? {})
    }
  });

  const text = await response.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const message =
      json && typeof json === 'object' && 'error' in json && typeof (json as { error?: unknown }).error === 'string'
        ? (json as { error: string }).error
        : `${response.status} ${response.statusText}`;

    throw new Error(message);
  }

  return json as T;
}

function ensurePostSummary(record: unknown): PostSummary {
  if (!record || typeof record !== 'object') {
    throw new Error('invalid post summary payload');
  }

  const item = record as Record<string, unknown>;

  return {
    title: String(item.title ?? ''),
    slug: String(item.slug ?? ''),
    date: String(item.date ?? ''),
    theme: item.theme ? String(item.theme) : undefined,
    tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
    summary: String(item.summary ?? ''),
    coverImageUrl: item.coverImageUrl ? String(item.coverImageUrl) : undefined,
    featuredOrder: typeof item.featuredOrder === 'number' ? item.featuredOrder : undefined
  };
}

function ensurePostDetail(record: unknown): PostDetail {
  const summary = ensurePostSummary(record);
  const item = record as Record<string, unknown>;

  return {
    ...summary,
    status: (item.status === 'draft' ? 'draft' : 'published') satisfies PostStatus,
    contentMarkdown: String(item.contentMarkdown ?? ''),
    contentHtml: String(item.contentHtml ?? '')
  };
}

export async function fetchPublicPosts(options: {
  page?: number;
  pageSize?: number;
  tag?: string;
  signal?: AbortSignal;
} = {}): Promise<PublicPostsResponse> {
  const searchParams = new URLSearchParams();

  if (options.page) {
    searchParams.set('page', String(options.page));
  }

  if (options.pageSize) {
    searchParams.set('pageSize', String(options.pageSize));
  }

  if (options.tag) {
    searchParams.set('tag', options.tag);
  }

  const query = searchParams.toString();
  const payload = await fetchJson<PublicPostsResponse>(`/api/posts${query ? `?${query}` : ''}`, {
    signal: options.signal
  });

  return {
    total: Number(payload.total ?? 0),
    page: Number(payload.page ?? 1),
    pageSize: Number(payload.pageSize ?? 20),
    items: Array.isArray(payload.items) ? payload.items.map((item) => ensurePostSummary(item)) : []
  };
}

export async function fetchFeaturedPosts(limit = 5, signal?: AbortSignal): Promise<PostSummary[]> {
  const payload = await fetchJson<ApiListResponse<unknown>>(`/api/home/featured?limit=${encodeURIComponent(String(limit))}`, {
    signal
  });

  return Array.isArray(payload.items) ? payload.items.map((item) => ensurePostSummary(item)) : [];
}

export async function fetchPostDetail(slug: string, signal?: AbortSignal): Promise<PostDetail | null> {
  try {
    const payload = await fetchJson<unknown>(`/api/posts/${encodeURIComponent(slug)}`, {
      signal
    });

    return ensurePostDetail(payload);
  } catch (error) {
    if (error instanceof Error && /404/.test(error.message)) {
      return null;
    }

    throw error;
  }
}

export async function fetchFriendLinks(signal?: AbortSignal): Promise<FriendLink[]> {
  const payload = await fetchJson<ApiListResponse<unknown>>('/api/friend-links', { signal });

  return Array.isArray(payload.items)
    ? payload.items.map((item) => {
        const record = item as Record<string, unknown>;

        return {
          name: String(record.name ?? ''),
          description: String(record.description ?? ''),
          avatar: String(record.avatar ?? ''),
          url: String(record.url ?? '')
        } satisfies FriendLink;
      })
    : [];
}

export async function fetchProfileCard(signal?: AbortSignal): Promise<ProfileCardConfig> {
  const payload = await fetchJson<Record<string, unknown>>('/api/profile-card', { signal });

  const contacts = Array.isArray(payload.contacts)
    ? payload.contacts.map((item) => {
        const record = item as Record<string, unknown>;
        return {
          platform: String(record.platform ?? ''),
          label: String(record.label ?? ''),
          href: String(record.href ?? '')
        };
      })
    : [];

  return {
    name: String(payload.name ?? ''),
    bio: String(payload.bio ?? ''),
    avatar: String(payload.avatar ?? ''),
    contacts
  };
}

export async function searchPosts(queryText: string, limit = 10, signal?: AbortSignal): Promise<SearchResultItem[]> {
  const trimmedQuery = queryText.trim();

  if (!trimmedQuery) {
    return [];
  }

  const query = new URLSearchParams({
    q: trimmedQuery,
    limit: String(limit)
  });

  const payload = await fetchJson<ApiListResponse<unknown>>(`/api/search?${query.toString()}`, { signal });

  return Array.isArray(payload.items)
    ? payload.items.map((item) => {
        const record = item as Record<string, unknown>;

        return {
          slug: String(record.slug ?? ''),
          title: String(record.title ?? ''),
          summary: String(record.summary ?? ''),
          tags: Array.isArray(record.tags) ? record.tags.map((tag) => String(tag)) : [],
          snippet: String(record.snippet ?? ''),
          publishedAt: String(record.publishedAt ?? '')
        };
      })
    : [];
}

function getAdminAuthHeaders(token: string): Headers {
  const headers = new Headers();
  headers.set('accept', 'application/json');
  headers.set('authorization', `Bearer ${token}`);
  return headers;
}

async function adminFetchJson<T>(
  path: string,
  token: string,
  init: Omit<RequestInit, 'headers'> & { headers?: HeadersInit } = {}
): Promise<T> {
  const headers = getAdminAuthHeaders(token);

  if (init.headers) {
    const extraHeaders = new Headers(init.headers);
    extraHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return fetchJson<T>(path, {
    ...init,
    headers
  });
}

export function readAdminToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? '';
}

export function writeAdminToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

export function clearAdminToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

export async function adminLogin(username: string, password: string): Promise<AdminLoginResponse> {
  return fetchJson<AdminLoginResponse>('/api/admin/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });
}

export async function adminListPosts(token: string): Promise<AdminPost[]> {
  const payload = await adminFetchJson<ApiListResponse<unknown>>('/api/admin/posts', token);

  return Array.isArray(payload.items)
    ? payload.items.map((item) => {
        const detail = ensurePostDetail(item);
        const record = item as Record<string, unknown>;

        return {
          ...detail,
          id: Number(record.id ?? 0),
          isFeatured: Boolean(record.isFeatured)
        } satisfies AdminPost;
      })
    : [];
}

export async function adminCreatePost(token: string, payload: Partial<AdminPost>): Promise<AdminPost> {
  const response = await adminFetchJson<{ item: unknown }>('/api/admin/posts', token, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const detail = ensurePostDetail(response.item);
  const record = response.item as Record<string, unknown>;

  return {
    ...detail,
    id: Number(record.id ?? 0),
    isFeatured: Boolean(record.isFeatured)
  };
}

export async function adminUpdatePost(
  token: string,
  postId: number,
  payload: Partial<AdminPost>
): Promise<AdminPost> {
  const response = await adminFetchJson<{ item: unknown }>(`/api/admin/posts/${postId}`, token, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const detail = ensurePostDetail(response.item);
  const record = response.item as Record<string, unknown>;

  return {
    ...detail,
    id: Number(record.id ?? 0),
    isFeatured: Boolean(record.isFeatured)
  };
}

export async function adminDeletePost(token: string, postId: number): Promise<void> {
  await adminFetchJson<{ ok: boolean }>(`/api/admin/posts/${postId}`, token, {
    method: 'DELETE'
  });
}

export async function adminPublishPost(token: string, postId: number): Promise<AdminPost> {
  const response = await adminFetchJson<{ item: unknown }>(`/api/admin/posts/${postId}/publish`, token, {
    method: 'POST'
  });

  const detail = ensurePostDetail(response.item);
  const record = response.item as Record<string, unknown>;

  return {
    ...detail,
    id: Number(record.id ?? 0),
    isFeatured: Boolean(record.isFeatured)
  };
}

export async function adminUnpublishPost(token: string, postId: number): Promise<AdminPost> {
  const response = await adminFetchJson<{ item: unknown }>(`/api/admin/posts/${postId}/unpublish`, token, {
    method: 'POST'
  });

  const detail = ensurePostDetail(response.item);
  const record = response.item as Record<string, unknown>;

  return {
    ...detail,
    id: Number(record.id ?? 0),
    isFeatured: Boolean(record.isFeatured)
  };
}

export async function adminSetFeatured(
  token: string,
  postId: number,
  isFeatured: boolean,
  featuredOrder?: number
): Promise<AdminPost> {
  const response = await adminFetchJson<{ item: unknown }>(`/api/admin/posts/${postId}/featured`, token, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ isFeatured, featuredOrder })
  });

  const detail = ensurePostDetail(response.item);
  const record = response.item as Record<string, unknown>;

  return {
    ...detail,
    id: Number(record.id ?? 0),
    isFeatured: Boolean(record.isFeatured)
  };
}

export async function adminUploadImage(token: string, file: File): Promise<UploadImageResponse['item']> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await adminFetchJson<UploadImageResponse>('/api/admin/uploads/image', token, {
    method: 'POST',
    body: formData
  });

  return response.item;
}

export async function adminListFriendLinks(token: string): Promise<AdminFriendLink[]> {
  const payload = await adminFetchJson<ApiListResponse<unknown>>('/api/admin/friend-links', token);

  return Array.isArray(payload.items)
    ? payload.items.map((item) => {
        const record = item as Record<string, unknown>;

        return {
          id: Number(record.id ?? 0),
          name: String(record.name ?? ''),
          description: String(record.description ?? ''),
          avatar: String(record.avatar ?? ''),
          url: String(record.url ?? ''),
          enabled: Boolean(record.enabled),
          displayOrder: Number(record.displayOrder ?? 0)
        };
      })
    : [];
}

export async function adminCreateFriendLink(
  token: string,
  payload: Partial<AdminFriendLink>
): Promise<AdminFriendLink> {
  const response = await adminFetchJson<{ item: unknown }>('/api/admin/friend-links', token, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const record = response.item as Record<string, unknown>;

  return {
    id: Number(record.id ?? 0),
    name: String(record.name ?? ''),
    description: String(record.description ?? ''),
    avatar: String(record.avatar ?? ''),
    url: String(record.url ?? ''),
    enabled: Boolean(record.enabled),
    displayOrder: Number(record.displayOrder ?? 0)
  };
}

export async function adminUpdateFriendLink(
  token: string,
  friendId: number,
  payload: Partial<AdminFriendLink>
): Promise<AdminFriendLink> {
  const response = await adminFetchJson<{ item: unknown }>(`/api/admin/friend-links/${friendId}`, token, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const record = response.item as Record<string, unknown>;

  return {
    id: Number(record.id ?? 0),
    name: String(record.name ?? ''),
    description: String(record.description ?? ''),
    avatar: String(record.avatar ?? ''),
    url: String(record.url ?? ''),
    enabled: Boolean(record.enabled),
    displayOrder: Number(record.displayOrder ?? 0)
  };
}

export async function adminDeleteFriendLink(token: string, friendId: number): Promise<void> {
  await adminFetchJson<{ ok: boolean }>(`/api/admin/friend-links/${friendId}`, token, {
    method: 'DELETE'
  });
}

export async function adminFetchAbout(token: string): Promise<AboutApiResponse> {
  return adminFetchJson<AboutApiResponse>('/api/admin/about', token);
}

export async function adminUpdateAbout(token: string, markdown: string): Promise<AboutApiResponse> {
  return adminFetchJson<AboutApiResponse>('/api/admin/about', token, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ markdown })
  });
}

export async function adminFetchProfileCard(token: string): Promise<AdminProfileCard> {
  return adminFetchJson<AdminProfileCard>('/api/admin/profile-card', token);
}

export async function adminUpdateProfileCard(
  token: string,
  payload: AdminProfileCard
): Promise<AdminProfileCard> {
  return adminFetchJson<AdminProfileCard>('/api/admin/profile-card', token, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}
