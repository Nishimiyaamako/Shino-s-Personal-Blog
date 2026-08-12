import './styles/global.css';
import '@iconify/iconify';

import {
  applyFixedPreviewState,
  createHistoryStateWithIndex,
  confirmAdminNavigation,
  ensureHistoryIndexState,
  getCurrentHistoryIndex,
  hasUnsavedAdminChanges,
  navigateTo,
  readHistoryIndex,
  setCurrentHistoryIndex,
  registerPageEnhancer,
  renderApp,
  setupHeaderDrawer,
  setupScrollTopButton
} from './components/shell';
import { setupAdminDashboard, setupAdminLogin } from './features/admin';
import {
  PROFILE_CARD_POP_SELECTORS,
  SIDE_PANEL_INNER_CHAIN_OFFSET_MS,
  SIDE_PANEL_INNER_STAGGER_BASE_MS,
  SIDE_PANEL_INNER_STAGGER_STEP_MS,
  setupAboutContentMotion,
  setupAboutPageHydration,
  setupGlobalMotionChoreography,
  setupMobileSidePanelPlacement,
  setupPostCardRiseMotion,
  setupRouteEnterTransition,
  setupSidePanelPopMotion
} from './features/motion';
import { setupArchiveTimelineReveal } from './features/archive';
import { setupFriendLinkCopyButton } from './features/friends';
import { setupPostDetailBackButton, setupPostDetailCodeBlockCopy, setupPostDetailToc } from './features/post-detail';
import { setupPostDateSortToggle, setupPostThemeFilter } from './features/posts';
import { setupHeaderSearchModal, setupPublicDataHydration } from './features/public-runtime';
import { setupTagCloudInteractions } from './features/tags';
import { isAdminPathname } from './router';

let suppressNextPopstateRender = false;

function setupPageEnhancements(pathname: string, options: { enableProfileCardRouteMotion: boolean }): (() => void) | null {
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

  const cleanups: Array<() => void> = [];

  const runSetup = (setup: () => (() => void) | null): void => {
    const cleanup = setup();
    if (cleanup) {
      cleanups.push(cleanup);
    }
  };

  runSetup(setupHeaderDrawer);
  runSetup(setupHeaderSearchModal);
  runSetup(() =>
    setupPublicDataHydration(pathname, {
      onDataChanged: () => {
        if (window.location.pathname !== pathname) {
          return;
        }

        renderApp();
      }
    })
  );
  runSetup(() => setupMobileSidePanelPlacement(pathname));
  runSetup(setupRouteEnterTransition);
  runSetup(() =>
    setupSidePanelPopMotion({
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
    })
  );
  runSetup(setupPostCardRiseMotion);
  runSetup(setupGlobalMotionChoreography);
  runSetup(setupScrollTopButton);
  runSetup(setupTagCloudInteractions);
  runSetup(setupPostDateSortToggle);
  runSetup(setupPostThemeFilter);
  runSetup(setupPostDetailBackButton);
  runSetup(setupPostDetailToc);
  runSetup(setupPostDetailCodeBlockCopy);
  runSetup(setupArchiveTimelineReveal);
  runSetup(setupFriendLinkCopyButton);
  runSetup(() => {
    let cleanupAboutContentMotion = setupAboutContentMotion();
    if (cleanupAboutContentMotion) {
      cleanups.push(() => {
        cleanupAboutContentMotion?.();
        cleanupAboutContentMotion = null;
      });
    }

    return setupAboutPageHydration({
      onHydrated: (aboutPageElement) => {
        cleanupAboutContentMotion?.();
        cleanupAboutContentMotion = setupAboutContentMotion({
          root: aboutPageElement,
          animateInitialVisibleItems: true
        });
      }
    });
  });

  if (!cleanups.length) {
    return null;
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
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
  void navigateTo(href);
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
    const rollbackDelta = nextHistoryIndex < getCurrentHistoryIndex() ? 1 : -1;
    window.history.go(rollbackDelta);
    return;
  }

  setCurrentHistoryIndex(nextHistoryIndex);
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
registerPageEnhancer(setupPageEnhancements);
renderApp();
