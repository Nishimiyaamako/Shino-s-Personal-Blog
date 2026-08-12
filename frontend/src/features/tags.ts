import { renderPostList } from '../components/post-list';
import { getPostsByTag } from '../data/posts';
import { postCardMotionHandle } from './motion';
import { setCssVar } from '../utils/dom-style';

export function setupTagCloudInteractions(): (() => void) | null {
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
      postCardMotionHandle.current?.(panelContentElement);
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
