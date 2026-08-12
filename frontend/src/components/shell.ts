// 应用外壳：路由渲染 + 导航/页头/页脚 + history 状态 + 页尾增强钩子
// 依赖方向：bootstrap(main.ts) → shell → router/config/features
import { renderProfileCard } from './profile-card';
import { loadSiteConfig } from '../data/site-config';
import { getThemeStats } from '../data/posts';
import { confirmAdminAction } from '../features/admin/shared';
import { PRIMARY_NAV_LINKS, isAdminPathname, resolveRoute, type PrimaryNavIcon } from '../router';
import { clearCssVar, readCssLengthPx, setCssPxVar } from '../utils/dom-style';
import { escapeHtml } from '../utils/escape-html';

type PageEnhancer = (pathname: string, options: { enableProfileCardRouteMotion: boolean }) => (() => void) | null;

let pageEnhancer: PageEnhancer | null = null;
let enhanceCleanup: (() => void) | null = null;

export function registerPageEnhancer(enhancer: PageEnhancer): void {
  pageEnhancer = enhancer;
}
const HISTORY_STATE_NAV_INDEX_KEY = '__appNavIndex' as const;
const FIXED_PREVIEW_PALETTE_ID = 'rose_atelier' as const;
const FIXED_CLARITY_PREVIEW_ID = 'flat_clean' as const;
const HEADER_DRAWER_PANEL_ID = 'header-drawer-panel' as const;
const HEADER_DRAWER_CLOSE_TRANSITION_MS = 180;
const MOBILE_HEADER_DRAWER_MEDIA_QUERY = '(max-width: 640px)';
type AppHistoryState = Record<string, unknown> & {
  [HISTORY_STATE_NAV_INDEX_KEY]?: number;
};
let currentHistoryIndex = 0;
let lastRenderedRoutePath: string | null = null;
const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('Missing #app mount element.');
}

const appElement = appRoot;


function cloneHistoryState(state: unknown = window.history.state): Record<string, unknown> {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return {};
  }

  return { ...(state as Record<string, unknown>) };
}

export function readHistoryIndex(state: unknown = window.history.state): number | null {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return null;
  }

  const maybeIndex = (state as AppHistoryState)[HISTORY_STATE_NAV_INDEX_KEY];
  return Number.isInteger(maybeIndex) && maybeIndex !== undefined && maybeIndex >= 0 ? maybeIndex : null;
}

export function applyFixedPreviewState(): void {
  document.documentElement.setAttribute('data-palette-preview', FIXED_PREVIEW_PALETTE_ID);
  document.documentElement.setAttribute('data-clarity-preview', FIXED_CLARITY_PREVIEW_ID);
}

export function createHistoryStateWithIndex(index: number, state: unknown = window.history.state): AppHistoryState {
  return {
    ...cloneHistoryState(state),
    [HISTORY_STATE_NAV_INDEX_KEY]: index
  };
}

export function ensureHistoryIndexState(): void {
  const existingIndex = readHistoryIndex(window.history.state);

  if (existingIndex !== null) {
    currentHistoryIndex = existingIndex;
    return;
  }

  currentHistoryIndex = 0;
  window.history.replaceState(
    createHistoryStateWithIndex(currentHistoryIndex),
    '',
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}


export function renderApp(): void {
  enhanceCleanup?.();
  enhanceCleanup = null;

  const { route, context, isFallback } = resolveRoute(window.location.pathname);
  const isAdminRoute = isAdminPathname(context.pathname);
  const pageTitle = isFallback ? `404 (${context.pathname})` : route.title;
  const pageContent = route.render(context);

  document.title = `${pageTitle} | ${loadSiteConfig().siteTitle}`;

  if (isAdminRoute) {
    appElement.innerHTML = renderAdminShell(pageContent);
    lastRenderedRoutePath = route.path;
    enhanceCleanup = pageEnhancer?.(context.pathname, {
      enableProfileCardRouteMotion: false
    }) ?? null;
    return;
  }

  const hasProfileCard = shouldRenderProfileCard(route.path);
  const shouldEnableProfileCardRouteMotion = shouldEnableProfileCardRouteMotionForRoute(route.path);
  const hasPostTocRail = route.path === '/blog/:slug';
  const hasPostThemeRail = route.path === '/blog';
  const isFriendsPage = route.path === '/friends';
  const isAboutPage = route.path === '/about';
  const hasFloatingScrollTopButton = shouldRenderFloatingScrollTopButton(route.path);
  const navigationMarkup = renderNavigation(context.pathname);
  const headerClassName = 'site-header site-header--wide';
  const baseMainClassName = hasProfileCard
    ? `site-main site-main--with-profile${hasPostTocRail ? ' site-main--with-post-toc' : ''}${hasPostThemeRail ? ' site-main--with-post-theme' : ''}`
    : 'site-main';
  const mainClassName = `${baseMainClassName}${isFriendsPage ? ' site-main--friends' : ''}${isAboutPage ? ' site-main--about' : ''}`;
  const mainLayout = hasProfileCard
    ? `<div class="site-main-layout${hasPostTocRail ? ' site-main-layout--with-toc' : ''}${hasPostThemeRail ? ' site-main-layout--with-theme' : ''}">
        ${renderProfileCard()}
        <div class="site-page-content">${pageContent}</div>
        ${hasPostTocRail ? renderPostTocRail() : ''}
        ${hasPostThemeRail ? renderPostThemeRail() : ''}
      </div>`
    : `<div class="site-page-content">${pageContent}</div>`;

  appElement.innerHTML = `
<a class="skip-link" href="#main-content">跳到正文</a>
<div class="app-shell">
  <header class="${headerClassName}">
    <div class="site-header-inner">
      <a href="/" class="brand" data-link>
        <strong>${loadSiteConfig().siteTitle}</strong>
        <span>${loadSiteConfig().siteSubtitle}</span>
      </a>
      <div class="site-header-right">
        <nav class="site-nav site-nav--desktop" aria-label="主导航">
          ${navigationMarkup}
        </nav>
        ${renderHeaderSearchTrigger()}
        <div class="site-header-actions">
          ${renderHeaderDrawerTrigger()}
        </div>
      </div>
    </div>
    <div class="header-drawer-panel" id="${HEADER_DRAWER_PANEL_ID}" data-role="header-drawer-panel" hidden>
      <nav class="site-nav site-nav--drawer" aria-label="移动主导航">
        ${navigationMarkup}
      </nav>
    </div>
  </header>

  <main id="main-content" class="${mainClassName}" tabindex="-1">
    ${mainLayout}
  </main>

  ${hasFloatingScrollTopButton ? renderFloatingScrollTopButton() : ''}

  <footer class="site-footer" aria-label="站点备案信息">
    <p>© ${new Date().getFullYear()} ${loadSiteConfig().copyrightOwner}. All rights reserved.</p>
    <p>${loadSiteConfig().poweredBy}</p>
    ${renderFooterRecords()}
  </footer>
</div>
`;

  lastRenderedRoutePath = route.path;
  enhanceCleanup = pageEnhancer?.(context.pathname, {
    enableProfileCardRouteMotion: shouldEnableProfileCardRouteMotion
  }) ?? null;
}

function renderAdminShell(pageContent: string): string {
  return `
<a class="skip-link" href="#main-content">跳到主要工作区</a>
<div class="admin-app-shell">
  <main id="main-content" class="admin-main-content" tabindex="-1">
    ${pageContent}
  </main>
</div>
`;
}

function shouldRenderProfileCard(routePath: string): boolean {
  return routePath === '/blog' || routePath === '/blog/:slug';
}

function shouldEnableProfileCardRouteMotionForRoute(nextRoutePath: string): boolean {
  if (lastRenderedRoutePath === null) {
    return true;
  }

  return !shouldRenderProfileCard(lastRenderedRoutePath) && shouldRenderProfileCard(nextRoutePath);
}

function shouldRenderFloatingScrollTopButton(routePath: string): boolean {
  return (
    routePath === '/' ||
    routePath === '/blog' ||
    routePath === '/blog/tags' ||
    routePath === '/blog/tags/:tag' ||
    routePath === '/blog/archive'
  );
}

function renderNavigation(pathname: string): string {
  return PRIMARY_NAV_LINKS.map(({ href, label, icon }) => {
    const isActive = isNavActive(pathname, href);
    const activeClass = isActive ? 'is-active' : '';
    const current = isActive ? ' aria-current="page"' : '';
    return `<a href="${href}" data-link class="${activeClass}"${current}>
      <span class="site-nav-icon" aria-hidden="true">${renderNavIcon(icon)}</span>
      <span class="site-nav-label">${label}</span>
    </a>`;
  }).join('');
}

function renderHeaderSearchTrigger(): string {
  return `<button
    type="button"
    class="header-search-trigger"
    data-role="header-search-trigger"
    aria-label="站内搜索"
  >
    <span class="header-search-trigger-icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="6.8" />
        <path d="m16 16 4 4" />
      </svg>
    </span>
  </button>`;
}

function renderHeaderDrawerTrigger(): string {
  return `<button
    type="button"
    class="header-drawer-trigger"
    data-role="header-drawer-trigger"
    aria-label="打开导航菜单"
    aria-controls="${HEADER_DRAWER_PANEL_ID}"
    aria-expanded="false"
  >
    <span class="header-drawer-trigger-icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </svg>
    </span>
    <span class="header-drawer-trigger-label">菜单</span>
  </button>`;
}

function renderNavIcon(icon: PrimaryNavIcon): string {
  switch (icon) {
    case 'home':
      return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 10.5 12 3l9 7.5" />
  <path d="M5.5 9.5V20h13V9.5" />
  <path d="M9.5 20v-6h5v6" />
</svg>`;
    case 'posts':
      return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
  <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
  <path d="M8.5 8h7M8.5 12h7M8.5 16h4.5" />
</svg>`;
    case 'tags':
      return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 12.5 12.5 20a2 2 0 0 1-2.8 0L3 13.3V4h9.3l7.7 7.7a2 2 0 0 1 0 2.8Z" />
  <circle cx="8.4" cy="8.4" r="1.3" />
</svg>`;
    case 'archive':
      return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3.5" y="4" width="17" height="5" rx="1.5" />
  <path d="M5.5 9v9.5A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5V9" />
  <path d="M10 13h4" />
</svg>`;
    case 'friends':
      return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="8" cy="9" r="2.6" />
  <circle cx="16.2" cy="8.3" r="2.2" />
  <path d="M3.8 18.8a4.8 4.8 0 0 1 8.4 0" />
  <path d="M13 18.8a4.1 4.1 0 0 1 7.2 0" />
</svg>`;
    case 'about':
      return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9" />
  <path d="M12 10.2v6.2" />
  <circle cx="12" cy="7.4" r=".8" fill="currentColor" stroke="none" />
</svg>`;
    default:
      return '';
  }
}

function isNavActive(currentPath: string, navHref: string): boolean {
  if (navHref === '/') {
    return currentPath === '/';
  }

  return currentPath === navHref || currentPath.startsWith(`${navHref}/`);
}

function renderFooterRecords(): string {
  const siteConfig = loadSiteConfig();
  const hasPublicSecurityRecord = Boolean(siteConfig.publicSecurityRecordText && siteConfig.publicSecurityRecordUrl);

  if (!hasPublicSecurityRecord) {
    return `<p class="site-footer-records">
      <a href="${siteConfig.icpRecordUrl}" rel="noreferrer" target="_blank">${siteConfig.icpRecordText}</a>
    </p>`;
  }

  return `<p class="site-footer-records">
    <a href="${siteConfig.icpRecordUrl}" rel="noreferrer" target="_blank">${siteConfig.icpRecordText}</a>
    <span class="site-footer-divider" aria-hidden="true">|</span>
    <a href="${siteConfig.publicSecurityRecordUrl}" rel="noreferrer" target="_blank">${siteConfig.publicSecurityRecordText}</a>
  </p>`;
}

function renderPostTocRail(): string {
  return `
<aside class="post-toc-rail" aria-label="文章侧边栏工具">
  <nav class="post-toc-card" data-role="post-toc" aria-label="文章目录导航">
    <section class="post-toc-panel" data-role="post-toc-panel" aria-hidden="true" hidden>
      <p class="post-toc-title">目录</p>
      <div class="post-toc-scroll-area">
        <ul class="post-toc-list" data-role="post-toc-list"></ul>
      </div>
    </section>
    <div class="post-toc-btt-wrap" data-role="post-detail-scroll-top-wrap" aria-hidden="true">
      <div class="post-toc-btt-inner">
        <button type="button" class="post-detail-scroll-top" data-role="post-detail-scroll-top" aria-label="回到顶部">
          <span class="btt-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </span>
          <span class="btt-percent" data-role="post-detail-scroll-top-percent">0%</span>
        </button>
      </div>
    </div>
  </nav>
</aside>
`;
}

function renderPostThemeRail(): string {
  const themeStats = getThemeStats();

  const themeButtons = themeStats
    .map(
      (themeStat) => `<li class="post-theme-item">
      <button
        type="button"
        class="post-theme-filter-btn"
        data-role="post-theme-filter-btn"
        data-theme-key="${escapeHtml(themeStat.key)}"
        aria-pressed="false"
      >
        <span class="post-theme-filter-label">${escapeHtml(themeStat.label)}</span>
        <span class="post-theme-filter-count">${themeStat.count}</span>
      </button>
    </li>`
    )
    .join('');

  const emptyState = `<p class="post-theme-empty">暂未配置主题分类，可在文章 frontmatter 中填写 <code>theme</code>。</p>`;

  return `
<aside class="post-theme-rail" aria-label="主题分类筛选">
  <section class="post-theme-card" data-role="post-theme-card">
    <p class="post-theme-title">主题分类</p>
    ${themeStats.length
      ? `<ul class="post-theme-list">${themeButtons}</ul>
        <div class="post-theme-reset-wrap" data-role="post-theme-reset-wrap" aria-hidden="true" hidden>
          <div class="post-theme-reset-inner">
            <button type="button" class="post-theme-reset-btn" data-role="post-theme-reset-btn">返回全部文章</button>
          </div>
        </div>`
      : emptyState}
  </section>
</aside>
`;
}

function renderFloatingScrollTopButton(): string {
  return `
<div class="floating-scroll-top-wrap" data-role="post-detail-scroll-top-wrap" aria-hidden="true">
  <button
    type="button"
    class="post-detail-scroll-top post-detail-scroll-top--floating"
    data-role="post-detail-scroll-top"
    aria-label="回到顶部"
  >
    <span class="btt-icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    </span>
    <span class="btt-percent" data-role="post-detail-scroll-top-percent">0%</span>
  </button>
</div>
`;
}

export function hasUnsavedAdminChanges(): boolean {
  const adminAppElement = document.querySelector<HTMLElement>('.admin-app');
  return adminAppElement?.dataset.adminDirty === 'true';
}

export async function confirmAdminNavigation(nextLocation: string): Promise<boolean> {
  if (!hasUnsavedAdminChanges()) {
    return true;
  }

  const nextPathname = new URL(nextLocation, window.location.origin).pathname;
  const isInAdminNow = document.querySelector<HTMLElement>('.admin-app') !== null;
  const isStayingInsideAdmin = isInAdminNow && isAdminPathname(nextPathname);
  const message = isStayingInsideAdmin
    ? '当前有未保存变更，确认切换模块并丢弃这些改动吗？'
    : '当前有未保存变更，确认离开后台并丢弃这些改动吗？';

  return confirmAdminAction({
    title: '放弃未保存的修改？',
    message
  });
}

export async function navigateTo(path: string, options: { replace?: boolean } = {}): Promise<void> {
  const url = new URL(path, window.location.origin);
  const nextLocation = `${url.pathname}${url.search}${url.hash}`;
  const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (currentLocation === nextLocation) {
    if (options.replace) {
      window.history.replaceState(createHistoryStateWithIndex(currentHistoryIndex), '', nextLocation);
      renderApp();
    }
    return;
  }

  if (!(await confirmAdminNavigation(nextLocation))) {
    return;
  }

  if (options.replace) {
    window.history.replaceState(createHistoryStateWithIndex(currentHistoryIndex), '', nextLocation);
  } else {
    currentHistoryIndex += 1;
    window.history.pushState(createHistoryStateWithIndex(currentHistoryIndex), '', nextLocation);
  }

  renderApp();
  window.scrollTo(0, 0);
}

export function setupHeaderDrawer(): (() => void) | null {
  const triggerButton = document.querySelector<HTMLButtonElement>('[data-role="header-drawer-trigger"]');
  const panelElement = document.querySelector<HTMLElement>('[data-role="header-drawer-panel"]');
  const searchTriggerButton = document.querySelector<HTMLButtonElement>('[data-role="header-search-trigger"]');

  if (!triggerButton || !panelElement) {
    return null;
  }

  const mobileMediaQuery = window.matchMedia(MOBILE_HEADER_DRAWER_MEDIA_QUERY);
  let closeTransitionTimer = 0;
  let isOpen = false;

  const clearCloseTransitionTimer = (): void => {
    if (!closeTransitionTimer) {
      return;
    }

    window.clearTimeout(closeTransitionTimer);
    closeTransitionTimer = 0;
  };

  const syncTriggerState = (open: boolean): void => {
    triggerButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    triggerButton.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
  };

  const closeDrawer = (options: { immediate?: boolean } = {}): void => {
    if (!isOpen && panelElement.hidden) {
      return;
    }

    isOpen = false;
    clearCloseTransitionTimer();
    syncTriggerState(false);
    document.body.classList.remove('is-header-drawer-open');
    panelElement.classList.remove('is-open');

    if (options.immediate || panelElement.hidden) {
      panelElement.hidden = true;
      return;
    }

    closeTransitionTimer = window.setTimeout(() => {
      closeTransitionTimer = 0;
      panelElement.hidden = true;
    }, HEADER_DRAWER_CLOSE_TRANSITION_MS);
  };

  const openDrawer = (): void => {
    if (!mobileMediaQuery.matches || isOpen) {
      return;
    }

    isOpen = true;
    clearCloseTransitionTimer();
    syncTriggerState(true);
    panelElement.hidden = false;
    document.body.classList.add('is-header-drawer-open');

    window.requestAnimationFrame(() => {
      if (!isOpen || panelElement.hidden) {
        return;
      }

      panelElement.classList.add('is-open');
    });
  };

  const toggleDrawer = (): void => {
    if (isOpen) {
      closeDrawer();
      return;
    }

    openDrawer();
  };

  const handleTriggerClick = (): void => {
    toggleDrawer();
  };

  const handleSearchTriggerClickCapture = (): void => {
    if (!isOpen) {
      return;
    }

    closeDrawer({ immediate: true });
  };

  const handlePanelClick = (event: MouseEvent): void => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('a[data-link]')) {
      closeDrawer({ immediate: true });
    }
  };

  const handleDocumentClick = (event: MouseEvent): void => {
    if (!isOpen || !mobileMediaQuery.matches) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Node)) {
      return;
    }

    if (triggerButton.contains(target) || panelElement.contains(target)) {
      return;
    }

    closeDrawer();
  };

  const handleDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !isOpen) {
      return;
    }

    event.preventDefault();
    closeDrawer();
    triggerButton.focus();
  };

  const handleViewportChange = (event: MediaQueryListEvent): void => {
    if (event.matches) {
      return;
    }

    closeDrawer({ immediate: true });
  };

  panelElement.hidden = true;
  panelElement.classList.remove('is-open');
  syncTriggerState(false);

  triggerButton.addEventListener('click', handleTriggerClick);
  panelElement.addEventListener('click', handlePanelClick);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleDocumentKeydown);
  mobileMediaQuery.addEventListener('change', handleViewportChange);
  searchTriggerButton?.addEventListener('click', handleSearchTriggerClickCapture, true);

  return () => {
    closeDrawer({ immediate: true });
    clearCloseTransitionTimer();

    triggerButton.removeEventListener('click', handleTriggerClick);
    panelElement.removeEventListener('click', handlePanelClick);
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleDocumentKeydown);
    mobileMediaQuery.removeEventListener('change', handleViewportChange);
    searchTriggerButton?.removeEventListener('click', handleSearchTriggerClickCapture, true);
    document.body.classList.remove('is-header-drawer-open');
  };
}


export function setupScrollTopButton(): (() => void) | null {
  const scrollTopButtonElement = document.querySelector<HTMLButtonElement>('[data-role="post-detail-scroll-top"]');
  const scrollTopButtonWrapElement = document.querySelector<HTMLElement>('[data-role="post-detail-scroll-top-wrap"]');
  const pageContentElement = document.querySelector<HTMLElement>('.site-page-content');
  const footerElement = document.querySelector<HTMLElement>('.site-footer');

  if (!scrollTopButtonElement) {
    return null;
  }

  const percentElement = scrollTopButtonElement.querySelector<HTMLElement>('[data-role="post-detail-scroll-top-percent"]');
  const VISIBILITY_THRESHOLD = 8;
  const FLOATING_BREAKPOINT = 960;
  const MIN_FLOATING_RIGHT = 16;
  const isFloatingScrollTopButton = Boolean(scrollTopButtonWrapElement?.classList.contains('floating-scroll-top-wrap'));

  const syncFloatingPositionState = (): void => {
    if (!scrollTopButtonWrapElement || !isFloatingScrollTopButton) {
      return;
    }

    const viewportWidth = window.innerWidth;
    const isDesktop = viewportWidth > FLOATING_BREAKPOINT;

    if (isDesktop && pageContentElement) {
      const contentRect = pageContentElement.getBoundingClientRect();
      const rightBlankWidth = Math.max(0, viewportWidth - contentRect.right);
      const targetRight = Math.max(MIN_FLOATING_RIGHT, rightBlankWidth / 2);
      setCssPxVar(scrollTopButtonWrapElement, '--floating-scroll-right', targetRight);
    } else {
      clearCssVar(scrollTopButtonWrapElement, '--floating-scroll-right');
    }

    if (!isDesktop || !footerElement) {
      clearCssVar(scrollTopButtonWrapElement, '--floating-scroll-footer-offset');
      return;
    }

    const wrapStyle = getComputedStyle(scrollTopButtonWrapElement);
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const baseBottom = readCssLengthPx(wrapStyle, '--floating-scroll-bottom', 2 * rootFontSize, rootFontSize);
    const footerGap = readCssLengthPx(wrapStyle, '--floating-scroll-footer-gap', 8, rootFontSize);
    const footerRect = footerElement.getBoundingClientRect();
    const requiredBottom = window.innerHeight - footerRect.top + footerGap;
    const footerOffset = Math.max(0, requiredBottom - baseBottom);

    setCssPxVar(scrollTopButtonWrapElement, '--floating-scroll-footer-offset', footerOffset);
  };

  const syncButtonState = (): void => {
    const scrollTop = Math.max(window.scrollY, 0);
    const maxScrollableHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    ) - window.innerHeight;
    const progressRatio = maxScrollableHeight > 0 ? scrollTop / maxScrollableHeight : 0;
    const progressPercent = Math.max(0, Math.min(100, Math.round(progressRatio * 100)));
    const shouldShow = scrollTop > VISIBILITY_THRESHOLD;

    scrollTopButtonElement.classList.toggle('is-visible', shouldShow);
    scrollTopButtonWrapElement?.classList.toggle('is-visible', shouldShow);
    scrollTopButtonWrapElement?.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    syncFloatingPositionState();
    if (percentElement) {
      percentElement.textContent = `${progressPercent}%`;
    }
  };

  const handleWindowScroll = (): void => {
    syncButtonState();
  };

  const handleWindowResize = (): void => {
    syncButtonState();
  };

  const handleButtonClick = (event: MouseEvent): void => {
    event.preventDefault();

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  };

  syncButtonState();
  window.addEventListener('scroll', handleWindowScroll, { passive: true });
  window.addEventListener('resize', handleWindowResize);
  scrollTopButtonElement.addEventListener('click', handleButtonClick);

  return () => {
    window.removeEventListener('scroll', handleWindowScroll);
    window.removeEventListener('resize', handleWindowResize);
    scrollTopButtonElement.removeEventListener('click', handleButtonClick);
  };
}

export function getCurrentHistoryIndex(): number {
  return currentHistoryIndex;
}

export function setCurrentHistoryIndex(index: number): void {
  currentHistoryIndex = index;
}

