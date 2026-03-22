import { hasPublishedPostSlug } from '../data/posts';
import { renderArchivePage } from '../pages/archive';
import { renderAboutPage } from '../pages/about';
import { renderFriendsPage } from '../pages/friends';
import { renderHomePage } from '../pages/home';
import { renderNotFoundPage } from '../pages/not-found';
import { renderPostDetailPage } from '../pages/post-detail';
import { renderPostsPage } from '../pages/posts';
import { renderTagDetailPage } from '../pages/tag-detail';
import { renderTagsPage } from '../pages/tags';
import type { PageRenderContext, RouteParams, RouteRecord } from '../types/router';

const NOT_FOUND_PATH = '/404';
export type PrimaryNavIcon = 'home' | 'posts' | 'tags' | 'archive' | 'friends' | 'about';

export const ROUTE_RECORDS: RouteRecord[] = [
  { path: '/', title: '首页', render: renderHomePage },
  { path: '/posts', title: '文章列表', render: renderPostsPage },
  { path: '/posts/:slug', title: '文章详情', render: renderPostDetailPage },
  { path: '/tags', title: '标签总览', render: renderTagsPage },
  { path: '/tags/:tag', title: '标签详情', render: renderTagDetailPage },
  { path: '/archive', title: '归档', render: renderArchivePage },
  { path: '/friends', title: '友链', render: renderFriendsPage },
  { path: '/about', title: '关于', render: renderAboutPage },
  { path: NOT_FOUND_PATH, title: '404', render: renderNotFoundPage }
];

export const PRIMARY_NAV_LINKS = [
  { href: '/', label: '首页', icon: 'home' },
  { href: '/posts', label: '文章', icon: 'posts' },
  { href: '/tags', label: '标签', icon: 'tags' },
  { href: '/archive', label: '归档', icon: 'archive' },
  { href: '/friends', label: '友链', icon: 'friends' },
  { href: '/about', label: '关于', icon: 'about' }
] as const;

export interface RouteResolution {
  route: RouteRecord;
  context: PageRenderContext;
  isFallback: boolean;
}

export function resolveRoute(pathname: string): RouteResolution {
  const normalizedPath = normalizePathname(pathname);

  for (const route of ROUTE_RECORDS) {
    const params = matchPath(route.path, normalizedPath);

    if (params === null) {
      continue;
    }

    if (route.path === '/posts/:slug' && !hasPublishedPostSlug(params.slug ?? '')) {
      continue;
    }

    return {
      route,
      context: { params, pathname: normalizedPath },
      isFallback: false
    };
  }

  return {
    route: getNotFoundRoute(),
    context: { params: {}, pathname: normalizedPath },
    isFallback: true
  };
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  const ensuredPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return ensuredPath.replace(/\/+$/, '') || '/';
}

function matchPath(routePath: string, pathname: string): RouteParams | null {
  const routeSegments = splitPath(routePath);
  const pathnameSegments = splitPath(pathname);

  if (routeSegments.length !== pathnameSegments.length) {
    return null;
  }

  const params: RouteParams = {};

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const pathSegment = pathnameSegments[index];

    if (routeSegment.startsWith(':')) {
      const key = routeSegment.slice(1);
      if (!key) {
        return null;
      }

      params[key] = safeDecodeURIComponent(pathSegment);
      continue;
    }

    if (routeSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getNotFoundRoute(): RouteRecord {
  const notFoundRoute = ROUTE_RECORDS.find((route) => route.path === NOT_FOUND_PATH);

  if (!notFoundRoute) {
    throw new Error('Route "/404" is required but missing.');
  }

  return notFoundRoute;
}
