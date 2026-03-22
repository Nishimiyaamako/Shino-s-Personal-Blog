import './styles/global.css';

import { renderProfileCard } from './components/profile-card';
import { SITE_CONFIG } from './config/site';
import { PRIMARY_NAV_LINKS, resolveRoute } from './router';

const { title: SITE_TITLE, subtitle: SITE_SUBTITLE, footer: SITE_FOOTER } = SITE_CONFIG;

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('Missing #app mount element.');
}

const appElement = appRoot;
let cleanupPageEnhancements: (() => void) | null = null;
type MotionScopeNode = Document | Element;
let refreshPostCardMotion: ((scope?: MotionScopeNode) => void) | null = null;
const HISTORY_STATE_NAV_INDEX_KEY = '__appNavIndex' as const;
type AppHistoryState = Record<string, unknown> & {
  [HISTORY_STATE_NAV_INDEX_KEY]?: number;
};
let currentHistoryIndex = 0;

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
  const pageTitle = isFallback ? `404 (${context.pathname})` : route.title;
  const hasProfileCard = shouldRenderProfileCard(route.path);
  const hasPostTocRail = route.path === '/posts/:slug';
  const mainClassName = hasProfileCard
    ? `site-main site-main--with-profile${hasPostTocRail ? ' site-main--with-post-toc' : ''}`
    : 'site-main';
  const pageContent = route.render(context);
  const mainLayout = hasProfileCard
    ? `<div class="site-main-layout${hasPostTocRail ? ' site-main-layout--with-toc' : ''}">
        ${renderProfileCard()}
        <div class="site-page-content">${pageContent}</div>
        ${hasPostTocRail ? renderPostTocRail() : ''}
      </div>`
    : `<div class="site-page-content">${pageContent}</div>`;

  document.title = `${pageTitle} | ${SITE_TITLE}`;

  appElement.innerHTML = `
<a class="skip-link" href="#main-content">跳到正文</a>
<div class="app-shell">
  <header class="site-header">
    <div class="site-header-inner">
      <a href="/" class="brand" data-link>
        <strong>${SITE_TITLE}</strong>
        <span>${SITE_SUBTITLE}</span>
      </a>
      <nav class="site-nav" aria-label="主导航">
        ${renderNavigation(context.pathname)}
      </nav>
    </div>
  </header>

  <main id="main-content" class="${mainClassName}" tabindex="-1">
    ${mainLayout}
  </main>

  <footer class="site-footer" aria-label="站点备案信息">
    <p>© ${new Date().getFullYear()} ${SITE_FOOTER.copyrightOwner}. All rights reserved.</p>
    <p>${SITE_FOOTER.poweredBy}</p>
    ${renderFooterRecords()}
  </footer>
</div>
`;

  cleanupPageEnhancements = setupPageEnhancements(context.pathname);
}

function shouldRenderProfileCard(routePath: string): boolean {
  return routePath === '/' || routePath === '/posts' || routePath === '/posts/:slug';
}

function renderNavigation(pathname: string): string {
  return PRIMARY_NAV_LINKS.map(({ href, label }) => {
    const isActive = isNavActive(pathname, href);
    const activeClass = isActive ? 'is-active' : '';
    const current = isActive ? ' aria-current="page"' : '';
    return `<a href="${href}" data-link class="${activeClass}"${current}>${label}</a>`;
  }).join('');
}

function isNavActive(currentPath: string, navHref: string): boolean {
  if (navHref === '/') {
    return currentPath === '/';
  }

  return currentPath === navHref || currentPath.startsWith(`${navHref}/`);
}

function renderFooterRecords(): string {
  const hasPublicSecurityRecord = Boolean(SITE_FOOTER.publicSecurityRecordText && SITE_FOOTER.publicSecurityRecordUrl);

  if (!hasPublicSecurityRecord) {
    return `<p class="site-footer-records">
      <a href="${SITE_FOOTER.icpRecordUrl}" rel="noreferrer" target="_blank">${SITE_FOOTER.icpRecordText}</a>
    </p>`;
  }

  return `<p class="site-footer-records">
    <a href="${SITE_FOOTER.icpRecordUrl}" rel="noreferrer" target="_blank">${SITE_FOOTER.icpRecordText}</a>
    <span class="site-footer-divider" aria-hidden="true">|</span>
    <a href="${SITE_FOOTER.publicSecurityRecordUrl}" rel="noreferrer" target="_blank">${SITE_FOOTER.publicSecurityRecordText}</a>
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

function navigateTo(path: string, options: { replace?: boolean } = {}): void {
  const url = new URL(path, window.location.origin);
  const nextPathname = url.pathname;

  if (options.replace) {
    window.history.replaceState(createHistoryStateWithIndex(currentHistoryIndex), '', nextPathname);
  } else if (window.location.pathname !== nextPathname) {
    currentHistoryIndex += 1;
    window.history.pushState(createHistoryStateWithIndex(currentHistoryIndex), '', nextPathname);
  }

  renderApp();
  window.scrollTo(0, 0);
}

function setupPageEnhancements(pathname: string): (() => void) | null {
  const cleanups: Array<() => void> = [];

  const cleanupRouteEnterTransition = setupRouteEnterTransition();
  if (cleanupRouteEnterTransition) {
    cleanups.push(cleanupRouteEnterTransition);
  }

  const cleanupSidePanelLeftPopMotion = setupSidePanelLeftPopMotion();
  if (cleanupSidePanelLeftPopMotion) {
    cleanups.push(cleanupSidePanelLeftPopMotion);
  }

  const cleanupPostCardRiseMotion = setupPostCardRiseMotion();
  if (cleanupPostCardRiseMotion) {
    cleanups.push(cleanupPostCardRiseMotion);
  }

  const cleanupGlobalMotionChoreography = setupGlobalMotionChoreography();
  if (cleanupGlobalMotionChoreography) {
    cleanups.push(cleanupGlobalMotionChoreography);
  }

  if (pathname === '/tags') {
    const cleanupTagCloudInteractions = setupTagCloudInteractions();
    if (cleanupTagCloudInteractions) {
      cleanups.push(cleanupTagCloudInteractions);
    }
  }

  if (pathname.startsWith('/posts/')) {
    const cleanupPostDetailBackButton = setupPostDetailBackButton();
    if (cleanupPostDetailBackButton) {
      cleanups.push(cleanupPostDetailBackButton);
    }

    const cleanupPostDetailScrollTopButton = setupPostDetailScrollTopButton();
    if (cleanupPostDetailScrollTopButton) {
      cleanups.push(cleanupPostDetailScrollTopButton);
    }

    const cleanupPostDetailToc = setupPostDetailToc();
    if (cleanupPostDetailToc) {
      cleanups.push(cleanupPostDetailToc);
    }
  }

  if (pathname === '/archive') {
    const cleanupArchiveTimeline = setupArchiveTimelineReveal();
    if (cleanupArchiveTimeline) {
      cleanups.push(cleanupArchiveTimeline);
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
  ':scope > .page-header',
  ':scope > .post-detail-back-row',
  ':scope > .section-head',
  ':scope > .page-section:not(.home-intro-panel)',
  ':scope > .hero-card',
  ':scope > .page-not-found',
  ':scope > .tag-filter-shell',
  ':scope > .tag-result-shell',
  ':scope > .tag-detail-header',
  ':scope > .archive-timeline',
  ':scope > .post-detail-layout',
  ':scope > .markdown-content',
  ':scope > .empty-hint'
] as const;

const PAGE_SCROLL_REVEAL_SELECTORS = [
  '.friend-link-list > .friend-link-card',
  '.stats-list > li'
] as const;

const POST_CARD_MOTION_SELECTORS = [
  '.post-list--home > .post-card[data-motion-card]',
  '.post-list--posts > .post-card[data-motion-card]',
  '.post-list--tag-panel > .post-card[data-motion-card]'
] as const;
const SIDE_PANEL_LEFT_POP_SELECTORS = [
  '.profile-card',
  '.page-home > .home-intro-panel'
] as const;
const POST_LIST_SELECTOR = '.post-list';
const HOME_POST_LIST_CLASS = 'post-list--home';
const POST_CARD_ROW_TOLERANCE_PX = 10;
const POST_CARD_STAGGER_CAP = 10;

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
    targetElement.style.setProperty('--route-enter-delay', `${index * 24}ms`);
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

function setupSidePanelLeftPopMotion(): (() => void) | null {
  const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const targetElements = Array.from(
    document.querySelectorAll<HTMLElement>(SIDE_PANEL_LEFT_POP_SELECTORS.join(','))
  );

  if (!targetElements.length) {
    return null;
  }

  const orderedTargets = targetElements
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

  for (const [index, targetElement] of orderedTargets.entries()) {
    targetElement.classList.add('motion-left-pop-item');
    targetElement.style.setProperty('--motion-index', String(index));
  }

  let revealFrameId = window.requestAnimationFrame(() => {
    for (const targetElement of orderedTargets) {
      targetElement.classList.add('is-visible');
    }
  });

  const handleReducedMotionChange = (event: MediaQueryListEvent): void => {
    if (!event.matches) {
      return;
    }

    window.cancelAnimationFrame(revealFrameId);
    revealFrameId = 0;

    for (const targetElement of orderedTargets) {
      targetElement.classList.add('is-visible');
    }
  };

  reducedMotionMediaQuery.addEventListener('change', handleReducedMotionChange);

  return () => {
    if (revealFrameId) {
      window.cancelAnimationFrame(revealFrameId);
      revealFrameId = 0;
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

  const runPostCardMotion = (scope: MotionScopeNode = document): void => {
    const cardElements = Array.from(
      scope.querySelectorAll<HTMLElement>(POST_CARD_MOTION_SELECTORS.join(','))
    );

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
        cardElement.classList.toggle('motion-card-rise--home', isHomeList);
        cardElement.style.setProperty('--motion-index', String(Math.min(index, POST_CARD_STAGGER_CAP)));
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

  for (const [index, targetElement] of staggerTargets.entries()) {
    targetElement.classList.add('motion-stagger-item');
    targetElement.style.setProperty('--motion-index', String(index));
  }

  let revealStaggerFrameId = window.requestAnimationFrame(() => {
    for (const targetElement of staggerTargets) {
      targetElement.classList.add('is-visible');
    }
  });

  const observeTargets = Array.from(
    pageElement.querySelectorAll<HTMLElement>(PAGE_SCROLL_REVEAL_SELECTORS.join(','))
  );

  for (const [index, targetElement] of observeTargets.entries()) {
    targetElement.classList.add('motion-observe-item');
    targetElement.style.setProperty('--motion-index', String(index % 8));
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

function setupPostDetailScrollTopButton(): (() => void) | null {
  const scrollTopButtonElement = document.querySelector<HTMLButtonElement>('[data-role="post-detail-scroll-top"]');
  const scrollTopButtonWrapElement = document.querySelector<HTMLElement>('[data-role="post-detail-scroll-top-wrap"]');

  if (!scrollTopButtonElement) {
    return null;
  }

  const percentElement = scrollTopButtonElement.querySelector<HTMLElement>('[data-role="post-detail-scroll-top-percent"]');
  const VISIBILITY_THRESHOLD = 8;

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
    listItemElement.style.setProperty('--post-toc-indent', String(Math.max(0, level - 1)));

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

  if (!tocHeadingItems.length) {
    setTocVisibleState(false);
    return null;
  }

  setTocVisibleState(true);

  const tocHeadingMap = new Map<string, TocHeadingItem>();

  for (const tocHeadingItem of tocHeadingItems) {
    tocHeadingMap.set(tocHeadingItem.id, tocHeadingItem);
  }

  tocListElement.style.setProperty('--post-toc-progress-height', '0px');

  let activeHeadingId = '';

  const syncTocProgressIndicator = (): void => {
    const activeHeadingItem = (activeHeadingId ? tocHeadingMap.get(activeHeadingId) : undefined) ?? tocHeadingItems[0];

    if (!activeHeadingItem) {
      tocListElement.style.setProperty('--post-toc-progress-height', '0px');
      return;
    }

    const lastHeadingItem = tocHeadingItems[tocHeadingItems.length - 1];
    if (lastHeadingItem && activeHeadingItem.id === lastHeadingItem.id) {
      tocListElement.style.setProperty('--post-toc-progress-height', `${Math.round(tocListElement.scrollHeight)}px`);
      return;
    }

    const listRect = tocListElement.getBoundingClientRect();
    const activeItemRect = activeHeadingItem.itemElement.getBoundingClientRect();
    const progressHeight = Math.min(
      tocListElement.scrollHeight,
      Math.max(0, activeItemRect.top - listRect.top + activeItemRect.height / 2)
    );

    tocListElement.style.setProperty('--post-toc-progress-height', `${Math.round(progressHeight)}px`);
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

  const templateMap = new Map<string, string>();

  for (const templateElement of tagsPageElement.querySelectorAll<HTMLTemplateElement>('template[data-tag-template]')) {
    const tag = templateElement.dataset.tagTemplate ?? '';

    if (!tag) {
      continue;
    }

    templateMap.set(tag, templateElement.innerHTML.trim());
  }

  const TAG_BUBBLE_COLUMN_TOLERANCE = 8;
  let activeBubbleElement: HTMLButtonElement | null = null;
  let tagBubbleColumnSyncFrameId = 0;
  let panelCardMotionFrameId = 0;
  let resizeObserver: ResizeObserver | null = null;

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

      bubbleElement.style.setProperty('--tag-col-index', String(matchedColumnIndex));
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

  const setPanelOpenState = (isOpen: boolean): void => {
    panelElement.hidden = !isOpen;
    panelElement.classList.toggle('is-open', isOpen);
    panelElement.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  };

  const clearActiveBubbleState = (): void => {
    if (!activeBubbleElement) {
      return;
    }

    activeBubbleElement.classList.remove('is-active');
    activeBubbleElement = null;
  };

  const closePanel = (): void => {
    clearActiveBubbleState();
    panelMetaElement.textContent = '';
    panelContentElement.innerHTML = '';
    setPanelOpenState(false);
  };

  const openPanel = (bubbleElement: HTMLButtonElement): void => {
    const tag = bubbleElement.dataset.tag ?? '';
    const parsedCount = Number.parseInt(bubbleElement.dataset.count ?? '0', 10);
    const postCount = Number.isFinite(parsedCount) ? Math.max(0, parsedCount) : 0;
    const templateHtml = templateMap.get(tag) ?? '';

    panelTitleElement.textContent = tag ? `#${tag}` : '#(empty)';
    panelMetaElement.textContent = `${postCount} 篇文章`;

    panelContentElement.innerHTML = templateHtml || '<p class="empty-hint">当前标签下暂无已发布文章。</p>';

    if (activeBubbleElement && activeBubbleElement !== bubbleElement) {
      activeBubbleElement.classList.remove('is-active');
    }

    bubbleElement.classList.add('is-active');
    activeBubbleElement = bubbleElement;

    setPanelOpenState(true);

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

  closeButtonElement.addEventListener('click', closePanel);

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

    closeButtonElement.removeEventListener('click', closePanel);
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
  currentHistoryIndex = readHistoryIndex(event.state) ?? 0;
  renderApp();
});

ensureHistoryIndexState();
renderApp();
