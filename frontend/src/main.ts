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

function renderApp(): void {
  cleanupPageEnhancements?.();
  cleanupPageEnhancements = null;

  const { route, context, isFallback } = resolveRoute(window.location.pathname);
  const pageTitle = isFallback ? `404 (${context.pathname})` : route.title;
  const hasProfileCard = shouldRenderProfileCard(route.path);
  const mainClassName = hasProfileCard ? 'site-main site-main--with-profile' : 'site-main';
  const pageContent = route.render(context);
  const mainLayout = hasProfileCard
    ? `<div class="site-main-layout">
        ${renderProfileCard()}
        <div class="site-page-content">${pageContent}</div>
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

function navigateTo(path: string, options: { replace?: boolean } = {}): void {
  const url = new URL(path, window.location.origin);
  const nextPathname = url.pathname;

  if (options.replace) {
    window.history.replaceState(null, '', nextPathname);
  } else if (window.location.pathname !== nextPathname) {
    window.history.pushState(null, '', nextPathname);
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
  ':scope > .section-head',
  ':scope > .page-section',
  ':scope > .hero-card',
  ':scope > .page-not-found',
  ':scope > .tag-filter-shell',
  ':scope > .tag-result-shell',
  ':scope > .tag-detail-header',
  ':scope > .archive-timeline',
  ':scope > .markdown-content',
  ':scope > .empty-hint'
] as const;

const PAGE_SCROLL_REVEAL_SELECTORS = [
  '.post-list--posts > .post-card',
  '.post-list--tag-panel > .post-card',
  '.friend-link-list > .friend-link-card',
  '.stats-list > li'
] as const;

function setupRouteEnterTransition(): (() => void) | null {
  const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (reducedMotionMediaQuery.matches) {
    return null;
  }

  const routeEnterTargets = Array.from(
    document.querySelectorAll<HTMLElement>('.site-page-content, .profile-card, .site-footer')
  );

  if (!routeEnterTargets.length) {
    return null;
  }

  for (const [index, targetElement] of routeEnterTargets.entries()) {
    targetElement.classList.add('route-enter-target');
    targetElement.style.setProperty('--route-enter-delay', `${index * 38}ms`);
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
  const bubbleElements = Array.from(tagsPageElement.querySelectorAll<HTMLButtonElement>('.tag-bubble[data-tag]'));

  if (
    !panelElement ||
    !panelTitleElement ||
    !panelMetaElement ||
    !panelContentElement ||
    !closeButtonElement ||
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

  const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeBubbleElement: HTMLButtonElement | null = null;

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

    panelElement.scrollIntoView({
      behavior: reducedMotionMediaQuery.matches ? 'auto' : 'smooth',
      block: 'start'
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

  for (const bubbleElement of bubbleElements) {
    bubbleElement.addEventListener('click', handleBubbleClick);
  }

  closeButtonElement.addEventListener('click', closePanel);

  return () => {
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

window.addEventListener('popstate', () => {
  renderApp();
});

renderApp();
