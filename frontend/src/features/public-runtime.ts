import DOMPurify from 'dompurify';
import { fetchFriendLinks, fetchPostDetail, fetchProfileCard, fetchPublicPosts, searchPosts } from '../data/api';
import { applyRemoteFriendLinks } from '../data/friends';
import { applyRemotePostDetail, applyRemotePublishedPostSummaries } from '../data/posts';
import { applyRemoteProfileCard } from '../data/profile-card';
import type { SearchResultItem } from '../types/api';
import { escapeHtml } from '../utils/escape-html';

function shouldHydratePostCollection(pathname: string): boolean {
  return (
    pathname === '/'
    || pathname === '/posts'
    || pathname === '/tags'
    || pathname === '/archive'
    || pathname.startsWith('/tags/')
    || pathname.startsWith('/posts/')
  );
}

function shouldHydrateProfileCard(pathname: string): boolean {
  return pathname === '/' || pathname === '/posts' || pathname.startsWith('/posts/');
}

function readSlugFromPathname(pathname: string): string {
  if (!pathname.startsWith('/posts/')) {
    return '';
  }

  return pathname.slice('/posts/'.length).trim();
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

const SEARCH_PUBLISHED_DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Shanghai'
});
const SEARCH_RESULT_VISIBLE_TAGS = 2;

function sanitizeSearchSnippet(rawSnippet: string): string {
  const sanitized = DOMPurify.sanitize(rawSnippet, {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: []
  });

  return sanitized.trim();
}

function formatSearchPublishedLabel(publishedAt: string): string {
  const normalized = publishedAt.trim();

  if (!normalized) {
    return '';
  }

  const candidate = new Date(normalized);

  if (Number.isNaN(candidate.getTime())) {
    return normalized;
  }

  return SEARCH_PUBLISHED_DATE_FORMATTER.format(candidate);
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement;
}

export function setupPublicDataHydration(
  pathname: string,
  options: { onDataChanged: () => void }
): (() => void) | null {
  const abortController = new AbortController();
  let disposed = false;

  void (async () => {
    let shouldRerender = false;

    try {
      if (shouldHydratePostCollection(pathname)) {
        const postResponse = await fetchPublicPosts({ page: 1, pageSize: 300, signal: abortController.signal });

        if (!disposed) {
          shouldRerender = applyRemotePublishedPostSummaries(postResponse.items) || shouldRerender;
        }

        const detailSlug = readSlugFromPathname(pathname);

        if (detailSlug) {
          const detail = await fetchPostDetail(detailSlug, abortController.signal);

          if (!disposed && detail) {
            shouldRerender = applyRemotePostDetail(detail) || shouldRerender;
          }
        }
      }

      if (pathname === '/friends') {
        const links = await fetchFriendLinks(abortController.signal);

        if (!disposed) {
          shouldRerender = applyRemoteFriendLinks(links) || shouldRerender;
        }
      }

      if (shouldHydrateProfileCard(pathname)) {
        const profileCard = await fetchProfileCard(abortController.signal);

        if (!disposed) {
          shouldRerender = applyRemoteProfileCard(profileCard) || shouldRerender;
        }
      }

      if (!disposed && shouldRerender) {
        options.onDataChanged();
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      console.debug('[hydrate] public data hydration skipped:', error);
    }
  })();

  return () => {
    disposed = true;
    abortController.abort();
  };
}

export function setupHeaderSearchModal(): (() => void) | null {
  const triggerButton = document.querySelector<HTMLButtonElement>('[data-role="header-search-trigger"]');

  if (!triggerButton) {
    return null;
  }

  type SearchModalState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

  const modalShell = document.createElement('div');
  modalShell.className = 'site-search-modal-shell';
  modalShell.hidden = true;
  modalShell.innerHTML = `
<div class="site-search-modal-backdrop" data-role="site-search-close"></div>
<div class="site-search-modal" role="dialog" aria-modal="true" aria-labelledby="site-search-title">
  <header class="site-search-head">
    <div class="site-search-head-copy">
      <h2 id="site-search-title">站内搜索</h2>
    </div>
    <button type="button" class="site-search-close" data-role="site-search-close" aria-label="关闭搜索">关闭</button>
  </header>
  <label class="site-search-input-wrap" aria-label="站内搜索输入框">
    <span class="site-search-input-icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.05" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="6.8" />
        <path d="m16 16 4 4" />
      </svg>
    </span>
    <input
      id="site-search-input"
      type="search"
      data-role="site-search-input"
      placeholder="搜索标题、摘要、标签、正文"
      autocomplete="off"
      spellcheck="false"
      aria-controls="site-search-result-region"
    />
    <kbd class="site-search-kbd" aria-hidden="true">ESC</kbd>
  </label>
  <div class="site-search-result" data-role="site-search-result" id="site-search-result-region">
    <section class="site-search-state">
      <p>输入关键词开始搜索</p>
      <div class="site-search-shortcuts" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
        <span><kbd>Enter</kbd> 打开</span>
        <span><kbd>Esc</kbd> 关闭</span>
      </div>
    </section>
  </div>
</div>
`;

  document.body.append(modalShell);

  const inputElement = modalShell.querySelector<HTMLInputElement>('[data-role="site-search-input"]');
  const resultElement = modalShell.querySelector<HTMLElement>('[data-role="site-search-result"]');
  const closeTargets = Array.from(modalShell.querySelectorAll<HTMLElement>('[data-role="site-search-close"]'));

  if (!inputElement || !resultElement) {
    modalShell.remove();
    return null;
  }

  let searchAbortController: AbortController | null = null;
  let searchDebounceTimer = 0;
  let closeTransitionTimer = 0;
  let searchState: SearchModalState = 'idle';
  let latestQueryText = '';
  let latestItems: SearchResultItem[] = [];
  let activeResultIndex = -1;

  const clearSearchRequest = (): void => {
    window.clearTimeout(searchDebounceTimer);
    searchAbortController?.abort();
    searchAbortController = null;
  };

  const renderSearchShortcuts = (): string => `
<div class="site-search-shortcuts" aria-hidden="true">
  <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
  <span><kbd>Enter</kbd> 打开</span>
  <span><kbd>Esc</kbd> 关闭</span>
</div>`;

  const setActiveDescendant = (optionId: string): void => {
    if (!optionId) {
      inputElement.removeAttribute('aria-activedescendant');
      return;
    }

    inputElement.setAttribute('aria-activedescendant', optionId);
  };

  const setActiveResultIndex = (index: number, options: { scrollIntoView?: boolean } = {}): void => {
    activeResultIndex = index;

    const optionElements = Array.from(
      resultElement.querySelectorAll<HTMLElement>('[data-role="site-search-result-item"]')
    );

    if (!optionElements.length || activeResultIndex < 0 || activeResultIndex >= optionElements.length) {
      activeResultIndex = -1;
      setActiveDescendant('');
      return;
    }

    for (const [optionIndex, optionElement] of optionElements.entries()) {
      const selected = optionIndex === activeResultIndex;
      optionElement.classList.toggle('is-active', selected);
      optionElement.setAttribute('aria-selected', selected ? 'true' : 'false');
    }

    const activeOptionElement = optionElements[activeResultIndex];
    setActiveDescendant(activeOptionElement.id);

    if (options.scrollIntoView) {
      activeOptionElement.scrollIntoView({ block: 'nearest' });
    }
  };

  const renderSearchState = (): void => {
    switch (searchState) {
      case 'loading':
        resultElement.innerHTML = `
<section class="site-search-state">
  <span class="site-search-spinner" aria-hidden="true"></span>
  <p>正在搜索「${escapeHtml(latestQueryText)}」…</p>
  ${renderSearchShortcuts()}
</section>`;
        setActiveDescendant('');
        return;

      case 'empty':
        resultElement.innerHTML = `
<section class="site-search-state">
  <p>未找到「${escapeHtml(latestQueryText)}」相关内容。</p>
  ${renderSearchShortcuts()}
</section>`;
        setActiveDescendant('');
        return;

      case 'error':
        resultElement.innerHTML = `
<section class="site-search-state is-error">
  <p>搜索暂时不可用，请稍后重试。</p>
  <button type="button" class="site-search-retry" data-role="site-search-retry">重新搜索</button>
  ${renderSearchShortcuts()}
</section>`;
        setActiveDescendant('');
        return;

      case 'success': {
        if (!latestItems.length) {
          searchState = 'empty';
          renderSearchState();
          return;
        }

        const listHtml = latestItems
          .map((item, index) => {
            const resultId = `site-search-result-option-${index}`;
            const snippetSource = item.snippet?.trim() || item.summary;
            const snippetHtml = item.snippet?.trim()
              ? sanitizeSearchSnippet(item.snippet)
              : escapeHtml(snippetSource);
            const normalizedSnippetHtml = snippetHtml || escapeHtml(item.summary);
            const publishedLabel = formatSearchPublishedLabel(item.publishedAt);
            const visibleTags = item.tags.slice(0, SEARCH_RESULT_VISIBLE_TAGS);
            const hiddenTagCount = Math.max(0, item.tags.length - visibleTags.length);
            const tagsHtml = visibleTags.length
              ? `<ul class="site-search-result-tags" aria-label="标签">${visibleTags
                  .map((tag) => `<li class="site-search-tag">#${escapeHtml(tag)}</li>`)
                  .join('')}${hiddenTagCount > 0 ? `<li class="site-search-tag site-search-tag--more">+${hiddenTagCount}</li>` : ''}</ul>`
              : '';
            const metaHtml = (publishedLabel || tagsHtml)
              ? `<div class="site-search-result-meta${tagsHtml ? ' has-tags' : ''}">
      ${publishedLabel ? `<span class="site-search-result-date">${escapeHtml(publishedLabel)}</span>` : ''}
      ${tagsHtml}
    </div>`
              : '';

            return `
<li
  class="site-search-result-item"
  id="${resultId}"
  role="option"
  aria-selected="false"
  data-role="site-search-result-item"
  data-result-index="${index}"
>
  <a
    class="site-search-result-link"
    href="/posts/${encodeURIComponent(item.slug)}"
    data-link
    data-role="site-search-result-link"
    data-result-index="${index}"
  >
    <h3 class="site-search-result-title">${escapeHtml(item.title)}</h3>
    <p class="site-search-result-snippet">${normalizedSnippetHtml}</p>
    ${metaHtml}
  </a>
</li>`;
          })
          .join('');

        resultElement.innerHTML = `
<ul class="site-search-result-list" role="listbox" aria-label="搜索结果列表">
  ${listHtml}
</ul>`;

        const normalizedIndex = activeResultIndex < 0
          ? 0
          : Math.min(activeResultIndex, latestItems.length - 1);
        setActiveResultIndex(normalizedIndex);
        return;
      }

      case 'idle':
      default:
        resultElement.innerHTML = `
<section class="site-search-state">
  <p>输入关键词开始搜索</p>
  ${renderSearchShortcuts()}
</section>`;
        setActiveDescendant('');
    }
  };

  const runSearch = async (queryText: string): Promise<void> => {
    const normalizedQuery = queryText.trim();
    latestQueryText = normalizedQuery;

    if (!normalizedQuery) {
      latestItems = [];
      searchState = 'idle';
      activeResultIndex = -1;
      renderSearchState();
      return;
    }

    searchAbortController?.abort();
    searchAbortController = new AbortController();

    searchState = 'loading';
    activeResultIndex = -1;
    renderSearchState();

    try {
      const items = await searchPosts(normalizedQuery, 12, searchAbortController.signal);

      if (inputElement.value.trim() !== normalizedQuery) {
        return;
      }

      latestItems = items;
      searchState = items.length ? 'success' : 'empty';
      activeResultIndex = items.length ? 0 : -1;
      renderSearchState();
    } catch (error) {
      if (isAbortError(error) || inputElement.value.trim() !== normalizedQuery) {
        return;
      }

      latestItems = [];
      activeResultIndex = -1;
      searchState = 'error';
      renderSearchState();
    }
  };

  const setOpenState = (open: boolean): void => {
    window.clearTimeout(closeTransitionTimer);

    if (open) {
      modalShell.hidden = false;
      modalShell.classList.remove('is-closing');
      window.requestAnimationFrame(() => {
        modalShell.classList.add('is-open');
      });
      document.body.classList.add('is-site-search-open');

      window.requestAnimationFrame(() => {
        inputElement.focus();
        const inputValueLength = inputElement.value.length;
        inputElement.setSelectionRange(inputValueLength, inputValueLength);
      });
      return;
    }

    modalShell.classList.remove('is-open');
    modalShell.classList.add('is-closing');
    document.body.classList.remove('is-site-search-open');

    closeTransitionTimer = window.setTimeout(() => {
      modalShell.hidden = true;
      modalShell.classList.remove('is-closing');
    }, 180);

    inputElement.blur();
    clearSearchRequest();
  };

  const triggerSearch = (): void => {
    clearSearchRequest();

    const queryText = inputElement.value.trim();
    latestQueryText = queryText;

    if (!queryText) {
      latestItems = [];
      searchState = 'idle';
      activeResultIndex = -1;
      renderSearchState();
      return;
    }

    searchDebounceTimer = window.setTimeout(() => {
      void runSearch(queryText);
    }, 220);
  };

  const handleTriggerClick = (): void => {
    setOpenState(true);
  };

  const handleInput = (): void => {
    triggerSearch();
  };

  const handleEscKey = (event: KeyboardEvent): void => {
    const modalOpened = !modalShell.hidden;

    if (event.key === 'Escape' && modalOpened) {
      event.preventDefault();
      setOpenState(false);
      return;
    }

    if (modalOpened) {
      if (event.isComposing) {
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (searchState !== 'success' || !latestItems.length) {
          return;
        }

        event.preventDefault();

        if (activeResultIndex < 0) {
          setActiveResultIndex(event.key === 'ArrowDown' ? 0 : latestItems.length - 1, {
            scrollIntoView: true
          });
          return;
        }

        const offset = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = (activeResultIndex + offset + latestItems.length) % latestItems.length;
        setActiveResultIndex(nextIndex, { scrollIntoView: true });
        return;
      }

      if (event.key === 'Enter') {
        if (searchState !== 'success' || activeResultIndex < 0 || activeResultIndex >= latestItems.length) {
          return;
        }

        const activeLink = resultElement.querySelector<HTMLAnchorElement>(
          `[data-role="site-search-result-link"][data-result-index="${activeResultIndex}"]`
        );

        if (!activeLink) {
          return;
        }

        event.preventDefault();
        activeLink.click();
      }

      return;
    }

    const lowerKey = event.key.toLowerCase();
    const slashShortcut = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
    const commandPaletteShortcut = (event.ctrlKey || event.metaKey)
      && !event.shiftKey
      && !event.altKey
      && lowerKey === 'k';

    if ((!slashShortcut && !commandPaletteShortcut) || isEditableEventTarget(event.target)) {
      return;
    }

    event.preventDefault();
    setOpenState(true);
  };

  const handleClose = (): void => {
    setOpenState(false);
  };

  const handleResultClick = (event: Event): void => {
    const targetElement = event.target;

    if (!(targetElement instanceof HTMLElement)) {
      return;
    }

    const retryButton = targetElement.closest<HTMLButtonElement>('[data-role="site-search-retry"]');
    if (retryButton) {
      const queryText = inputElement.value.trim() || latestQueryText;

      if (queryText) {
        void runSearch(queryText);
      }

      return;
    }

    if (targetElement.closest('a[data-link][data-role="site-search-result-link"]')) {
      setOpenState(false);
    }
  };

  const handleResultMouseOver = (event: Event): void => {
    if (searchState !== 'success' || !latestItems.length) {
      return;
    }

    const targetElement = event.target;
    if (!(targetElement instanceof HTMLElement)) {
      return;
    }

    const optionElement = targetElement.closest<HTMLElement>('[data-role="site-search-result-item"]');
    if (!optionElement) {
      return;
    }

    const index = Number(optionElement.dataset.resultIndex ?? '');
    if (!Number.isFinite(index)) {
      return;
    }

    setActiveResultIndex(index);
  };

  triggerButton.addEventListener('click', handleTriggerClick);
  inputElement.addEventListener('input', handleInput);
  resultElement.addEventListener('click', handleResultClick);
  resultElement.addEventListener('mouseover', handleResultMouseOver);

  for (const closeTarget of closeTargets) {
    closeTarget.addEventListener('click', handleClose);
  }

  window.addEventListener('keydown', handleEscKey);

  return () => {
    clearSearchRequest();
    window.clearTimeout(closeTransitionTimer);

    triggerButton.removeEventListener('click', handleTriggerClick);
    inputElement.removeEventListener('input', handleInput);
    resultElement.removeEventListener('click', handleResultClick);
    resultElement.removeEventListener('mouseover', handleResultMouseOver);

    for (const closeTarget of closeTargets) {
      closeTarget.removeEventListener('click', handleClose);
    }

    window.removeEventListener('keydown', handleEscKey);
    modalShell.classList.remove('is-open', 'is-closing');
    document.body.classList.remove('is-site-search-open');
    modalShell.remove();
  };
}
