import { fetchAboutViewModel } from '../data/about';
import { renderAboutPageBody } from '../pages/about';
import { clearCssVar, setCssVar } from '../utils/dom-style';

export type MotionScopeNode = Document | Element;
export interface RefreshPostCardMotionOptions {
  replay?: boolean;
}
export interface AboutContentMotionOptions {
  root?: ParentNode;
  animateInitialVisibleItems?: boolean;
}
type SidePanelDirectionClassName = 'motion-side-pop-item--from-left' | 'motion-side-pop-item--from-right';
export type ContentRhythmGroup = 'lead' | 'body';

export interface SidePanelMotionGroupConfig {
  selectors: readonly string[];
  directionClassName: SidePanelDirectionClassName;
  variantClassName: 'motion-side-pop-item--profile' | 'motion-side-pop-item--theme' | 'motion-side-pop-item--toc';
  delayBaseMs: number;
  shouldIncludeGroup?: boolean;
  shouldIncludeTarget?: (targetElement: HTMLElement) => boolean;
  innerSelectors?: readonly string[];
  avatarSelectors?: readonly string[];
}

export interface PostCardMotionHandle {
  current: ((scope?: MotionScopeNode, options?: RefreshPostCardMotionOptions) => void) | null;
}

export const postCardMotionHandle: PostCardMotionHandle = { current: null };

const PAGE_STAGGER_SELECTORS = [
  ':scope > .section-head',
  ':scope > .page-section',
  ':scope > .about-hero',
  ':scope > .about-intro',
  ':scope > .about-divider',
  ':scope > .about-dialogue',
  ':scope > .about-timeline',
  ':scope > .hero-card',
  ':scope > .landing-hero',
  ':scope > .landing-sections',
  ':scope > .landing-about-preview',
  ':scope > .landing-social',
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
  '.post-list--posts > .post-card[data-motion-card]',
  '.post-list--tag-panel > .post-card[data-motion-card]',
  '.friend-link-list > .friend-link-card[data-motion-card]'
] as const;
export const PROFILE_CARD_POP_SELECTORS = [
  '.profile-card'
] as const;
const POST_DETAIL_READING_MOTION_SELECTORS = {
  header: ':scope > .page-header',
  backRow: ':scope > .post-detail-back-row',
  markdown: '.post-detail-layout > .markdown-content'
} as const;
const POST_LIST_SELECTOR = '.post-list, .friend-link-list';
const POST_CARD_ROW_TOLERANCE_PX = 10;
const POST_CARD_STAGGER_CAP = 10;
const MOBILE_SIDE_PANEL_MEDIA_QUERY = '(max-width: 1024px)';
const SIDE_PANEL_RHYTHM_GROUP_STEP_MS = 86;
const SIDE_PANEL_RHYTHM_ITEM_STEP_MS = 70;
export const SIDE_PANEL_INNER_STAGGER_BASE_MS = 108;
export const SIDE_PANEL_INNER_STAGGER_STEP_MS = 54;
export const SIDE_PANEL_INNER_CHAIN_OFFSET_MS = 206;
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

export function setupMobileSidePanelPlacement(pathname: string): (() => void) | null {
  const mediaQuery = window.matchMedia(MOBILE_SIDE_PANEL_MEDIA_QUERY);
  const shouldHandlePostsPage = pathname === '/blog';
  const shouldHandlePostDetailPage = pathname.startsWith('/blog/');

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

export function setupRouteEnterTransition(): (() => void) | null {
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

export function setupSidePanelPopMotion(options: { groups: readonly SidePanelMotionGroupConfig[] }): (() => void) | null {
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

export function setupPostCardRiseMotion(): (() => void) | null {
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
      const orderedCardsInList = orderPostCardsByVisualFlow(listCardElements);

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
  postCardMotionHandle.current = runPostCardMotion;
  runPostCardMotion(document);

  return () => {
    if (revealFrameId) {
      window.cancelAnimationFrame(revealFrameId);
      revealFrameId = 0;
    }

    observer?.disconnect();
    observedCardSet.clear();
    reducedMotionMediaQuery.removeEventListener('change', handleReducedMotionChange);

    if (postCardMotionHandle.current === runPostCardMotion) {
      postCardMotionHandle.current = null;
    }
  };
}

export function setupGlobalMotionChoreography(): (() => void) | null {
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

export function setupAboutContentMotion(options: AboutContentMotionOptions = {}): (() => void) | null {
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

export function setupAboutPageHydration(options: { onHydrated?: (aboutPageElement: HTMLElement) => void } = {}): (() => void) | null {
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
