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

/**
 * 404 页面在路由表中的固定路径。
 * 当普通路由都匹配失败时，会兜底使用它。
 */
const NOT_FOUND_PATH = '/404';

/**
 * 应用路由表（路由契约核心）。
 *
 * 说明：
 * - 静态路由：如 /posts、/about
 * - 动态路由：如 /posts/:slug、/tags/:tag
 * - 404 路由：固定 /404，用于未匹配时兜底显示
 */
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

/**
 * 顶部主导航配置。
 * main.ts 会读取这里的数据渲染导航链接。
 */
export const PRIMARY_NAV_LINKS = [
  { href: '/', label: '首页' },
  { href: '/posts', label: '文章' },
  { href: '/tags', label: '标签' },
  { href: '/archive', label: '归档' },
  { href: '/friends', label: '友链' },
  { href: '/about', label: '关于' }
] as const;

/**
 * 一次路由解析的标准结果。
 *
 * isFallback = true 表示：
 * - 用户访问的路径没有命中 ROUTE_RECORDS
 * - 当前 route 是兜底 404 路由
 */
export interface RouteResolution {
  route: RouteRecord;
  context: PageRenderContext;
  isFallback: boolean;
}

/**
 * 根据传入 pathname 解析对应路由。
 *
 * 流程：
 * 1) 先标准化路径（去掉末尾多余斜杠等）
 * 2) 按路由表顺序尝试匹配
 * 3) 命中则返回对应 route + params
 * 4) 全部失败则返回 404 兜底
 */
export function resolveRoute(pathname: string): RouteResolution {
  const normalizedPath = normalizePathname(pathname);

  for (const route of ROUTE_RECORDS) {
    const params = matchPath(route.path, normalizedPath);

    if (params !== null) {
      return {
        route,
        context: { params, pathname: normalizedPath },
        isFallback: false
      };
    }
  }

  return {
    route: getNotFoundRoute(),
    context: { params: {}, pathname: normalizedPath },
    isFallback: true
  };
}

/**
 * 统一路径格式，避免“同一路径不同写法”导致匹配失败。
 *
 * 示例：
 * - "posts"      -> "/posts"
 * - "/posts/"    -> "/posts"
 * - "" 或 "/"    -> "/"
 */
function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  const ensuredPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return ensuredPath.replace(/\/+$/, '') || '/';
}

/**
 * 匹配单条路由规则。
 *
 * 返回值：
 * - 匹配成功：返回 params（可能为空对象）
 * - 匹配失败：返回 null
 *
 * 动态参数规则：
 * - 以 ':' 开头的片段是参数位，例如 '/posts/:slug'
 * - '/posts/hello-world' 会提取得到 { slug: 'hello-world' }
 */
function matchPath(routePath: string, pathname: string): RouteParams | null {
  const routeSegments = splitPath(routePath);
  const pathnameSegments = splitPath(pathname);

  // 段数不同时一定不匹配（例如 /posts 和 /posts/a）。
  if (routeSegments.length !== pathnameSegments.length) {
    return null;
  }

  const params: RouteParams = {};

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const pathSegment = pathnameSegments[index];

    // 动态段：':xxx'，提取为参数。
    if (routeSegment.startsWith(':')) {
      const key = routeSegment.slice(1);

      // 防御：避免出现 '/posts/:' 这种非法参数定义。
      if (!key) {
        return null;
      }

      // 参数值做 decode，支持 URL 编码字符（如中文、空格）。
      params[key] = safeDecodeURIComponent(pathSegment);
      continue;
    }

    // 静态段必须完全相等，否则不匹配。
    if (routeSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

/**
 * 将路径按 '/' 切段，并去掉空段。
 *
 * 示例：
 * - '/posts/hello/' -> ['posts', 'hello']
 * - '/'             -> []
 */
function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/**
 * 安全版本的 decodeURIComponent。
 *
 * 某些非法编码字符串会导致 decodeURIComponent 抛错，
 * 这里兜底返回原值，避免整次路由解析崩溃。
 */
function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * 获取 404 路由定义。
 *
 * 这是一个“配置完整性保护”：
 * 如果误删了 '/404' 路由，直接抛错提示开发者修复配置。
 */
function getNotFoundRoute(): RouteRecord {
  const notFoundRoute = ROUTE_RECORDS.find((route) => route.path === NOT_FOUND_PATH);

  if (!notFoundRoute) {
    throw new Error('Route "/404" is required but missing.');
  }

  return notFoundRoute;
}
