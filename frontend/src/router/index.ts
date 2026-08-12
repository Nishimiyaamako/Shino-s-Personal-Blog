import { renderArchivePage } from '../pages/archive';
import { renderAdminLoginPage } from '../pages/admin-login';
import { renderAdminPage } from '../pages/admin';
import { renderAboutPage } from '../pages/about';
import { renderFriendsPage } from '../pages/friends';
import { renderLandingPage } from '../pages/landing';
import { renderNotFoundPage } from '../pages/not-found';
import { renderPostDetailPage } from '../pages/post-detail';
import { renderPostsPage } from '../pages/posts';
import { renderTagDetailPage } from '../pages/tag-detail';
import { renderTagsPage } from '../pages/tags';
import type { PageRenderContext, RouteParams, RouteRecord } from '../types/router';

const NOT_FOUND_PATH = '/404';
export type PrimaryNavIcon = 'home' | 'posts' | 'tags' | 'archive' | 'friends' | 'about';
export type AdminModuleRoute = 'posts' | 'friends' | 'about' | 'profile' | 'media' | 'settings';

export const ADMIN_MODULE_LINKS: Array<{ href: `/admin/${AdminModuleRoute}`; label: string; module: AdminModuleRoute }> = [
  { href: '/admin/posts', label: '文章管理', module: 'posts' },
  { href: '/admin/friends', label: '友链管理', module: 'friends' },
  { href: '/admin/about', label: '关于页', module: 'about' },
  { href: '/admin/profile', label: '名片卡', module: 'profile' },
  { href: '/admin/media', label: '媒体管理', module: 'media' },
  { href: '/admin/settings', label: '站点设置', module: 'settings' }
];

export const ROUTE_RECORDS: RouteRecord[] = [
  { path: '/', title: '首页', render: renderLandingPage },
  { path: '/blog', title: '文章列表', render: renderPostsPage },
  // 静态路由必须排在参数路由之前（/blog/:slug 段数相同会截胡 /blog/archive、/blog/tags）
  { path: '/blog/archive', title: '归档', render: renderArchivePage },
  { path: '/blog/tags', title: '标签总览', render: renderTagsPage },
  { path: '/blog/tags/:tag', title: '标签详情', render: renderTagDetailPage },
  { path: '/blog/:slug', title: '文章详情', render: renderPostDetailPage },
  { path: '/friends', title: '友链', render: renderFriendsPage },
  { path: '/about', title: '关于', render: renderAboutPage },
  { path: '/admin/login', title: '后台登录', render: renderAdminLoginPage },
  { path: '/admin/posts', title: '后台 · 文章管理', render: renderAdminPage },
  { path: '/admin/friends', title: '后台 · 友链管理', render: renderAdminPage },
  { path: '/admin/about', title: '后台 · 关于页', render: renderAdminPage },
  { path: '/admin/profile', title: '后台 · 名片卡', render: renderAdminPage },
  { path: '/admin/media', title: '后台 · 媒体管理', render: renderAdminPage },
  { path: '/admin/settings', title: '后台 · 站点设置', render: renderAdminPage },
  { path: '/admin', title: '内容管理', render: renderAdminPage },
  { path: NOT_FOUND_PATH, title: '404', render: renderNotFoundPage }
];

export const PRIMARY_NAV_LINKS = [
  { href: '/', label: '首页', icon: 'home' },
  { href: '/blog', label: '博客', icon: 'posts' },
  { href: '/blog/tags', label: '标签', icon: 'tags' },
  { href: '/blog/archive', label: '归档', icon: 'archive' }
] as const;

export interface RouteResolution {
  route: RouteRecord;
  context: PageRenderContext;
  isFallback: boolean;
}

export function isAdminPathname(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return normalized === '/admin' || normalized === '/admin/login' || normalized.startsWith('/admin/');
}

export function resolveAdminModule(pathname: string): AdminModuleRoute {
  const normalized = normalizePathname(pathname);
  if (!normalized.startsWith('/admin/')) {
    return 'posts';
  }

  const module = normalized.slice('/admin/'.length);

  if (module === 'friends' || module === 'about' || module === 'profile' || module === 'media' || module === 'settings') {
    return module;
  }

  return 'posts';
}

export function resolveRoute(pathname: string): RouteResolution {
  const normalizedPath = normalizePathname(pathname);

  for (const route of ROUTE_RECORDS) {
    const params = matchPath(route.path, normalizedPath);

    if (params === null) {
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
