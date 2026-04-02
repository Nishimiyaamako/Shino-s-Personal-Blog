import { fetchFriendLinks, fetchPostDetail, fetchProfileCard, fetchPublicPosts, searchPosts } from '../data/api';
import { applyRemoteFriendLinks } from '../data/friends';
import { applyRemotePostDetail, applyRemotePublishedPostSummaries } from '../data/posts';
import { applyRemoteProfileCard } from '../data/profile-card';
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

  const modalShell = document.createElement('div');
  modalShell.className = 'site-search-modal-shell';
  modalShell.hidden = true;
  modalShell.innerHTML = `
<div class="site-search-modal-backdrop" data-role="site-search-close"></div>
<div class="site-search-modal" role="dialog" aria-modal="true" aria-labelledby="site-search-title">
  <header class="site-search-head">
    <h2 id="site-search-title">站内搜索</h2>
    <button type="button" class="site-search-close" data-role="site-search-close" aria-label="关闭搜索">×</button>
  </header>
  <label class="site-search-input-wrap">
    <span>关键词</span>
    <input type="search" data-role="site-search-input" placeholder="搜索标题、摘要、标签、正文" />
  </label>
  <div class="site-search-result" data-role="site-search-result">
    <p class="empty-hint">输入关键词开始搜索。</p>
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

  const setOpenState = (open: boolean): void => {
    modalShell.hidden = !open;

    if (open) {
      window.requestAnimationFrame(() => {
        inputElement.focus();
      });
      return;
    }

    inputElement.blur();
    searchAbortController?.abort();
    searchAbortController = null;
  };

  const renderSearchResult = (queryText: string, items: Awaited<ReturnType<typeof searchPosts>>): void => {
    if (!queryText.trim()) {
      resultElement.innerHTML = '<p class="empty-hint">输入关键词开始搜索。</p>';
      return;
    }

    if (!items.length) {
      resultElement.innerHTML = '<p class="empty-hint">未找到匹配内容。</p>';
      return;
    }

    resultElement.innerHTML = `<ul class="site-search-result-list">
      ${items
        .map(
          (item) => `<li>
            <a href="/posts/${encodeURIComponent(item.slug)}" data-link>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.snippet || item.summary)}</p>
              <small>${escapeHtml(item.tags.map((tag) => `#${tag}`).join(' '))}</small>
            </a>
          </li>`
        )
        .join('')}
    </ul>`;
  };

  const triggerSearch = (): void => {
    window.clearTimeout(searchDebounceTimer);

    const queryText = inputElement.value.trim();

    searchDebounceTimer = window.setTimeout(async () => {
      searchAbortController?.abort();
      searchAbortController = new AbortController();

      try {
        const items = await searchPosts(queryText, 12, searchAbortController.signal);
        renderSearchResult(queryText, items);
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        resultElement.innerHTML = '<p class="empty-hint">搜索暂时不可用。</p>';
      }
    }, 200);
  };

  const handleTriggerClick = (): void => {
    setOpenState(true);
  };

  const handleInput = (): void => {
    triggerSearch();
  };

  const handleEscKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || modalShell.hidden) {
      return;
    }

    setOpenState(false);
  };

  const handleClose = (): void => {
    setOpenState(false);
  };

  const handleResultClick = (event: Event): void => {
    const targetElement = event.target;

    if (!(targetElement instanceof HTMLElement)) {
      return;
    }

    if (targetElement.closest('a[data-link]')) {
      setOpenState(false);
    }
  };

  triggerButton.addEventListener('click', handleTriggerClick);
  inputElement.addEventListener('input', handleInput);
  resultElement.addEventListener('click', handleResultClick);

  for (const closeTarget of closeTargets) {
    closeTarget.addEventListener('click', handleClose);
  }

  window.addEventListener('keydown', handleEscKey);

  return () => {
    window.clearTimeout(searchDebounceTimer);
    searchAbortController?.abort();

    triggerButton.removeEventListener('click', handleTriggerClick);
    inputElement.removeEventListener('input', handleInput);
    resultElement.removeEventListener('click', handleResultClick);

    for (const closeTarget of closeTargets) {
      closeTarget.removeEventListener('click', handleClose);
    }

    window.removeEventListener('keydown', handleEscKey);
    modalShell.remove();
  };
}
