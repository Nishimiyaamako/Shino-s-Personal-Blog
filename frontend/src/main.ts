import './styles/global.css';

import { renderPostList } from './components/post-list';
import { renderProfileCard } from './components/profile-card';
import { loadSiteConfig } from './data/site-config';
import { fetchAboutViewModel } from './data/about';
import { getPostsByTag, getThemeStats } from './data/posts';
import { setupAdminDashboard, setupAdminLogin } from './features/admin';
import { setupHeaderSearchModal, setupPublicDataHydration } from './features/public-runtime';
import { renderAboutPageBody } from './pages/about';
import { PRIMARY_NAV_LINKS, isAdminPathname, resolveRoute, type PrimaryNavIcon } from './router';
import { clearCssVar, readCssLengthPx, setCssPxVar, setCssVar } from './utils/dom-style';
import { escapeHtml } from './utils/escape-html';
import { normalizeThemeKey } from './utils/theme';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('Missing #app mount element.');
}

const appElement = appRoot;
let cleanupPageEnhancements: (() => void) | null = null;
type MotionScopeNode = Document | Element;
interface RefreshPostCardMotionOptions {
  replay?: boolean;
}
interface AboutContentMotionOptions {
  root?: ParentNode;
  animateInitialVisibleItems?: boolean;
}
type SidePanelDirectionClassName = 'motion-side-pop-item--from-left' | 'motion-side-pop-item--from-right';
type ContentRhythmGroup = 'lead' | 'body';

interface SidePanelMotionGroupConfig {
  selectors: readonly string[];
  directionClassName: SidePanelDirectionClassName;
  variantClassName: 'motion-side-pop-item--profile' | 'motion-side-pop-item--theme' | 'motion-side-pop-item--toc';
  delayBaseMs: number;
  shouldIncludeGroup?: boolean;
  shouldIncludeTarget?: (targetElement: HTMLElement) => boolean;
  innerSelectors?: readonly string[];
  avatarSelectors?: readonly string[];
}

let refreshPostCardMotion: ((scope?: MotionScopeNode, options?: RefreshPostCardMotionOptions) => void) | null = null;
let lastRenderedRoutePath: string | null = null;
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
let suppressNextPopstateRender = false;

function cloneHistoryState(state: unknown = window.history.state): Record<string, unknown> {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return {};
  }

  return { ...(state as Record<string, unknown>) };
}

function readHistoryIndex(state: unknown = window.history.state): number | null {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return null;
  }

  const maybeIndex = (state as AppHistoryState)[HISTORY_STATE_NAV_INDEX_KEY];
  return Number.isInteger(maybeIndex) && maybeIndex !== undefined && maybeIndex >= 0 ? maybeIndex : null;
}

function applyFixedPreviewState(): void {
  document.documentElement.setAttribute('data-palette-preview', FIXED_PREVIEW_PALETTE_ID);
  document.documentElement.setAttribute('data-clarity-preview', FIXED_CLARITY_PREVIEW_ID);
}

function createHistoryStateWithIndex(index: number, state: unknown = window.history.state): AppHistoryState {
  return {
    ...cloneHistoryState(state),
    [HISTORY_STATE_NAV_INDEX_KEY]: index
  };
}

function ensureHistoryIndexState(): void {
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

function renderApp(): void {
  cleanupPageEnhancements?.();
  cleanupPageEnhancements = null;

  const { route, context, isFallback } = resolveRoute(window.location.pathname);
  const isAdminRoute = isAdminPathname(context.pathname);
  const pageTitle = isFallback ? `404 (${context.pathname})` : route.title;
  const pageContent = route.render(context);

  document.title = `${pageTitle} | ${loadSiteConfig().siteTitle}`;

  if (isAdminRoute) {
    appElement.innerHTML = renderAdminShell(pageContent);
    lastRenderedRoutePath = route.path;
    cleanupPageEnhancements = setupPageEnhancements(context.pathname, {
      enableProfileCardRouteMotion: false
    });
    return;
  }

  const hasProfileCard = shouldRenderProfileCard(route.path);
  const shouldEnableProfileCardRouteMotion = shouldEnableProfileCardRouteMotionForRoute(route.path);
  const hasPostTocRail = route.path === '/posts/:slug';
  const hasPostThemeRail = route.path === '/posts';
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
  cleanupPageEnhancements = setupPageEnhancements(context.pathname, {
    enableProfileCardRouteMotion: shouldEnableProfileCardRouteMotion
  });
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
  return routePath === '/' || routePath === '/posts' || routePath === '/posts/:slug';
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
    routePath === '/posts' ||
    routePath === '/tags' ||
    routePath === '/tags/:tag' ||
    routePath === '/archive'
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

function hasUnsavedAdminChanges(): boolean {
  const adminDashboardElement = document.querySelector<HTMLElement>('.page-admin-dashboard');
  return adminDashboardElement?.dataset.adminDirty === 'true';
}

function confirmAdminNavigation(nextLocation: string): boolean {
  if (!hasUnsavedAdminChanges()) {
    return true;
  }

  const nextPathname = new URL(nextLocation, window.location.origin).pathname;
  const isInAdminNow = document.querySelector<HTMLElement>('.page-admin-dashboard') !== null;
  const isStayingInsideAdmin = isInAdminNow && isAdminPathname(nextPathname);
  const message = isStayingInsideAdmin
    ? '当前有未保存变更，确认切换模块并丢弃这些改动吗？'
    : '当前有未保存变更，确认离开后台并丢弃这些改动吗？';

  return window.confirm(message);
}

function navigateTo(path: string, options: { replace?: boolean } = {}): void {
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

  if (!confirmAdminNavigation(nextLocation)) {
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

function setupHeaderDrawer(): (() => void) | null {
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

function setupPageEnhancements(pathname: string, options: { enableProfileCardRouteMotion: boolean }): (() => void) | null {
  const cleanups: Array<() => void> = [];
  const currentSearch = window.location.search;

  if (isAdminPathname(pathname)) {
    if (pathname === '/admin/login') {
      const cleanupAdminLogin = setupAdminLogin({
        onNavigate: (path, navigateOptions) => navigateTo(path, navigateOptions),
        currentPathname: pathname,
        currentSearch
      });

      if (!cleanupAdminLogin) {
        return null;
      }

      return () => {
        cleanupAdminLogin();
      };
    }

    const cleanupAdminDashboard = setupAdminDashboard({
      onNavigate: (path, navigateOptions) => navigateTo(path, navigateOptions),
      currentPathname: pathname,
      currentSearch
    });

    if (!cleanupAdminDashboard) {
      return null;
    }

    return () => {
      cleanupAdminDashboard();
    };
  }

  const cleanupHeaderDrawer = setupHeaderDrawer();
  if (cleanupHeaderDrawer) {
    cleanups.push(cleanupHeaderDrawer);
  }

  const cleanupHeaderSearchModal = setupHeaderSearchModal();
  if (cleanupHeaderSearchModal) {
    cleanups.push(cleanupHeaderSearchModal);
  }

  const cleanupPublicDataHydration = setupPublicDataHydration(pathname, {
    onDataChanged: () => {
      if (window.location.pathname !== pathname) {
        return;
      }

      renderApp();
    }
  });
  if (cleanupPublicDataHydration) {
    cleanups.push(cleanupPublicDataHydration);
  }

  const cleanupMobileSidePanelPlacement = setupMobileSidePanelPlacement(pathname);
  if (cleanupMobileSidePanelPlacement) {
    cleanups.push(cleanupMobileSidePanelPlacement);
  }

  const cleanupRouteEnterTransition = setupRouteEnterTransition();
  if (cleanupRouteEnterTransition) {
    cleanups.push(cleanupRouteEnterTransition);
  }

  const cleanupSidePanelPopMotion = setupSidePanelPopMotion({
    groups: [
      {
        selectors: PROFILE_CARD_POP_SELECTORS,
        directionClassName: 'motion-side-pop-item--from-left',
        variantClassName: 'motion-side-pop-item--profile',
        delayBaseMs: 84,
        shouldIncludeGroup: options.enableProfileCardRouteMotion,
        innerSelectors: ['.profile-card-meta h2', '.profile-card-meta p', '.profile-contact-link', '.profile-stat-card'],
        avatarSelectors: ['.profile-card-avatar']
      },
      {
        selectors: ['.post-theme-rail .post-theme-card'],
        directionClassName: 'motion-side-pop-item--from-right',
        variantClassName: 'motion-side-pop-item--theme',
        delayBaseMs: 84,
        shouldIncludeTarget: (targetElement) => !targetElement.closest<HTMLElement>('.post-theme-rail.is-inline-mobile'),
        innerSelectors: ['.post-theme-item']
      },
      {
        selectors: ['.post-toc-rail .post-toc-card'],
        directionClassName: 'motion-side-pop-item--from-right',
        variantClassName: 'motion-side-pop-item--toc',
        delayBaseMs: 84,
        shouldIncludeTarget: (targetElement) => !targetElement.closest<HTMLElement>('.post-toc-rail.is-inline-mobile'),
        innerSelectors: ['.post-toc-item']
      }
    ]
  });
  if (cleanupSidePanelPopMotion) {
    cleanups.push(cleanupSidePanelPopMotion);
  }

  const cleanupPostCardRiseMotion = setupPostCardRiseMotion();
  if (cleanupPostCardRiseMotion) {
    cleanups.push(cleanupPostCardRiseMotion);
  }

  const cleanupGlobalMotionChoreography = setupGlobalMotionChoreography();
  if (cleanupGlobalMotionChoreography) {
    cleanups.push(cleanupGlobalMotionChoreography);
  }

  const cleanupScrollTopButton = setupScrollTopButton();
  if (cleanupScrollTopButton) {
    cleanups.push(cleanupScrollTopButton);
  }

  if (pathname === '/tags') {
    const cleanupTagCloudInteractions = setupTagCloudInteractions();
    if (cleanupTagCloudInteractions) {
      cleanups.push(cleanupTagCloudInteractions);
    }
  }

  if (pathname === '/posts') {
    const cleanupPostDateSortToggle = setupPostDateSortToggle();
    if (cleanupPostDateSortToggle) {
      cleanups.push(cleanupPostDateSortToggle);
    }

    const cleanupPostThemeFilter = setupPostThemeFilter();
    if (cleanupPostThemeFilter) {
      cleanups.push(cleanupPostThemeFilter);
    }
  }

  if (pathname.startsWith('/posts/')) {
    const cleanupPostDetailBackButton = setupPostDetailBackButton();
    if (cleanupPostDetailBackButton) {
      cleanups.push(cleanupPostDetailBackButton);
    }

    const cleanupPostDetailToc = setupPostDetailToc();
    if (cleanupPostDetailToc) {
      cleanups.push(cleanupPostDetailToc);
    }

    const cleanupPostDetailCodeBlockCopy = setupPostDetailCodeBlockCopy();
    if (cleanupPostDetailCodeBlockCopy) {
      cleanups.push(cleanupPostDetailCodeBlockCopy);
    }
  }

  if (pathname === '/archive') {
    const cleanupArchiveTimeline = setupArchiveTimelineReveal();
    if (cleanupArchiveTimeline) {
      cleanups.push(cleanupArchiveTimeline);
    }
  }

  if (pathname === '/friends') {
    const cleanupFriendLinkCopyButton = setupFriendLinkCopyButton();
    if (cleanupFriendLinkCopyButton) {
      cleanups.push(cleanupFriendLinkCopyButton);
    }
  }

  if (pathname === '/about') {
    let cleanupAboutContentMotion = setupAboutContentMotion();
    if (cleanupAboutContentMotion) {
      cleanups.push(() => {
        cleanupAboutContentMotion?.();
        cleanupAboutContentMotion = null;
      });
    }

    const cleanupAboutPageHydration = setupAboutPageHydration({
      onHydrated: (aboutPageElement) => {
        cleanupAboutContentMotion?.();
        cleanupAboutContentMotion = setupAboutContentMotion({
          root: aboutPageElement,
          animateInitialVisibleItems: true
        });
      }
    });
    if (cleanupAboutPageHydration) {
      cleanups.push(cleanupAboutPageHydration);
    }
  }

  if (!cleanups.length) {
    return null;
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

const PAGE_STAGGER_SELECTORS = [
  ':scope > .section-head',
  ':scope > .page-section',
  ':scope > .about-hero',
  ':scope > .about-intro',
  ':scope > .about-divider',
  ':scope > .about-dialogue',
  ':scope > .about-timeline',
  ':scope > .hero-card',
  ':scope > .page-not-found',
  ':scope > .tag-filter-shell',
  ':scope > .tag-result-shell',
  ':scope > .tag-detail-header',
  ':scope > .archive-timeline',
  ':scope > .friend-link-add-card',
  ':scope > .empty-hint'
] as const;

const PAGE_SCROLL_REVEAL_SELECTORS = [
  '.stats-list > li'
] as const;

const POST_CARD_MOTION_SELECTORS = [
  '.post-list--home > .post-card[data-motion-card]',
  '.post-list--posts > .post-card[data-motion-card]',
  '.post-list--tag-panel > .post-card[data-motion-card]',
  '.friend-link-list > .friend-link-card[data-motion-card]'
] as const;
const PROFILE_CARD_POP_SELECTORS = [
  '.profile-card'
] as const;
const POST_DETAIL_READING_MOTION_SELECTORS = {
  header: ':scope > .page-header',
  backRow: ':scope > .post-detail-back-row',
  markdown: '.post-detail-layout > .markdown-content'
} as const;
const POST_LIST_SELECTOR = '.post-list, .friend-link-list';
const HOME_POST_LIST_CLASS = 'post-list--home';
const POST_CARD_ROW_TOLERANCE_PX = 10;
const POST_CARD_STAGGER_CAP = 10;
const MOBILE_SIDE_PANEL_MEDIA_QUERY = '(max-width: 1024px)';
const SIDE_PANEL_RHYTHM_GROUP_STEP_MS = 86;
const SIDE_PANEL_RHYTHM_ITEM_STEP_MS = 70;
const SIDE_PANEL_INNER_STAGGER_BASE_MS = 108;
const SIDE_PANEL_INNER_STAGGER_STEP_MS = 54;
const SIDE_PANEL_INNER_CHAIN_OFFSET_MS = 206;
const SIDE_PANEL_PROFILE_AVATAR_DELAY_BASE_MS = 154;
const SIDE_PANEL_PROFILE_AVATAR_STEP_MS = 26;
const CONTENT_RHYTHM_LEAD_GROUP_DELAY_MS = 22;
const CONTENT_RHYTHM_BODY_GROUP_DELAY_MS = 86;
const CONTENT_RHYTHM_ITEM_STEP_MS = 62;
const POST_DETAIL_READING_RHYTHM_GROUP_DELAY_MS = 86;
const MOTION_DELAY_MS = {
  routeEnterStep: 29,
  about: {
    intro: {
      initialBase: 250,
      initialStep: 98,
      scrollStep: 74
    },
    dialogue: {
      initialBase: 470,
      initialStep: 115,
      scrollStep: 89
    },
    timeline: {
      initialBase: 658,
      initialStep: 106,
      scrollStep: 86
    },
    desktopDialogueOffset: {
      initial: 34,
      scroll: 29
    }
  }
} as const;
const ABOUT_INTRO_ITEM_SELECTOR = '[data-about-motion="intro-item"]';
const ABOUT_DIALOGUE_ITEM_SELECTOR = '[data-about-motion="dialogue-item"]';
const ABOUT_TIMELINE_ITEM_SELECTOR = '[data-about-motion="timeline-item"]';

function restoreNodePlacement(node: HTMLElement, parent: Node, nextSibling: ChildNode | null): void {
  if (nextSibling && nextSibling.parentNode === parent) {
    parent.insertBefore(node, nextSibling);
    return;
  }

  parent.appendChild(node);
}

function resolveContentRhythmGroup(targetElement: HTMLElement): ContentRhythmGroup {
  if (
    targetElement.classList.contains('section-head')
    || targetElement.classList.contains('about-hero')
    || targetElement.classList.contains('hero-card')
    || targetElement.classList.contains('tag-filter-shell')
    || targetElement.classList.contains('tag-detail-header')
    || targetElement.classList.contains('page-not-found')
  ) {
    return 'lead';
  }

  return 'body';
}

function setupMobileSidePanelPlacement(pathname: string): (() => void) | null {
  const mediaQuery = window.matchMedia(MOBILE_SIDE_PANEL_MEDIA_QUERY);
  const shouldHandlePostsPage = pathname === '/posts';
  const shouldHandlePostDetailPage = pathname.startsWith('/posts/');

  const postThemeRailElement = shouldHandlePostsPage
    ? document.querySelector<HTMLElement>('.post-theme-rail')
    : null;
  const postThemeCardElement = postThemeRailElement?.querySelector<HTMLElement>('.post-theme-card') ?? null;
  const postsToolbarElement = shouldHandlePostsPage
    ? document.querySelector<HTMLElement>('.page-posts [data-role="posts-toolbar"]')
    : null;
  const postTocRailElement = shouldHandlePostDetailPage
    ? document.querySelector<HTMLElement>('.post-toc-rail')
    : null;
  const postDetailLayoutElement = shouldHandlePostDetailPage
    ? document.querySelector<HTMLElement>('.page-post-detail .post-detail-layout')
    : null;
  const markdownContentElement = postDetailLayoutElement?.querySelector<HTMLElement>('.markdown-content') ?? null;

  const originalPostThemeParent = postThemeRailElement?.parentNode ?? null;
  const originalPostThemeNextSibling = postThemeRailElement?.nextSibling ?? null;
  const originalPostTocParent = postTocRailElement?.parentNode ?? null;
  const originalPostTocNextSibling = postTocRailElement?.nextSibling ?? null;

  if (!postThemeRailElement && !postTocRailElement) {
    return null;
  }

  let postThemeToggleButton: HTMLButtonElement | null = null;
  let handlePostThemeToggleClick: (() => void) | null = null;

  const syncPostThemeCollapsedState = (isCollapsed: boolean): void => {
    if (!postThemeCardElement) {
      return;
    }

    postThemeCardElement.classList.toggle('is-collapsed', isCollapsed);
    if (postThemeToggleButton) {
      postThemeToggleButton.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    }
  };

  const ensurePostThemeToggleButton = (): void => {
    if (!postThemeCardElement || !postsToolbarElement || postThemeToggleButton) {
      return;
    }

    postThemeToggleButton = document.createElement('button');
    postThemeToggleButton.type = 'button';
    postThemeToggleButton.className = 'post-theme-mobile-toggle';
    postThemeToggleButton.setAttribute('aria-label', '切换主题筛选展开状态');
    postThemeToggleButton.textContent = '主题筛选';
    postsToolbarElement.append(postThemeToggleButton);

    handlePostThemeToggleClick = () => {
      const isCollapsed = postThemeCardElement.classList.contains('is-collapsed');
      syncPostThemeCollapsedState(!isCollapsed);
    };

    postThemeToggleButton.addEventListener('click', handlePostThemeToggleClick);
  };

  const applyPlacement = (): void => {
    const isMobileViewport = mediaQuery.matches;

    if (postThemeRailElement && originalPostThemeParent && shouldHandlePostsPage) {
      if (isMobileViewport && postsToolbarElement?.parentNode) {
        postsToolbarElement.insertAdjacentElement('afterend', postThemeRailElement);
        postThemeRailElement.classList.add('is-inline-mobile');
        ensurePostThemeToggleButton();
        if (postThemeToggleButton) {
          postThemeToggleButton.hidden = false;
        }
        syncPostThemeCollapsedState(true);
      } else {
        restoreNodePlacement(postThemeRailElement, originalPostThemeParent, originalPostThemeNextSibling);
        postThemeRailElement.classList.remove('is-inline-mobile');
        if (postThemeToggleButton) {
          postThemeToggleButton.hidden = true;
        }
        syncPostThemeCollapsedState(false);
      }
    }

    if (postTocRailElement && originalPostTocParent && shouldHandlePostDetailPage) {
      if (isMobileViewport && postDetailLayoutElement && markdownContentElement) {
        postDetailLayoutElement.insertBefore(postTocRailElement, markdownContentElement);
        postTocRailElement.classList.add('is-inline-mobile');
      } else {
        restoreNodePlacement(postTocRailElement, originalPostTocParent, originalPostTocNextSibling);
        postTocRailElement.classList.remove('is-inline-mobile');
      }
    }
  };

  const handleViewportChange = (): void => {
    applyPlacement();
  };

  applyPlacement();
  mediaQuery.addEventListener('change', handleViewportChange);

  return () => {
    mediaQuery.removeEventListener('change', handleViewportChange);

    if (postThemeRailElement && originalPostThemeParent) {
      restoreNodePlacement(postThemeRailElement, originalPostThemeParent, originalPostThemeNextSibling);
      postThemeRailElement.classList.remove('is-inline-mobile');
    }

    if (postTocRailElement && originalPostTocParent) {
      restoreNodePlacement(postTocRailElement, originalPostTocParent, originalPostTocNextSibling);
      postTocRailElement.classList.remove('is-inline-mobile');
    }

    syncPostThemeCollapsedState(false);

    if (postThemeToggleButton && handlePostThemeToggleClick) {
      postThemeToggleButton.removeEventListener('click', handlePostThemeToggleClick);
      postThemeToggleButton.remove();
    }
  };
}

function setupRouteEnterTransition(): (() => void) | null {
  const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (reducedMotionMediaQuery.matches) {
    return null;
  }

  const routeEnterTargets = Array.from(
    document.querySelectorAll<HTMLElement>('.site-page-content, .site-footer')
  );

  if (!routeEnterTargets.length) {
    return null;
  }

  for (const [index, targetElement] of routeEnterTargets.entries()) {
    targetElement.classList.add('route-enter-target');
    setCssVar(targetElement, '--route-enter-delay', `${index * MOTION_DELAY_MS.routeEnterStep}ms`);
  }

  const frameId = window.requestAnimationFrame(() => {
    for (const targetElement of routeEnterTargets) {
      targetElement.classList.add('is-entered');
    }
  });

  const handleReducedMotionChange = (event: MediaQueryListEvent): void => {
    if (!event.matches) {
      return;
    }

    window.cancelAnimationFrame(frameId);
    for (const targetElement of routeEnterTargets) {
      targetElement.classList.add('is-entered');
    }
  };

  reducedMotionMediaQuery.addEventListener('change', handleReducedMotionChange);

  return () => {
    window.cancelAnimationFrame(frameId);
    reducedMotionMediaQuery.removeEventListener('change', handleReducedMotionChange);
  };
}

function setupSidePanelPopMotion(options: { groups: readonly SidePanelMotionGroupConfig[] }): (() => void) | null {
  const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopViewportMediaQuery = window.matchMedia('(min-width: 1025px)');
  const collectOrderedTargets = (
    selectors: readonly string[],
    shouldIncludeTarget?: (targetElement: HTMLElement) => boolean
  ): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>(selectors.join(',')))
      .filter((targetElement) => shouldIncludeTarget?.(targetElement) ?? true)
      .map((targetElement, domIndex) => {
        const rect = targetElement.getBoundingClientRect();

        return {
          targetElement,
          top: rect.top,
          left: rect.left,
          domIndex
        };
      })
      .sort((leftEntry, rightEntry) => {
        if (leftEntry.top !== rightEntry.top) {
          return leftEntry.top - rightEntry.top;
        }

        if (leftEntry.left !== rightEntry.left) {
          return leftEntry.left - rightEntry.left;
        }

        return leftEntry.domIndex - rightEntry.domIndex;
      })
      .map((entry) => entry.targetElement);

  const motionGroups = options.groups
    .filter((groupOption) => groupOption.shouldIncludeGroup ?? true)
    .map((groupOption) => {
      return {
        ...groupOption,
        targets: collectOrderedTargets(groupOption.selectors, groupOption.shouldIncludeTarget)
      };
    })
    .filter((group): group is SidePanelMotionGroupConfig & { targets: HTMLElement[] } => Boolean(group.targets.length));

  if (!motionGroups.length) {
    return null;
  }

  const groupDelayByIndex = new Map<number, number>();
  const orderedGroupsByVisualFlow = motionGroups
    .map((group, groupIndex) => {
      const anchorTarget = group.targets[0];
      const rect = anchorTarget?.getBoundingClientRect();

      return {
        groupIndex,
        top: rect?.top ?? Number.MAX_SAFE_INTEGER,
        left: rect?.left ?? Number.MAX_SAFE_INTEGER
      };
    })
    .sort((leftEntry, rightEntry) => {
      if (leftEntry.top !== rightEntry.top) {
        return leftEntry.top - rightEntry.top;
      }

      return leftEntry.left - rightEntry.left;
    });

  for (const [order, groupMeta] of orderedGroupsByVisualFlow.entries()) {
    groupDelayByIndex.set(groupMeta.groupIndex, order * SIDE_PANEL_RHYTHM_GROUP_STEP_MS);
  }

  const groupedInnerTargets: HTMLElement[][] = [];
  const groupedAvatarTargets: HTMLElement[][] = [];

  for (const [groupIndex, group] of motionGroups.entries()) {
    const groupRhythmDelayMs = groupDelayByIndex.get(groupIndex) ?? 0;

    for (const [index, targetElement] of group.targets.entries()) {
      const itemRhythmDelayMs = index * SIDE_PANEL_RHYTHM_ITEM_STEP_MS;
      targetElement.classList.add('motion-side-pop-item', group.directionClassName, group.variantClassName);
      setCssVar(targetElement, '--motion-index', String(index));
      setCssVar(targetElement, '--motion-side-pop-delay-base', `${group.delayBaseMs}ms`);
      setCssVar(targetElement, '--motion-rhythm-group-delay', `${groupRhythmDelayMs}ms`);
      setCssVar(targetElement, '--motion-rhythm-item-delay', `${itemRhythmDelayMs}ms`);
    }

    const innerTargets: HTMLElement[] = [];
    const avatarTargets: HTMLElement[] = [];

    if (desktopViewportMediaQuery.matches && (group.innerSelectors?.length || group.avatarSelectors?.length)) {
      for (const [targetIndex, targetElement] of group.targets.entries()) {
        const targetRhythmDelayMs =
          groupRhythmDelayMs + group.delayBaseMs + targetIndex * SIDE_PANEL_RHYTHM_ITEM_STEP_MS + SIDE_PANEL_INNER_CHAIN_OFFSET_MS;

        if (group.avatarSelectors?.length) {
          const avatarTargetsInTarget = Array.from(
            targetElement.querySelectorAll<HTMLElement>(group.avatarSelectors.join(','))
          );

          for (const [avatarIndex, avatarTarget] of avatarTargetsInTarget.entries()) {
            avatarTarget.classList.add('motion-profile-avatar-pop');
            setCssVar(avatarTarget, '--motion-profile-avatar-index', String(avatarIndex));
            setCssVar(avatarTarget, '--motion-profile-avatar-delay-base', `${SIDE_PANEL_PROFILE_AVATAR_DELAY_BASE_MS}ms`);
            setCssVar(avatarTarget, '--motion-rhythm-group-delay', `${targetRhythmDelayMs}ms`);
            setCssVar(avatarTarget, '--motion-rhythm-item-delay', `${avatarIndex * SIDE_PANEL_PROFILE_AVATAR_STEP_MS}ms`);
            avatarTargets.push(avatarTarget);
          }
        }

        if (!group.innerSelectors?.length) {
          continue;
        }

        const innerTargetsInTarget = Array.from(
          targetElement.querySelectorAll<HTMLElement>(group.innerSelectors.join(','))
        );

        for (const [innerIndex, innerTarget] of innerTargetsInTarget.entries()) {
          innerTarget.classList.add('motion-side-pop-inner-item');
          setCssVar(innerTarget, '--motion-side-pop-inner-index', String(innerIndex));
          setCssVar(innerTarget, '--motion-side-pop-inner-delay-base', `${SIDE_PANEL_INNER_STAGGER_BASE_MS}ms`);
          setCssVar(innerTarget, '--motion-side-pop-inner-step', `${SIDE_PANEL_INNER_STAGGER_STEP_MS}ms`);
          setCssVar(innerTarget, '--motion-rhythm-group-delay', `${targetRhythmDelayMs}ms`);
          setCssVar(innerTarget, '--motion-rhythm-item-delay', '0ms');
          innerTargets.push(innerTarget);
        }
      }
    }

    groupedInnerTargets.push(innerTargets);
    groupedAvatarTargets.push(avatarTargets);
  }

  const revealNestedFrameIds: number[] = [];
  const revealFrameIds = motionGroups.map((group, groupIndex) =>
    window.requestAnimationFrame(() => {
      for (const targetElement of group.targets) {
        targetElement.classList.add('is-visible');
      }

      const avatarTargets = groupedAvatarTargets[groupIndex] ?? [];
      const innerTargets = groupedInnerTargets[groupIndex] ?? [];
      if (!avatarTargets.length && !innerTargets.length) {
        return;
      }

      const revealNestedFrameId = window.requestAnimationFrame(() => {
        for (const avatarTarget of avatarTargets) {
          avatarTarget.classList.add('is-visible');
        }

        for (const innerTarget of innerTargets) {
          innerTarget.classList.add('is-visible');
        }
      });
      revealNestedFrameIds.push(revealNestedFrameId);
    })
  );

  const handleReducedMotionChange = (event: MediaQueryListEvent): void => {
    if (!event.matches) {
      return;
    }

    for (const revealFrameId of revealFrameIds) {
      window.cancelAnimationFrame(revealFrameId);
    }

    for (const revealNestedFrameId of revealNestedFrameIds) {
      window.cancelAnimationFrame(revealNestedFrameId);
    }

    for (const group of motionGroups) {
      for (const targetElement of group.targets) {
        targetElement.classList.add('is-visible');
      }
    }

    for (const avatarTargets of groupedAvatarTargets) {
      for (const avatarTarget of avatarTargets) {
        avatarTarget.classList.add('is-visible');
      }
    }

    for (const innerTargets of groupedInnerTargets) {
      for (const innerTarget of innerTargets) {
        innerTarget.classList.add('is-visible');
      }
    }
  };

  reducedMotionMediaQuery.addEventListener('change', handleReducedMotionChange);

  return () => {
    for (const revealFrameId of revealFrameIds) {
      window.cancelAnimationFrame(revealFrameId);
    }

    for (const revealNestedFrameId of revealNestedFrameIds) {
      window.cancelAnimationFrame(revealNestedFrameId);
    }

    reducedMotionMediaQuery.removeEventListener('change', handleReducedMotionChange);
  };
}

function orderPostCardsByVisualFlow(cardElements: readonly HTMLElement[]): HTMLElement[] {
  if (cardElements.length <= 1) {
    return [...cardElements];
  }

  const sortedByTopThenLeft = cardElements
    .map((cardElement) => {
      const rect = cardElement.getBoundingClientRect();
      return {
        cardElement,
        top: rect.top,
        left: rect.left
      };
    })
    .sort((leftEntry, rightEntry) => {
      if (leftEntry.top !== rightEntry.top) {
        return leftEntry.top - rightEntry.top;
      }

      return leftEntry.left - rightEntry.left;
    });

  const rows: Array<{ anchorTop: number; items: Array<{ cardElement: HTMLElement; left: number }> }> = [];

  for (const entry of sortedByTopThenLeft) {
    let matchedRow = rows.find((row) => Math.abs(entry.top - row.anchorTop) <= POST_CARD_ROW_TOLERANCE_PX);

    if (!matchedRow) {
      matchedRow = {
        anchorTop: entry.top,
        items: []
      };
      rows.push(matchedRow);
    } else {
      matchedRow.anchorTop = (matchedRow.anchorTop + entry.top) / 2;
    }

    matchedRow.items.push({
      cardElement: entry.cardElement,
      left: entry.left
    });
  }

  rows.sort((leftRow, rightRow) => leftRow.anchorTop - rightRow.anchorTop);

  const orderedCards: HTMLElement[] = [];

  for (const row of rows) {
    row.items.sort((leftItem, rightItem) => leftItem.left - rightItem.left);
    for (const rowItem of row.items) {
      orderedCards.push(rowItem.cardElement);
    }
  }

  return orderedCards;
}

function orderPostCardsTopToBottom(cardElements: readonly HTMLElement[]): HTMLElement[] {
  if (cardElements.length <= 1) {
    return [...cardElements];
  }

  return cardElements
    .map((cardElement, domIndex) => {
      const rect = cardElement.getBoundingClientRect();

      return {
        cardElement,
        top: rect.top,
        domIndex
      };
    })
    .sort((leftEntry, rightEntry) => {
      if (leftEntry.top !== rightEntry.top) {
        return leftEntry.top - rightEntry.top;
      }

      return leftEntry.domIndex - rightEntry.domIndex;
    })
    .map((entry) => entry.cardElement);
}

function setupPostCardRiseMotion(): (() => void) | null {
  const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const observedCardSet = new Set<HTMLElement>();
  const cardOrderMap = new WeakMap<HTMLElement, number>();
  let observer: IntersectionObserver | null = null;
  let revealFrameId = 0;

  const revealCards = (cardElements: readonly HTMLElement[]): void => {
    for (const cardElement of cardElements) {
      cardElement.classList.add('is-visible');

      if (observedCardSet.has(cardElement)) {
        observer?.unobserve(cardElement);
        observedCardSet.delete(cardElement);
      }
    }
  };

  const ensureObserver = (): IntersectionObserver | null => {
    if (observer) {
      return observer;
    }

    if (typeof IntersectionObserver === 'undefined') {
      return null;
    }

    observer = new IntersectionObserver(
      (entries) => {
        const intersectingCards = entries
          .filter((entry) => entry.isIntersecting && entry.target instanceof HTMLElement)
          .map((entry) => entry.target as HTMLElement)
          .sort((leftCard, rightCard) => (cardOrderMap.get(leftCard) ?? 0) - (cardOrderMap.get(rightCard) ?? 0));

        revealCards(intersectingCards);
      },
      {
        threshold: 0.16,
        rootMargin: '0px 0px -8% 0px'
      }
    );

    return observer;
  };

  const resetCardMotionState = (cardElements: readonly HTMLElement[]): void => {
    for (const cardElement of cardElements) {
      cardElement.classList.remove('motion-card-rise', 'is-visible');
      clearCssVar(cardElement, '--motion-index');

      if (observedCardSet.has(cardElement)) {
        observer?.unobserve(cardElement);
        observedCardSet.delete(cardElement);
      }
    }
  };

  const runPostCardMotion = (
    scope: MotionScopeNode = document,
    options: RefreshPostCardMotionOptions = {}
  ): void => {
    const scopedCardElements = Array.from(
      scope.querySelectorAll<HTMLElement>(POST_CARD_MOTION_SELECTORS.join(','))
    );

    if (options.replay) {
      if (revealFrameId) {
        window.cancelAnimationFrame(revealFrameId);
        revealFrameId = 0;
      }

      resetCardMotionState(scopedCardElements);
    }

    const cardElements = scopedCardElements.filter((cardElement) => !cardElement.hidden);

    if (!cardElements.length) {
      return;
    }

    const cardElementsByList = new Map<HTMLElement, HTMLElement[]>();

    for (const cardElement of cardElements) {
      const listElement = cardElement.closest<HTMLElement>(POST_LIST_SELECTOR);
      if (!listElement) {
        continue;
      }

      const currentListCards = cardElementsByList.get(listElement) ?? [];
      currentListCards.push(cardElement);
      cardElementsByList.set(listElement, currentListCards);
    }

    const listEntries = Array.from(cardElementsByList.entries())
      .map(([listElement, listCardElements]) => {
        const listRect = listElement.getBoundingClientRect();

        return {
          listElement,
          listCardElements,
          top: listRect.top,
          left: listRect.left
        };
      })
      .sort((leftEntry, rightEntry) => {
        if (leftEntry.top !== rightEntry.top) {
          return leftEntry.top - rightEntry.top;
        }

        return leftEntry.left - rightEntry.left;
      });

    const orderedCards: HTMLElement[] = [];
    let globalOrder = 0;

    for (const { listElement, listCardElements } of listEntries) {
      const isHomeList = listElement.classList.contains(HOME_POST_LIST_CLASS);
      const orderedCardsInList = isHomeList
        ? orderPostCardsTopToBottom(listCardElements)
        : orderPostCardsByVisualFlow(listCardElements);

      for (const [index, cardElement] of orderedCardsInList.entries()) {
        cardElement.classList.add('motion-card-rise');
        setCssVar(cardElement, '--motion-index', String(Math.min(index, POST_CARD_STAGGER_CAP)));
        cardOrderMap.set(cardElement, globalOrder);
        orderedCards.push(cardElement);
        globalOrder += 1;
      }
    }

    if (reducedMotionMediaQuery.matches) {
      revealCards(orderedCards);
      return;
    }

    if (revealFrameId) {
      window.cancelAnimationFrame(revealFrameId);
      revealFrameId = 0;
    }

    if (typeof IntersectionObserver === 'undefined') {
      revealFrameId = window.requestAnimationFrame(() => {
        revealCards(orderedCards);
      });
      return;
    }

    const initialVisibleCards: HTMLElement[] = [];
    const deferredCards: HTMLElement[] = [];

    for (const cardElement of orderedCards) {
      if (cardElement.classList.contains('is-visible')) {
        if (observedCardSet.has(cardElement)) {
          observer?.unobserve(cardElement);
          observedCardSet.delete(cardElement);
        }
        continue;
      }

      const rect = cardElement.getBoundingClientRect();
      const isWithinInitialViewport = rect.bottom >= 0 && rect.top <= window.innerHeight * 0.94;

      if (isWithinInitialViewport) {
        initialVisibleCards.push(cardElement);
      } else {
        deferredCards.push(cardElement);
      }
    }

    revealFrameId = window.requestAnimationFrame(() => {
      revealCards(initialVisibleCards);
    });

    const nextObserver = ensureObserver();
    if (!nextObserver) {
      revealCards(deferredCards);
      return;
    }

    for (const cardElement of deferredCards) {
      if (observedCardSet.has(cardElement)) {
        continue;
      }
      nextObserver.observe(cardElement);
      observedCardSet.add(cardElement);
    }
  };

  const handleReducedMotionChange = (): void => {
    observer?.disconnect();
    observedCardSet.clear();

    if (revealFrameId) {
      window.cancelAnimationFrame(revealFrameId);
      revealFrameId = 0;
    }

    runPostCardMotion(document);
  };

  reducedMotionMediaQuery.addEventListener('change', handleReducedMotionChange);
  refreshPostCardMotion = runPostCardMotion;
  runPostCardMotion(document);

  return () => {
    if (revealFrameId) {
      window.cancelAnimationFrame(revealFrameId);
      revealFrameId = 0;
    }

    observer?.disconnect();
    observedCardSet.clear();
    reducedMotionMediaQuery.removeEventListener('change', handleReducedMotionChange);

    if (refreshPostCardMotion === runPostCardMotion) {
      refreshPostCardMotion = null;
    }
  };
}

function setupGlobalMotionChoreography(): (() => void) | null {
  const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pageElement = document.querySelector<HTMLElement>('.site-page-content > .page');

  if (!pageElement || reducedMotionMediaQuery.matches) {
    return null;
  }

  const staggerTargetSet = new Set<HTMLElement>();

  for (const selector of PAGE_STAGGER_SELECTORS) {
    for (const targetElement of pageElement.querySelectorAll<HTMLElement>(selector)) {
      staggerTargetSet.add(targetElement);
    }
  }

  const staggerTargets = Array.from(staggerTargetSet);

  const postDetailReadingTargets = pageElement.classList.contains('page-post-detail')
    ? [
      {
        targetElement: pageElement.querySelector<HTMLElement>(POST_DETAIL_READING_MOTION_SELECTORS.header),
        delayMs: 60,
        durationMs: 420,
        offsetY: 10,
        scaleStart: 0.992
      },
      {
        targetElement: pageElement.querySelector<HTMLElement>(POST_DETAIL_READING_MOTION_SELECTORS.backRow),
        delayMs: 90,
        durationMs: 460,
        offsetY: 12,
        scaleStart: 0.996
      },
      {
        targetElement: pageElement.querySelector<HTMLElement>(POST_DETAIL_READING_MOTION_SELECTORS.markdown),
        delayMs: 120,
        durationMs: 540,
        offsetY: 14,
        scaleStart: 1
      }
    ].filter(
      (entry): entry is { targetElement: HTMLElement; delayMs: number; durationMs: number; offsetY: number; scaleStart: number } =>
        Boolean(entry.targetElement)
    )
    : [];

  const rhythmGroupCountMap = new Map<ContentRhythmGroup, number>([
    ['lead', 0],
    ['body', 0]
  ]);

  for (const [index, targetElement] of staggerTargets.entries()) {
    const rhythmGroup = resolveContentRhythmGroup(targetElement);
    const rhythmGroupDelayMs = rhythmGroup === 'lead' ? CONTENT_RHYTHM_LEAD_GROUP_DELAY_MS : CONTENT_RHYTHM_BODY_GROUP_DELAY_MS;
    const rhythmGroupIndex = rhythmGroupCountMap.get(rhythmGroup) ?? 0;

    targetElement.classList.add('motion-stagger-item');
    setCssVar(targetElement, '--motion-index', String(index));
    setCssVar(targetElement, '--motion-rhythm-group-delay', `${rhythmGroupDelayMs}ms`);
    setCssVar(targetElement, '--motion-rhythm-item-delay', `${rhythmGroupIndex * CONTENT_RHYTHM_ITEM_STEP_MS}ms`);
    rhythmGroupCountMap.set(rhythmGroup, rhythmGroupIndex + 1);
  }

  for (const target of postDetailReadingTargets) {
    target.targetElement.classList.add('motion-post-reading-item');
    setCssVar(target.targetElement, '--motion-post-reading-delay', `${target.delayMs}ms`);
    setCssVar(target.targetElement, '--motion-post-reading-duration', `${target.durationMs}ms`);
    setCssVar(target.targetElement, '--motion-post-reading-offset-y', `${target.offsetY}px`);
    setCssVar(target.targetElement, '--motion-post-reading-scale-start', String(target.scaleStart));
    setCssVar(target.targetElement, '--motion-rhythm-group-delay', `${POST_DETAIL_READING_RHYTHM_GROUP_DELAY_MS}ms`);
    setCssVar(target.targetElement, '--motion-rhythm-item-delay', '0ms');
  }

  let revealStaggerFrameId = window.requestAnimationFrame(() => {
    for (const targetElement of staggerTargets) {
      targetElement.classList.add('is-visible');
    }

    for (const target of postDetailReadingTargets) {
      target.targetElement.classList.add('is-visible');
    }
  });

  const observeTargets = Array.from(
    pageElement.querySelectorAll<HTMLElement>(PAGE_SCROLL_REVEAL_SELECTORS.join(','))
  );

  for (const [index, targetElement] of observeTargets.entries()) {
    targetElement.classList.add('motion-observe-item');
    setCssVar(targetElement, '--motion-index', String(index % 8));
  }

  const revealObservedImmediately = (): void => {
    for (const targetElement of observeTargets) {
      targetElement.classList.add('is-visible');
    }
  };

  let observer: IntersectionObserver | null = null;

  if (!observeTargets.length) {
    // noop
  } else if (typeof IntersectionObserver === 'undefined') {
    revealObservedImmediately();
  } else {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          entry.target.classList.add('is-visible');
          observer?.unobserve(entry.target);
        }
      },
      {
        threshold: 0.16,
        rootMargin: '0px 0px -8% 0px'
      }
    );

    for (const targetElement of observeTargets) {
      observer.observe(targetElement);
    }
  }

  const handleReducedMotionChange = (event: MediaQueryListEvent): void => {
    if (!event.matches) {
      return;
    }

    window.cancelAnimationFrame(revealStaggerFrameId);
    revealStaggerFrameId = 0;
    observer?.disconnect();
    revealObservedImmediately();

    for (const targetElement of staggerTargets) {
      targetElement.classList.add('is-visible');
    }

    for (const target of postDetailReadingTargets) {
      target.targetElement.classList.add('is-visible');
    }
  };

  reducedMotionMediaQuery.addEventListener('change', handleReducedMotionChange);

  return () => {
    if (revealStaggerFrameId) {
      window.cancelAnimationFrame(revealStaggerFrameId);
    }

    observer?.disconnect();
    reducedMotionMediaQuery.removeEventListener('change', handleReducedMotionChange);
  };
}

function resolveAboutPageElement(root: ParentNode = document): HTMLElement | null {
  if (root instanceof Element && root.matches('.page-about[data-role="about-page"]')) {
    return root as HTMLElement;
  }

  return root.querySelector<HTMLElement>('.page-about[data-role="about-page"]');
}

function setupAboutContentMotion(options: AboutContentMotionOptions = {}): (() => void) | null {
  const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const aboutPageElement = resolveAboutPageElement(options.root);

  if (!aboutPageElement || reducedMotionMediaQuery.matches) {
    return null;
  }

  interface AboutMotionTargetMeta {
    initialDelayMs: number;
    scrollDelayMs: number;
    revealOrder: number;
  }

  const targetMetaMap = new WeakMap<HTMLElement, AboutMotionTargetMeta>();
  const observedTargetSet = new Set<HTMLElement>();
  const motionTargets: HTMLElement[] = [];
  const isAboutDialogueDesktopFlow = !window.matchMedia('(max-width: 900px)').matches;
  let observer: IntersectionObserver | null = null;
  let revealFrameId = 0;
  let revealOrder = 0;

  const registerTargetGroup = (
    targets: readonly HTMLElement[],
    options: {
      orderTargets?: (targets: readonly HTMLElement[]) => HTMLElement[];
      initialBaseDelayMs: number;
      initialStepMs?: number;
      scrollStepMs?: number;
      getInitialDelayOffsetMs?: (targetElement: HTMLElement, index: number) => number;
      getScrollDelayOffsetMs?: (targetElement: HTMLElement, index: number) => number;
    }
  ): void => {
    const orderedTargets = options.orderTargets ? options.orderTargets(targets) : [...targets];
    const initialStepMs = options.initialStepMs ?? 64;
    const scrollStepMs = options.scrollStepMs ?? 52;

    for (const [index, targetElement] of orderedTargets.entries()) {
      const initialDelayOffsetMs = options.getInitialDelayOffsetMs?.(targetElement, index) ?? 0;
      const scrollDelayOffsetMs = options.getScrollDelayOffsetMs?.(targetElement, index) ?? 0;

      targetMetaMap.set(targetElement, {
        initialDelayMs: options.initialBaseDelayMs + index * initialStepMs + initialDelayOffsetMs,
        scrollDelayMs: index * scrollStepMs + scrollDelayOffsetMs,
        revealOrder: revealOrder
      });
      revealOrder += 1;
      motionTargets.push(targetElement);
    }
  };

  registerTargetGroup(
    Array.from(aboutPageElement.querySelectorAll<HTMLElement>(ABOUT_INTRO_ITEM_SELECTOR)),
    {
      orderTargets: orderPostCardsTopToBottom,
      initialBaseDelayMs: MOTION_DELAY_MS.about.intro.initialBase,
      initialStepMs: MOTION_DELAY_MS.about.intro.initialStep,
      scrollStepMs: MOTION_DELAY_MS.about.intro.scrollStep
    }
  );
  registerTargetGroup(
    Array.from(aboutPageElement.querySelectorAll<HTMLElement>(ABOUT_DIALOGUE_ITEM_SELECTOR)),
    {
      orderTargets: orderPostCardsByVisualFlow,
      initialBaseDelayMs: MOTION_DELAY_MS.about.dialogue.initialBase,
      initialStepMs: MOTION_DELAY_MS.about.dialogue.initialStep,
      scrollStepMs: MOTION_DELAY_MS.about.dialogue.scrollStep,
      getInitialDelayOffsetMs: (targetElement) => {
        return isAboutDialogueDesktopFlow && targetElement.dataset.aboutSide === 'right'
          ? MOTION_DELAY_MS.about.desktopDialogueOffset.initial
          : 0;
      },
      getScrollDelayOffsetMs: (targetElement) => {
        return isAboutDialogueDesktopFlow && targetElement.dataset.aboutSide === 'right'
          ? MOTION_DELAY_MS.about.desktopDialogueOffset.scroll
          : 0;
      }
    }
  );
  registerTargetGroup(
    Array.from(aboutPageElement.querySelectorAll<HTMLElement>(ABOUT_TIMELINE_ITEM_SELECTOR)),
    {
      orderTargets: orderPostCardsTopToBottom,
      initialBaseDelayMs: MOTION_DELAY_MS.about.timeline.initialBase,
      initialStepMs: MOTION_DELAY_MS.about.timeline.initialStep,
      scrollStepMs: MOTION_DELAY_MS.about.timeline.scrollStep
    }
  );

  if (!motionTargets.length) {
    return null;
  }

  const markTargetsVisible = (
    targets: readonly HTMLElement[],
    options: { instant?: boolean; useInitialDelay?: boolean } = {}
  ): void => {
    for (const targetElement of targets) {
      const meta = targetMetaMap.get(targetElement);

      if (!meta) {
        continue;
      }

      if (options.instant) {
        targetElement.classList.add('about-motion-item--instant');
        setCssVar(targetElement, '--about-motion-delay', '0ms');
      } else {
        const delayMs = options.useInitialDelay ? meta.initialDelayMs : meta.scrollDelayMs;
        setCssVar(targetElement, '--about-motion-delay', `${delayMs}ms`);
      }

      targetElement.classList.add('is-visible');

      if (observedTargetSet.has(targetElement)) {
        observer?.unobserve(targetElement);
        observedTargetSet.delete(targetElement);
      }
    }
  };

  const initialVisibleTargets: HTMLElement[] = [];
  const deferredTargets: HTMLElement[] = [];

  for (const targetElement of motionTargets) {
    const rect = targetElement.getBoundingClientRect();
    const isWithinInitialViewport = rect.bottom >= 0 && rect.top <= window.innerHeight * 0.94;

    if (isWithinInitialViewport) {
      initialVisibleTargets.push(targetElement);
    } else {
      deferredTargets.push(targetElement);
    }
  }

  if (options.animateInitialVisibleItems === false) {
    markTargetsVisible(initialVisibleTargets, { instant: true });
  } else {
    revealFrameId = window.requestAnimationFrame(() => {
      markTargetsVisible(initialVisibleTargets, { useInitialDelay: true });
    });
  }

  if (!deferredTargets.length) {
    // noop
  } else if (typeof IntersectionObserver === 'undefined') {
    markTargetsVisible(deferredTargets, {
      instant: options.animateInitialVisibleItems === false,
      useInitialDelay: false
    });
  } else {
    observer = new IntersectionObserver(
      (entries) => {
        const intersectingTargets = entries
          .filter((entry): entry is IntersectionObserverEntry & { target: HTMLElement } => {
            return entry.isIntersecting && entry.target instanceof HTMLElement;
          })
          .map((entry) => entry.target)
          .sort((leftTarget, rightTarget) => {
            return (targetMetaMap.get(leftTarget)?.revealOrder ?? 0) - (targetMetaMap.get(rightTarget)?.revealOrder ?? 0);
          });

        markTargetsVisible(intersectingTargets, { useInitialDelay: false });
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -10% 0px'
      }
    );

    for (const targetElement of deferredTargets) {
      observer.observe(targetElement);
      observedTargetSet.add(targetElement);
    }
  }

  const handleReducedMotionChange = (event: MediaQueryListEvent): void => {
    if (!event.matches) {
      return;
    }

    if (revealFrameId) {
      window.cancelAnimationFrame(revealFrameId);
      revealFrameId = 0;
    }

    observer?.disconnect();
    observedTargetSet.clear();
    markTargetsVisible(motionTargets, { instant: true });
  };

  reducedMotionMediaQuery.addEventListener('change', handleReducedMotionChange);

  return () => {
    if (revealFrameId) {
      window.cancelAnimationFrame(revealFrameId);
    }

    observer?.disconnect();
    observedTargetSet.clear();
    reducedMotionMediaQuery.removeEventListener('change', handleReducedMotionChange);
  };
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }

  if (!error || typeof error !== 'object') {
    return false;
  }

  return 'name' in error && (error as { name?: string }).name === 'AbortError';
}

function setupAboutPageHydration(options: { onHydrated?: (aboutPageElement: HTMLElement) => void } = {}): (() => void) | null {
  const aboutPageElement = document.querySelector<HTMLElement>('.page-about[data-role="about-page"]');

  if (!aboutPageElement) {
    return null;
  }

  const abortController = new AbortController();
  const fallbackFingerprint = aboutPageElement.dataset.aboutFingerprint ?? '';
  let disposed = false;

  void (async () => {
    try {
      const remoteViewModel = await fetchAboutViewModel({ signal: abortController.signal });

      if (disposed || abortController.signal.aborted) {
        return;
      }

      if (remoteViewModel.fingerprint === fallbackFingerprint) {
        return;
      }

      aboutPageElement.innerHTML = renderAboutPageBody(remoteViewModel);
      aboutPageElement.dataset.aboutFingerprint = remoteViewModel.fingerprint;
      options.onHydrated?.(aboutPageElement);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      console.debug('[about] Failed to hydrate from /api/about, keep local fallback.', error);
    }
  })();

  return () => {
    disposed = true;
    abortController.abort();
  };
}

function setupPostDetailBackButton(): (() => void) | null {
  const backButtonElement = document.querySelector<HTMLButtonElement>('[data-role="post-detail-back"]');

  if (!backButtonElement) {
    return null;
  }

  const handleBackButtonClick = (event: MouseEvent): void => {
    event.preventDefault();

    if (currentHistoryIndex > 0) {
      window.history.back();
      return;
    }

    navigateTo('/posts', { replace: true });
  };

  backButtonElement.addEventListener('click', handleBackButtonClick);

  return () => {
    backButtonElement.removeEventListener('click', handleBackButtonClick);
  };
}

function setupScrollTopButton(): (() => void) | null {
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

function setupPostDetailToc(): (() => void) | null {
  const postPageElement = document.querySelector<HTMLElement>('.page-post-detail');
  const markdownContentElement = postPageElement?.querySelector<HTMLElement>('.markdown-content');
  const tocElement = document.querySelector<HTMLElement>('[data-role="post-toc"]');
  const tocPanelElement = tocElement?.querySelector<HTMLElement>('[data-role="post-toc-panel"]');
  const tocListElement = document.querySelector<HTMLElement>('[data-role="post-toc-list"]');

  if (!postPageElement || !markdownContentElement || !tocElement || !tocPanelElement || !tocListElement) {
    return null;
  }

  const setTocVisibleState = (isVisible: boolean): void => {
    tocPanelElement.hidden = !isVisible;
    tocPanelElement.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    tocElement.classList.toggle('has-toc', isVisible);
  };

  const headingElements = Array.from(
    markdownContentElement.querySelectorAll<HTMLHeadingElement>('h1, h2, h3')
  );

  if (!headingElements.length) {
    tocListElement.innerHTML = '';
    setTocVisibleState(false);
    return null;
  }

  const usedIdSet = new Set<string>();

  for (const headingElement of headingElements) {
    const normalizedCurrentId = normalizeHeadingId(headingElement.id);

    if (normalizedCurrentId && !usedIdSet.has(normalizedCurrentId)) {
      headingElement.id = normalizedCurrentId;
      usedIdSet.add(normalizedCurrentId);
      continue;
    }

    const generatedId = createUniqueHeadingId(
      getHeadingTextContent(headingElement),
      usedIdSet
    );

    headingElement.id = generatedId;
    usedIdSet.add(generatedId);
  }

  interface TocHeadingItem {
    id: string;
    headingElement: HTMLHeadingElement;
    linkElement: HTMLAnchorElement;
    itemElement: HTMLLIElement;
  }

  const tocHeadingItems: TocHeadingItem[] = [];
  tocListElement.innerHTML = '';

  for (const headingElement of headingElements) {
    const level = Number.parseInt(headingElement.tagName.slice(1), 10);
    const text = getHeadingTextContent(headingElement);

    if (!headingElement.id || !text) {
      continue;
    }

    const listItemElement = document.createElement('li');
    listItemElement.className = 'post-toc-item';
    setCssVar(listItemElement, '--post-toc-indent', String(Math.max(0, level - 1)));

    const linkElement = document.createElement('a');
    linkElement.className = 'post-toc-link';
    linkElement.setAttribute('href', `#${encodeURIComponent(headingElement.id)}`);
    linkElement.setAttribute('data-toc-target', headingElement.id);
    linkElement.textContent = text;

    listItemElement.append(linkElement);
    tocListElement.append(listItemElement);

    tocHeadingItems.push({
      id: headingElement.id,
      headingElement,
      linkElement,
      itemElement: listItemElement
    });
  }

  if (tocHeadingItems.length < 2) {
    tocListElement.innerHTML = '';
    setTocVisibleState(false);
    return null;
  }

  setTocVisibleState(true);

  let tocInnerRevealFrameId = 0;
  const shouldAnimateTocInnerItems = window.matchMedia('(min-width: 1025px)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && tocElement.classList.contains('motion-side-pop-item');

  if (shouldAnimateTocInnerItems) {
    const tocRhythmGroupDelay = tocElement.style.getPropertyValue('--motion-rhythm-group-delay').trim() || '0ms';
    const tocRhythmItemDelay = tocElement.style.getPropertyValue('--motion-rhythm-item-delay').trim() || '0ms';

    for (const [index, tocHeadingItem] of tocHeadingItems.entries()) {
      tocHeadingItem.itemElement.classList.add('motion-side-pop-inner-item');
      setCssVar(tocHeadingItem.itemElement, '--motion-side-pop-inner-index', String(index));
      setCssVar(tocHeadingItem.itemElement, '--motion-side-pop-inner-delay-base', `${SIDE_PANEL_INNER_STAGGER_BASE_MS}ms`);
      setCssVar(tocHeadingItem.itemElement, '--motion-side-pop-inner-step', `${SIDE_PANEL_INNER_STAGGER_STEP_MS}ms`);
      setCssVar(
        tocHeadingItem.itemElement,
        '--motion-rhythm-group-delay',
        `calc(${tocRhythmGroupDelay} + ${tocRhythmItemDelay} + ${SIDE_PANEL_INNER_CHAIN_OFFSET_MS}ms)`
      );
      setCssVar(tocHeadingItem.itemElement, '--motion-rhythm-item-delay', '0ms');
    }

    tocInnerRevealFrameId = window.requestAnimationFrame(() => {
      tocInnerRevealFrameId = 0;

      for (const tocHeadingItem of tocHeadingItems) {
        tocHeadingItem.itemElement.classList.add('is-visible');
      }
    });
  }

  const tocHeadingMap = new Map<string, TocHeadingItem>();

  for (const tocHeadingItem of tocHeadingItems) {
    tocHeadingMap.set(tocHeadingItem.id, tocHeadingItem);
  }

  setCssPxVar(tocListElement, '--post-toc-progress-height', 0);

  let activeHeadingId = '';

  const syncTocProgressIndicator = (): void => {
    const activeHeadingItem = (activeHeadingId ? tocHeadingMap.get(activeHeadingId) : undefined) ?? tocHeadingItems[0];

    if (!activeHeadingItem) {
      setCssPxVar(tocListElement, '--post-toc-progress-height', 0);
      return;
    }

    const lastHeadingItem = tocHeadingItems[tocHeadingItems.length - 1];
    if (lastHeadingItem && activeHeadingItem.id === lastHeadingItem.id) {
      setCssPxVar(tocListElement, '--post-toc-progress-height', tocListElement.scrollHeight);
      return;
    }

    const listRect = tocListElement.getBoundingClientRect();
    const activeItemRect = activeHeadingItem.itemElement.getBoundingClientRect();
    const progressHeight = Math.min(
      tocListElement.scrollHeight,
      Math.max(0, activeItemRect.top - listRect.top + activeItemRect.height / 2)
    );

    setCssPxVar(tocListElement, '--post-toc-progress-height', progressHeight);
  };

  const setActiveHeading = (nextActiveId: string): void => {
    if (!nextActiveId || nextActiveId === activeHeadingId) {
      return;
    }

    activeHeadingId = nextActiveId;

    for (const tocHeadingItem of tocHeadingItems) {
      const isActive = tocHeadingItem.id === nextActiveId;
      tocHeadingItem.itemElement.classList.toggle('is-active', isActive);

      if (isActive) {
        tocHeadingItem.linkElement.setAttribute('aria-current', 'location');
      } else {
        tocHeadingItem.linkElement.removeAttribute('aria-current');
      }
    }

    syncTocProgressIndicator();
  };

  const findActiveHeadingIdByViewport = (): string => {
    const viewportBottom = window.scrollY + window.innerHeight;
    const pageBottom = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const isNearPageBottom = pageBottom - viewportBottom <= 2;

    if (isNearPageBottom) {
      return tocHeadingItems[tocHeadingItems.length - 1].id;
    }

    const activationOffset = 136;
    let currentItem = tocHeadingItems[0];

    for (const tocHeadingItem of tocHeadingItems) {
      if (tocHeadingItem.headingElement.getBoundingClientRect().top <= activationOffset) {
        currentItem = tocHeadingItem;
        continue;
      }

      break;
    }

    return currentItem.id;
  };

  const syncActiveHeadingFromViewport = (): void => {
    setActiveHeading(findActiveHeadingIdByViewport());
    syncTocProgressIndicator();
  };

  const handleTocClick = (event: Event): void => {
    const targetElement = event.target;
    if (!(targetElement instanceof Element)) {
      return;
    }

    const linkElement = targetElement.closest<HTMLAnchorElement>('.post-toc-link[data-toc-target]');
    if (!linkElement) {
      return;
    }

    const targetId = linkElement.dataset.tocTarget ?? '';
    const targetHeadingItem = tocHeadingMap.get(targetId);
    if (!targetHeadingItem) {
      return;
    }

    event.preventDefault();

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    targetHeadingItem.headingElement.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });

    setActiveHeading(targetId);
    window.history.replaceState(
      createHistoryStateWithIndex(currentHistoryIndex),
      '',
      `${window.location.pathname}${window.location.search}#${encodeURIComponent(targetId)}`
    );
  };

  tocListElement.addEventListener('click', handleTocClick);

  let observer: IntersectionObserver | null = null;
  const handleWindowScroll = (): void => {
    syncActiveHeadingFromViewport();
  };
  const handleWindowResize = (): void => {
    syncActiveHeadingFromViewport();
  };

  if (typeof IntersectionObserver === 'undefined') {
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('resize', handleWindowResize);
  } else {
    observer = new IntersectionObserver(() => {
      syncActiveHeadingFromViewport();
    }, {
      root: null,
      rootMargin: '-20% 0px -65% 0px',
      threshold: [0, 1]
    });

    for (const tocHeadingItem of tocHeadingItems) {
      observer.observe(tocHeadingItem.headingElement);
    }

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('resize', handleWindowResize);
  }

  let initialSyncFrameId = window.requestAnimationFrame(() => {
    const hashTargetId = decodeHashTargetId(window.location.hash);
    const hashTargetItem = hashTargetId ? tocHeadingMap.get(hashTargetId) : undefined;

    if (hashTargetItem) {
      hashTargetItem.headingElement.scrollIntoView({
        behavior: 'auto',
        block: 'start'
      });
      setActiveHeading(hashTargetItem.id);
      return;
    }

    syncActiveHeadingFromViewport();
  });

  return () => {
    if (tocInnerRevealFrameId) {
      window.cancelAnimationFrame(tocInnerRevealFrameId);
      tocInnerRevealFrameId = 0;
    }

    tocListElement.removeEventListener('click', handleTocClick);
    observer?.disconnect();
    window.removeEventListener('scroll', handleWindowScroll);
    window.removeEventListener('resize', handleWindowResize);

    if (initialSyncFrameId) {
      window.cancelAnimationFrame(initialSyncFrameId);
      initialSyncFrameId = 0;
    }
  };
}

function setupPostDetailCodeBlockCopy(): (() => void) | null {
  const codeElements = Array.from(
    document.querySelectorAll<HTMLElement>('.page-post-detail .markdown-content pre > code')
  );

  if (!codeElements.length) {
    return null;
  }

  interface PostCodeCopyControl {
    buttonElement: HTMLButtonElement;
    handleClick: () => void;
    resetTimer: number;
    isCopying: boolean;
    copyValue: string;
  }

  const copyControls: PostCodeCopyControl[] = [];

  const setButtonLabel = (
    control: PostCodeCopyControl,
    label: string,
    state: 'default' | 'success' | 'error' = 'default'
  ): void => {
    control.buttonElement.textContent = label;
    control.buttonElement.classList.toggle('is-copied', state === 'success');
    control.buttonElement.classList.toggle('is-error', state === 'error');
  };

  const scheduleReset = (control: PostCodeCopyControl): void => {
    if (control.resetTimer) {
      window.clearTimeout(control.resetTimer);
    }

    control.resetTimer = window.setTimeout(() => {
      control.resetTimer = 0;
      setButtonLabel(control, '复制');
    }, 1600);
  };

  const fallbackCopyText = (text: string): boolean => {
    const textAreaElement = document.createElement('textarea');
    textAreaElement.value = text;
    textAreaElement.setAttribute('readonly', 'true');
    textAreaElement.setAttribute('aria-hidden', 'true');
    textAreaElement.style.position = 'fixed';
    textAreaElement.style.opacity = '0';
    textAreaElement.style.pointerEvents = 'none';
    textAreaElement.style.left = '-9999px';

    document.body.append(textAreaElement);
    textAreaElement.select();
    textAreaElement.setSelectionRange(0, text.length);

    const copied = document.execCommand('copy');
    textAreaElement.remove();
    return copied;
  };

  for (const codeElement of codeElements) {
    const preElement = codeElement.parentElement;
    if (!(preElement instanceof HTMLPreElement)) {
      continue;
    }

    if (preElement.querySelector<HTMLElement>('[data-role="post-code-copy"]')) {
      continue;
    }

    const copyValue = codeElement.textContent ?? '';
    if (!copyValue.trim()) {
      continue;
    }

    const copyButtonElement = document.createElement('button');
    copyButtonElement.type = 'button';
    copyButtonElement.className = 'copy-button copy-button--code-block';
    copyButtonElement.setAttribute('data-role', 'post-code-copy');
    copyButtonElement.setAttribute('aria-label', '复制代码块');
    copyButtonElement.textContent = '复制';
    preElement.append(copyButtonElement);

    const control: PostCodeCopyControl = {
      buttonElement: copyButtonElement,
      handleClick: () => { },
      resetTimer: 0,
      isCopying: false,
      copyValue
    };

    const copyCode = async (): Promise<void> => {
      if (control.isCopying) {
        return;
      }

      control.isCopying = true;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(control.copyValue);
        } else if (!fallbackCopyText(control.copyValue)) {
          throw new Error('fallback-copy-failed');
        }

        setButtonLabel(control, '已复制', 'success');
      } catch {
        setButtonLabel(control, '复制失败', 'error');
      } finally {
        control.isCopying = false;
        scheduleReset(control);
      }
    };

    control.handleClick = () => {
      void copyCode();
    };

    copyButtonElement.addEventListener('click', control.handleClick);
    copyControls.push(control);
  }

  if (!copyControls.length) {
    return null;
  }

  return () => {
    for (const control of copyControls) {
      control.buttonElement.removeEventListener('click', control.handleClick);

      if (control.resetTimer) {
        window.clearTimeout(control.resetTimer);
        control.resetTimer = 0;
      }

      control.buttonElement.remove();
    }
  };
}

function getHeadingTextContent(headingElement: HTMLHeadingElement): string {
  return headingElement.textContent?.trim().replace(/\s+/g, ' ') ?? '';
}

function normalizeHeadingId(id: string): string {
  return id.trim();
}

function createUniqueHeadingId(title: string, usedIdSet: Set<string>): string {
  const baseId = slugifyHeadingText(title) || 'section';
  let nextId = baseId;
  let suffix = 2;

  while (usedIdSet.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

function slugifyHeadingText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function decodeHashTargetId(hashValue: string): string {
  const trimmed = hashValue.trim();

  if (!trimmed.startsWith('#') || trimmed.length <= 1) {
    return '';
  }

  const rawTarget = trimmed.slice(1);

  try {
    return decodeURIComponent(rawTarget);
  } catch {
    return rawTarget;
  }
}

function setupTagCloudInteractions(): (() => void) | null {
  const TAG_POST_EMPTY_HINT = '当前标签下暂无已发布文章。';
  const tagsPageElement = document.querySelector<HTMLElement>('.page-tags');

  if (!tagsPageElement) {
    return null;
  }

  const panelElement = tagsPageElement.querySelector<HTMLElement>('[data-role="tag-posts-panel"]');
  const panelTitleElement = tagsPageElement.querySelector<HTMLElement>('[data-role="tag-posts-title"]');
  const panelMetaElement = tagsPageElement.querySelector<HTMLElement>('[data-role="tag-posts-meta"]');
  const panelContentElement = tagsPageElement.querySelector<HTMLElement>('[data-role="tag-posts-content"]');
  const closeButtonElement = tagsPageElement.querySelector<HTMLButtonElement>('[data-role="tag-posts-close"]');
  const tagCloudElement = tagsPageElement.querySelector<HTMLElement>('.tag-cloud');
  const bubbleElements = Array.from(tagsPageElement.querySelectorAll<HTMLButtonElement>('.tag-bubble[data-tag]'));

  if (
    !panelElement ||
    !panelTitleElement ||
    !panelMetaElement ||
    !panelContentElement ||
    !closeButtonElement ||
    !tagCloudElement ||
    !bubbleElements.length
  ) {
    return null;
  }

  const TAG_BUBBLE_COLUMN_TOLERANCE = 8;
  let activeBubbleElement: HTMLButtonElement | null = null;
  let tagBubbleColumnSyncFrameId = 0;
  let panelCardMotionFrameId = 0;
  let resizeObserver: ResizeObserver | null = null;
  const panelContentCache = new Map<string, string>();

  const syncTagBubbleColumnIndex = (): void => {
    const bubbleLayoutEntries = bubbleElements
      .map((bubbleElement) => ({
        bubbleElement,
        left: bubbleElement.getBoundingClientRect().left
      }))
      .sort((leftEntry, rightEntry) => leftEntry.left - rightEntry.left);

    const columnAnchorList: number[] = [];

    for (const { bubbleElement, left } of bubbleLayoutEntries) {
      let matchedColumnIndex = -1;

      for (let index = 0; index < columnAnchorList.length; index += 1) {
        if (Math.abs(left - columnAnchorList[index]) <= TAG_BUBBLE_COLUMN_TOLERANCE) {
          matchedColumnIndex = index;
          break;
        }
      }

      if (matchedColumnIndex === -1) {
        columnAnchorList.push(left);
        matchedColumnIndex = columnAnchorList.length - 1;
      } else {
        columnAnchorList[matchedColumnIndex] = (columnAnchorList[matchedColumnIndex] + left) / 2;
      }

      setCssVar(bubbleElement, '--tag-col-index', String(matchedColumnIndex));
    }
  };

  const scheduleTagBubbleColumnSync = (): void => {
    if (tagBubbleColumnSyncFrameId) {
      return;
    }

    tagBubbleColumnSyncFrameId = window.requestAnimationFrame(() => {
      tagBubbleColumnSyncFrameId = 0;
      syncTagBubbleColumnIndex();
    });
  };

  const handleTagCloudResize = (): void => {
    scheduleTagBubbleColumnSync();
  };

  const syncBubbleState = (isPanelOpen: boolean): void => {
    for (const bubbleElement of bubbleElements) {
      const isActive = isPanelOpen && bubbleElement === activeBubbleElement;
      bubbleElement.classList.toggle('is-active', isActive);
      bubbleElement.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      bubbleElement.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    }
  };

  const setPanelOpenState = (isOpen: boolean): void => {
    panelElement.hidden = !isOpen;
    panelElement.classList.toggle('is-open', isOpen);
    panelElement.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    syncBubbleState(isOpen);
  };

  const renderTagPanelHtml = (tag: string): string => {
    const cachedHtml = panelContentCache.get(tag);

    if (cachedHtml !== undefined) {
      return cachedHtml;
    }

    const nextHtml = renderPostList(getPostsByTag(tag), {
      emptyHint: TAG_POST_EMPTY_HINT,
      variant: 'tag-panel',
      prioritizedTag: tag
    });

    panelContentCache.set(tag, nextHtml);
    return nextHtml;
  };

  const closePanel = (options: { returnFocus?: boolean } = {}): void => {
    const focusTarget = options.returnFocus ? activeBubbleElement : null;

    activeBubbleElement = null;
    panelTitleElement.textContent = '';
    panelMetaElement.textContent = '';
    panelContentElement.innerHTML = '';
    setPanelOpenState(false);

    if (focusTarget) {
      focusTarget.focus();
    }
  };

  const openPanel = (bubbleElement: HTMLButtonElement): void => {
    const tag = bubbleElement.dataset.tag ?? '';
    const parsedCount = Number.parseInt(bubbleElement.dataset.count ?? '0', 10);
    const postCount = Number.isFinite(parsedCount) ? Math.max(0, parsedCount) : 0;
    const isFirstRender = !panelContentCache.has(tag);

    panelTitleElement.textContent = tag ? `#${tag}` : '#(empty)';
    panelMetaElement.textContent = `${postCount} 篇文章`;
    activeBubbleElement = bubbleElement;

    if (isFirstRender) {
      panelElement.setAttribute('aria-busy', 'true');
    }

    panelContentElement.innerHTML = renderTagPanelHtml(tag);
    setPanelOpenState(true);
    panelElement.removeAttribute('aria-busy');

    if (panelCardMotionFrameId) {
      window.cancelAnimationFrame(panelCardMotionFrameId);
    }

    panelCardMotionFrameId = window.requestAnimationFrame(() => {
      panelCardMotionFrameId = 0;
      refreshPostCardMotion?.(panelContentElement);
    });
  };

  const handleBubbleClick = (event: Event): void => {
    const bubbleElement = event.currentTarget;

    if (!(bubbleElement instanceof HTMLButtonElement)) {
      return;
    }

    if (activeBubbleElement === bubbleElement && panelElement.classList.contains('is-open')) {
      closePanel();
      return;
    }

    openPanel(bubbleElement);
  };

  const handleCloseButtonClick = (): void => {
    closePanel({ returnFocus: true });
  };

  const handleTagPageKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !panelElement.classList.contains('is-open')) {
      return;
    }

    event.preventDefault();
    closePanel({ returnFocus: true });
  };

  setPanelOpenState(false);
  scheduleTagBubbleColumnSync();

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      scheduleTagBubbleColumnSync();
    });

    resizeObserver.observe(tagCloudElement);
  } else {
    window.addEventListener('resize', handleTagCloudResize);
  }

  for (const bubbleElement of bubbleElements) {
    bubbleElement.addEventListener('click', handleBubbleClick);
  }

  closeButtonElement.addEventListener('click', handleCloseButtonClick);
  tagsPageElement.addEventListener('keydown', handleTagPageKeydown);

  return () => {
    if (tagBubbleColumnSyncFrameId) {
      window.cancelAnimationFrame(tagBubbleColumnSyncFrameId);
      tagBubbleColumnSyncFrameId = 0;
    }

    if (panelCardMotionFrameId) {
      window.cancelAnimationFrame(panelCardMotionFrameId);
      panelCardMotionFrameId = 0;
    }

    resizeObserver?.disconnect();
    window.removeEventListener('resize', handleTagCloudResize);

    for (const bubbleElement of bubbleElements) {
      bubbleElement.removeEventListener('click', handleBubbleClick);
    }

    closeButtonElement.removeEventListener('click', handleCloseButtonClick);
    tagsPageElement.removeEventListener('keydown', handleTagPageKeydown);
  };
}

function setupPostDateSortToggle(): (() => void) | null {
  type PostDateSortDirection = 'desc' | 'asc';

  const postsPageElement = document.querySelector<HTMLElement>('.page-posts');

  if (!postsPageElement) {
    return null;
  }

  const postListElement = postsPageElement.querySelector<HTMLElement>('.post-list--posts');
  const sortToggleButton = postsPageElement.querySelector<HTMLButtonElement>('[data-role="post-date-sort-toggle"]');

  if (!postListElement || !sortToggleButton) {
    return null;
  }

  const postEntries = Array.from(postListElement.querySelectorAll<HTMLElement>(':scope > .post-card')).map(
    (postItemElement, originalIndex) => ({
      postItemElement,
      originalIndex,
      postDate: (postItemElement.querySelector<HTMLTimeElement>('time[datetime]')?.dateTime ?? '').trim()
    })
  );

  if (!postEntries.length) {
    return null;
  }

  let sortDirection: PostDateSortDirection = 'desc';

  const syncSortToggleState = (): void => {
    const isAscending = sortDirection === 'asc';

    sortToggleButton.setAttribute('aria-pressed', isAscending ? 'true' : 'false');
    sortToggleButton.dataset.sortDirection = sortDirection;
    sortToggleButton.setAttribute(
      'aria-label',
      isAscending ? '当前排序：正序，点击切换为倒序' : '当前排序：倒序，点击切换为正序'
    );
  };

  const applySort = (nextSortDirection: PostDateSortDirection): void => {
    const sortedEntries = [...postEntries].sort((leftEntry, rightEntry) => {
      if (leftEntry.postDate !== rightEntry.postDate) {
        return nextSortDirection === 'desc'
          ? rightEntry.postDate.localeCompare(leftEntry.postDate, 'en')
          : leftEntry.postDate.localeCompare(rightEntry.postDate, 'en');
      }

      return leftEntry.originalIndex - rightEntry.originalIndex;
    });

    for (const { postItemElement } of sortedEntries) {
      postListElement.append(postItemElement);
    }

    refreshPostCardMotion?.(postsPageElement);
  };

  const handleSortToggleClick = (): void => {
    sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    applySort(sortDirection);
    syncSortToggleState();
  };

  applySort(sortDirection);
  syncSortToggleState();
  sortToggleButton.addEventListener('click', handleSortToggleClick);

  return () => {
    sortToggleButton.removeEventListener('click', handleSortToggleClick);
  };
}

function setupPostThemeFilter(): (() => void) | null {
  const postsPageElement = document.querySelector<HTMLElement>('.page-posts');

  if (!postsPageElement) {
    return null;
  }

  const themeButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-role="post-theme-filter-btn"]')
  );
  const resetButtonWrapElement = document.querySelector<HTMLElement>('[data-role="post-theme-reset-wrap"]');
  const resetButtonElement = document.querySelector<HTMLButtonElement>('[data-role="post-theme-reset-btn"]');
  const postListElement = postsPageElement.querySelector<HTMLElement>('.post-list--posts');
  const postItems = Array.from(
    postsPageElement.querySelectorAll<HTMLElement>('.post-list--posts > .post-card')
  );
  const emptyHintElement = postsPageElement.querySelector<HTMLElement>('[data-role="post-theme-empty-hint"]');

  if (
    !themeButtons.length ||
    !postItems.length ||
    !emptyHintElement ||
    !resetButtonElement ||
    !resetButtonWrapElement ||
    !postListElement
  ) {
    return null;
  }

  const availableThemeKeys = new Set(
    themeButtons
      .map((buttonElement) => normalizeThemeKey(buttonElement.dataset.themeKey ?? ''))
      .filter(Boolean)
  );
  const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeThemeKey = '';
  let resetButtonRevealFrameId = 0;
  let postCardReplayFrameId = 0;

  const readRequestedThemeKey = (): string => {
    const nextThemeKey = normalizeThemeKey(new URLSearchParams(window.location.search).get('theme') ?? '');
    return availableThemeKeys.has(nextThemeKey) ? nextThemeKey : '';
  };

  const syncThemeSearchParam = (nextThemeKey: string): void => {
    const nextUrl = new URL(window.location.href);

    if (nextThemeKey) {
      nextUrl.searchParams.set('theme', nextThemeKey);
    } else {
      nextUrl.searchParams.delete('theme');
    }

    const nextLocation = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextLocation === currentLocation) {
      return;
    }

    window.history.replaceState(createHistoryStateWithIndex(currentHistoryIndex), '', nextLocation);
  };

  const cancelResetButtonReveal = (): void => {
    if (!resetButtonRevealFrameId) {
      return;
    }

    window.cancelAnimationFrame(resetButtonRevealFrameId);
    resetButtonRevealFrameId = 0;
  };

  const cancelPostCardReplay = (): void => {
    if (!postCardReplayFrameId) {
      return;
    }

    window.cancelAnimationFrame(postCardReplayFrameId);
    postCardReplayFrameId = 0;
  };

  const schedulePostCardReplay = (): void => {
    cancelPostCardReplay();

    postCardReplayFrameId = window.requestAnimationFrame(() => {
      postCardReplayFrameId = 0;
      refreshPostCardMotion?.(postListElement, { replay: !reducedMotionMediaQuery.matches });
    });
  };

  const syncResetButtonState = (isVisible: boolean, options: { animateOnShow?: boolean } = {}): void => {
    cancelResetButtonReveal();

    if (!isVisible) {
      resetButtonWrapElement.classList.remove('is-visible');
      resetButtonElement.classList.remove('is-visible');
      resetButtonWrapElement.hidden = true;
      resetButtonWrapElement.setAttribute('aria-hidden', 'true');
      return;
    }

    resetButtonWrapElement.hidden = false;
    resetButtonWrapElement.setAttribute('aria-hidden', 'false');

    const shouldAnimateOnShow = options.animateOnShow === true && !reducedMotionMediaQuery.matches;

    if (!shouldAnimateOnShow) {
      resetButtonWrapElement.classList.add('is-visible');
      resetButtonElement.classList.add('is-visible');
      return;
    }

    resetButtonWrapElement.classList.remove('is-visible');
    resetButtonElement.classList.remove('is-visible');

    resetButtonRevealFrameId = window.requestAnimationFrame(() => {
      resetButtonRevealFrameId = 0;
      resetButtonWrapElement.classList.add('is-visible');
      resetButtonElement.classList.add('is-visible');
    });
  };

  const syncThemeState = (nextThemeKey: string, options: { animateResetButtonOnShow?: boolean } = {}): void => {
    activeThemeKey = nextThemeKey;

    for (const buttonElement of themeButtons) {
      const buttonThemeKey = buttonElement.dataset.themeKey ?? '';
      const isActive = buttonThemeKey === activeThemeKey;
      buttonElement.classList.toggle('is-active', isActive);
      buttonElement.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }

    let visiblePostCount = 0;

    for (const postItemElement of postItems) {
      const postThemeKey = (postItemElement.dataset.postThemeKey ?? '').trim();
      const shouldShow = !activeThemeKey || postThemeKey === activeThemeKey;
      const themeLabelItemElement = postItemElement.querySelector<HTMLElement>('[data-role="post-theme-label-item"]');
      const themeLabelThemeKey = (themeLabelItemElement?.dataset.themeKey ?? '').trim();
      postItemElement.hidden = !shouldShow;

      if (themeLabelItemElement) {
        themeLabelItemElement.hidden = Boolean(activeThemeKey) && themeLabelThemeKey === activeThemeKey;
      }

      if (shouldShow) {
        visiblePostCount += 1;
      }
    }

    syncResetButtonState(Boolean(activeThemeKey), {
      animateOnShow: Boolean(activeThemeKey) && options.animateResetButtonOnShow === true
    });
    emptyHintElement.hidden = visiblePostCount > 0;
  };

  const handleThemeButtonClick = (event: Event): void => {
    const targetElement = event.currentTarget;

    if (!(targetElement instanceof HTMLButtonElement)) {
      return;
    }

    const nextThemeKey = targetElement.dataset.themeKey ?? '';

    if (!nextThemeKey || nextThemeKey === activeThemeKey) {
      return;
    }

    syncThemeState(nextThemeKey);
    syncThemeSearchParam(nextThemeKey);
    schedulePostCardReplay();
  };

  const handleResetButtonClick = (): void => {
    syncThemeState('');
    syncThemeSearchParam('');
  };

  for (const themeButtonElement of themeButtons) {
    themeButtonElement.addEventListener('click', handleThemeButtonClick);
  }

  resetButtonElement.addEventListener('click', handleResetButtonClick);

  const initialThemeKey = readRequestedThemeKey();
  syncThemeState(initialThemeKey, { animateResetButtonOnShow: Boolean(initialThemeKey) });
  syncThemeSearchParam(initialThemeKey);

  if (initialThemeKey) {
    schedulePostCardReplay();
  }

  return () => {
    cancelResetButtonReveal();
    cancelPostCardReplay();

    for (const themeButtonElement of themeButtons) {
      themeButtonElement.removeEventListener('click', handleThemeButtonClick);
    }
    resetButtonElement.removeEventListener('click', handleResetButtonClick);

    for (const postItemElement of postItems) {
      postItemElement.hidden = false;
      const themeLabelItemElement = postItemElement.querySelector<HTMLElement>('[data-role="post-theme-label-item"]');
      if (themeLabelItemElement) {
        themeLabelItemElement.hidden = false;
      }
    }

    resetButtonWrapElement.classList.remove('is-visible');
    resetButtonElement.classList.remove('is-visible');
    resetButtonWrapElement.hidden = true;
    resetButtonWrapElement.setAttribute('aria-hidden', 'true');
    emptyHintElement.hidden = true;
  };
}

function setupArchiveTimelineReveal(): (() => void) | null {
  const timelineElement = document.querySelector<HTMLElement>('.archive-timeline');

  if (!timelineElement) {
    return null;
  }

  const revealTargets = Array.from(
    timelineElement.querySelectorAll<HTMLElement>('.archive-year-group, .archive-timeline-end')
  );

  if (!revealTargets.length) {
    return null;
  }

  const revealAll = (): void => {
    for (const target of revealTargets) {
      target.classList.add('is-visible');
    }
  };

  const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (reducedMotionMediaQuery.matches || typeof IntersectionObserver === 'undefined') {
    revealAll();
    return null;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.15 }
  );

  for (const target of revealTargets) {
    observer.observe(target);
  }

  const handleReducedMotionChange = (event: MediaQueryListEvent): void => {
    if (!event.matches) {
      return;
    }

    observer.disconnect();
    revealAll();
  };

  reducedMotionMediaQuery.addEventListener('change', handleReducedMotionChange);

  return () => {
    observer.disconnect();
    reducedMotionMediaQuery.removeEventListener('change', handleReducedMotionChange);
  };
}

function setupFriendLinkCopyButton(): (() => void) | null {
  const copyButtonElement = document.querySelector<HTMLButtonElement>('[data-role="friend-link-copy"]');
  const linkTextElement = document.querySelector<HTMLElement>('[data-role="friend-link-add-url"]');

  if (!copyButtonElement || !linkTextElement) {
    return null;
  }

  const copyValue = copyButtonElement.dataset.copyValue ?? linkTextElement.textContent ?? '';

  if (!copyValue.trim()) {
    return null;
  }

  let resetTimer = 0;
  let isCopying = false;

  const setButtonLabel = (label: string, state: 'default' | 'success' | 'error' = 'default'): void => {
    copyButtonElement.textContent = label;
    copyButtonElement.classList.toggle('is-copied', state === 'success');
    copyButtonElement.classList.toggle('is-error', state === 'error');
  };

  const scheduleReset = (): void => {
    if (resetTimer) {
      window.clearTimeout(resetTimer);
    }

    resetTimer = window.setTimeout(() => {
      resetTimer = 0;
      setButtonLabel('复制');
    }, 1600);
  };

  const fallbackCopyText = (text: string): boolean => {
    const textAreaElement = document.createElement('textarea');
    textAreaElement.value = text;
    textAreaElement.setAttribute('readonly', 'true');
    textAreaElement.setAttribute('aria-hidden', 'true');
    textAreaElement.style.position = 'fixed';
    textAreaElement.style.opacity = '0';
    textAreaElement.style.pointerEvents = 'none';
    textAreaElement.style.left = '-9999px';

    document.body.append(textAreaElement);
    textAreaElement.select();
    textAreaElement.setSelectionRange(0, text.length);

    const copied = document.execCommand('copy');
    textAreaElement.remove();
    return copied;
  };

  const copyLink = async (): Promise<void> => {
    if (isCopying) {
      return;
    }

    isCopying = true;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyValue);
      } else if (!fallbackCopyText(copyValue)) {
        throw new Error('fallback-copy-failed');
      }

      setButtonLabel('已复制', 'success');
    } catch {
      setButtonLabel('复制失败', 'error');
    } finally {
      isCopying = false;
      scheduleReset();
    }
  };

  const handleCopyClick = (): void => {
    void copyLink();
  };

  copyButtonElement.addEventListener('click', handleCopyClick);

  return () => {
    copyButtonElement.removeEventListener('click', handleCopyClick);

    if (resetTimer) {
      window.clearTimeout(resetTimer);
      resetTimer = 0;
    }
  };
}

function shouldHandleLinkClick(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  if (event.defaultPrevented) {
    return false;
  }

  if (event.button !== 0) {
    return false;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  if (anchor.target && anchor.target !== '_self') {
    return false;
  }

  if (anchor.hasAttribute('download')) {
    return false;
  }

  return anchor.origin === window.location.origin;
}

document.addEventListener('click', (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const anchor = target.closest('a[data-link]');

  if (!(anchor instanceof HTMLAnchorElement)) {
    return;
  }

  if (!shouldHandleLinkClick(event, anchor)) {
    return;
  }

  const href = anchor.getAttribute('href');

  if (!href) {
    return;
  }

  event.preventDefault();
  navigateTo(href);
});

window.addEventListener('popstate', (event) => {
  if (suppressNextPopstateRender) {
    suppressNextPopstateRender = false;
    return;
  }

  const nextHistoryIndex = readHistoryIndex(event.state) ?? 0;
  const nextLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (!confirmAdminNavigation(nextLocation)) {
    suppressNextPopstateRender = true;
    const rollbackDelta = nextHistoryIndex < currentHistoryIndex ? 1 : -1;
    window.history.go(rollbackDelta);
    return;
  }

  currentHistoryIndex = nextHistoryIndex;
  renderApp();
});

window.addEventListener('beforeunload', (event) => {
  if (!hasUnsavedAdminChanges()) {
    return;
  }

  event.preventDefault();
  event.returnValue = '';
});

ensureHistoryIndexState();
applyFixedPreviewState();
renderApp();
