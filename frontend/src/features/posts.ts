import { createHistoryStateWithIndex, getCurrentHistoryIndex } from '../components/shell';
import { postCardMotionHandle } from './motion';
import { normalizeThemeKey } from '../utils/theme';

export function setupPostDateSortToggle(): (() => void) | null {
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

    postCardMotionHandle.current?.(postsPageElement);
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

export function setupPostThemeFilter(): (() => void) | null {
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

    window.history.replaceState(createHistoryStateWithIndex(getCurrentHistoryIndex()), '', nextLocation);
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
      postCardMotionHandle.current?.(postListElement, { replay: !reducedMotionMediaQuery.matches });
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
