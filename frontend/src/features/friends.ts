export function setupFriendLinkCopyButton(): (() => void) | null {
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
