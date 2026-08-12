import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { AdminFriendLink, AdminPost, AdminProfileCard } from '../../types/api';
import { escapeHtml } from '../../utils/escape-html';

marked.use({
  gfm: true,
  breaks: false,
  async: false
});

export const MARKDOWN_PREVIEW_EMPTY_HTML = '<p class="empty-hint">输入 Markdown 后可在这里预览。</p>';

export function setMessage(
  element: HTMLElement | null,
  message: string,
  options: { error?: boolean } = {}
): void {
  if (!element) {
    return;
  }

  if (!message) {
    element.hidden = true;
    element.textContent = '';
    return;
  }

  element.hidden = false;
  element.textContent = message;
  element.classList.toggle('is-error', options.error === true);
}

export interface AdminConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

/** 样式化二次确认（替代原生 window.confirm 的破坏性操作确认）。 */
export function confirmAdminAction(options: AdminConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;

    const settle = (result: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      overlay.removeEventListener('click', handleOverlayClick);
      document.removeEventListener('keydown', handleKeydown);
      overlay.remove();
      resolve(result);
    };

    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        settle(false);
      }
    };

    const handleOverlayClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.closest('[data-role="admin-dialog-confirm"]')) {
        settle(true);
        return;
      }
      if (target.closest('[data-role="admin-dialog-cancel"]') || target === overlay) {
        settle(false);
      }
    };

    const overlay = document.createElement('div');
    overlay.className = 'admin-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="admin-dialog">
        <h3 class="admin-dialog-title">${escapeHtml(options.title)}</h3>
        <p class="admin-dialog-message">${escapeHtml(options.message)}</p>
        <div class="admin-dialog-actions">
          <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-dialog-cancel">${escapeHtml(options.cancelText ?? '取消')}</button>
          <button type="button" class="admin-btn ${options.danger === false ? 'admin-btn-primary' : 'admin-btn-danger'}" data-role="admin-dialog-confirm">${escapeHtml(options.confirmText ?? '确认')}</button>
        </div>
      </div>
    `;

    overlay.addEventListener('click', handleOverlayClick);
    document.addEventListener('keydown', handleKeydown);
    document.body.appendChild(overlay);
    const confirmButton = overlay.querySelector<HTMLButtonElement>('[data-role="admin-dialog-confirm"]');
    confirmButton?.focus();
  });
}

export function splitTags(rawTags: string): string[] {
  return rawTags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function serializeContacts(contacts: AdminProfileCard['contacts']): string {
  return contacts
    .map((contact) => `${contact.platform}|${contact.label}|${contact.href}`)
    .join('\n');
}

export function parseContacts(rawValue: string): AdminProfileCard['contacts'] {
  return rawValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [platform = '', label = '', href = ''] = line.split('|').map((part) => part.trim());
      return {
        platform,
        label,
        href,
        displayOrder: index
      };
    })
    .filter((contact) => contact.platform && contact.href);
}

export function renderMarkdownPreviewHtml(markdownText: string): string {
  const normalizedMarkdown = markdownText.trim();

  if (!normalizedMarkdown) {
    return MARKDOWN_PREVIEW_EMPTY_HTML;
  }

  const rendered = marked.parse(normalizedMarkdown);
  const html = typeof rendered === 'string' ? rendered : '';

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true }
  });
}

export function formatPostStatus(post: AdminPost): string {
  return post.status === 'published' ? '已发布' : '草稿';
}

export function readPostFormPayload(form: HTMLFormElement): Partial<AdminPost> {
  const formData = new FormData(form);

  const status = String(formData.get('status') ?? 'draft');
  const manualSlug = String(formData.get('slugManual') ?? '').trim();
  const autoSlug = String(formData.get('slug') ?? '').trim();

  return {
    title: String(formData.get('title') ?? '').trim(),
    slug: manualSlug || autoSlug,
    date: String(formData.get('date') ?? '').trim(),
    summary: String(formData.get('summary') ?? '').trim(),
    theme: String(formData.get('theme') ?? '').trim() || undefined,
    tags: splitTags(String(formData.get('tags') ?? '')),
    coverImageUrl: String(formData.get('coverImageUrl') ?? '').trim() || undefined,
    contentMarkdown: String(formData.get('contentMarkdown') ?? ''),
    status: status === 'draft' ? 'draft' : 'published'
  };
}

export function fillPostForm(form: HTMLFormElement, post: AdminPost | null): void {
  if (!post) {
    form.reset();
    const idInput = form.elements.namedItem('id');
    if (idInput instanceof HTMLInputElement) {
      idInput.value = '';
    }
    return;
  }

  (form.elements.namedItem('id') as HTMLInputElement).value = String(post.id);
  (form.elements.namedItem('title') as HTMLInputElement).value = post.title;
  (form.elements.namedItem('slug') as HTMLInputElement).value = post.slug;
  (form.elements.namedItem('date') as HTMLInputElement).value = post.date;
  (form.elements.namedItem('summary') as HTMLTextAreaElement).value = post.summary;
  (form.elements.namedItem('theme') as HTMLInputElement).value = post.theme ?? '';
  (form.elements.namedItem('tags') as HTMLInputElement).value = post.tags.join(', ');
  (form.elements.namedItem('coverImageUrl') as HTMLInputElement).value = post.coverImageUrl ?? '';
  (form.elements.namedItem('status') as HTMLSelectElement).value = post.status;
  (form.elements.namedItem('contentMarkdown') as HTMLTextAreaElement).value = post.contentMarkdown;
  // Clear manual slug override when loading existing post
  const slugOverride = form.elements.namedItem('slugManual');
  if (slugOverride instanceof HTMLInputElement) {
    slugOverride.value = '';
  }
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export function renderAdminPostList(posts: AdminPost[], selectedPostId: number): string {
  if (!posts.length) {
    return '<li class="admin-state-hint">当前筛选条件下暂无文章。点击「新建」开始创建。</li>';
  }

  return posts
    .map(
      (post) => `<li>
      <button type="button" class="admin-list-button${post.id === selectedPostId ? ' is-active' : ''}" data-role="admin-post-select" data-post-id="${post.id}">
        ${post.coverImageUrl
          ? `<img class="admin-post-list-cover" src="${escapeHtml(post.coverImageUrl)}" alt="" loading="lazy" />`
          : ''
        }
        <span class="admin-list-button-text">
          <strong class="admin-truncate">${escapeHtml(post.title)}</strong>
          <small>${escapeHtml(post.date)} · ${escapeHtml(formatPostStatus(post))}</small>
          ${post.tags.length > 0
            ? `<small class="admin-post-list-tags">${post.tags.slice(0, 3).map((tag) => escapeHtml(tag)).join(' · ')}</small>`
            : ''
          }
        </span>
      </button>
    </li>`
    )
    .join('');
}

export function renderFriendList(links: AdminFriendLink[]): string {
  if (!links.length) {
    return '<li class="admin-state-hint">当前还没有友链。填写右侧表单后即可创建。</li>';
  }

  return links
    .map(
      (link) => `<li>
      <div>
        <strong class="admin-truncate">${escapeHtml(link.name)}</strong>
        <small class="admin-truncate">${escapeHtml(link.url)}</small>
        <span class="admin-friend-meta">
          <span class="admin-friend-status-badge${link.enabled ? ' is-enabled' : ' is-disabled'}">${link.enabled ? '已启用' : '已停用'}</span>
          <small>排序 ${link.displayOrder}</small>
        </span>
      </div>
      <div class="admin-inline-actions">
        <button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-role="admin-friend-edit" data-friend-id="${link.id}">编辑</button>
        <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-role="admin-friend-delete" data-friend-id="${link.id}">删除</button>
      </div>
    </li>`
    )
    .join('');
}
