import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import rust from 'highlight.js/lib/languages/rust';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import { createHistoryStateWithIndex, getCurrentHistoryIndex, navigateTo } from '../components/shell';
import { SIDE_PANEL_INNER_CHAIN_OFFSET_MS, SIDE_PANEL_INNER_STAGGER_BASE_MS, SIDE_PANEL_INNER_STAGGER_STEP_MS } from './motion';
import { setCssPxVar, setCssVar } from '../utils/dom-style';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);

export function setupPostDetailBackButton(): (() => void) | null {
  const backButtonElement = document.querySelector<HTMLButtonElement>('[data-role="post-detail-back"]');

  if (!backButtonElement) {
    return null;
  }

  const handleBackButtonClick = async (event: MouseEvent): Promise<void> => {
    event.preventDefault();

    if (getCurrentHistoryIndex() > 0) {
      window.history.back();
      return;
    }

    await navigateTo('/blog', { replace: true });
  };

  backButtonElement.addEventListener('click', handleBackButtonClick);

  return () => {
    backButtonElement.removeEventListener('click', handleBackButtonClick);
  };
}

export function setupPostDetailToc(): (() => void) | null {
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
      createHistoryStateWithIndex(getCurrentHistoryIndex()),
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

export function setupPostDetailCodeBlockCopy(): (() => void) | null {
  const codeElements = Array.from(
    document.querySelectorAll<HTMLElement>('.page-post-detail .markdown-content pre > code')
  );

  if (!codeElements.length) {
    return null;
  }

  for (const codeElement of codeElements) {
    if (!codeElement.classList.contains('hljs')) {
      continue;
    }

    try {
      hljs.highlightElement(codeElement);
    } catch {
      // 高亮失败不影响代码块展示（保持转义原文）
    }
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

export function getHeadingTextContent(headingElement: HTMLHeadingElement): string {
  return headingElement.textContent?.trim().replace(/\s+/g, ' ') ?? '';
}

export function normalizeHeadingId(id: string): string {
  return id.trim();
}

export function createUniqueHeadingId(title: string, usedIdSet: Set<string>): string {
  const baseId = slugifyHeadingText(title) || 'section';
  let nextId = baseId;
  let suffix = 2;

  while (usedIdSet.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

export function slugifyHeadingText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function decodeHashTargetId(hashValue: string): string {
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
