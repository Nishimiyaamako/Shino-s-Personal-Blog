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
  return `${post.status}${post.isFeatured ? ' · featured' : ''}`;
}

export function readPostFormPayload(form: HTMLFormElement): Partial<AdminPost> {
  const formData = new FormData(form);

  const status = String(formData.get('status') ?? 'draft');
  const featuredOrderText = String(formData.get('featuredOrder') ?? '').trim();

  return {
    title: String(formData.get('title') ?? '').trim(),
    slug: String(formData.get('slug') ?? '').trim(),
    date: String(formData.get('date') ?? '').trim(),
    summary: String(formData.get('summary') ?? '').trim(),
    theme: String(formData.get('theme') ?? '').trim() || undefined,
    tags: splitTags(String(formData.get('tags') ?? '')),
    coverImageUrl: String(formData.get('coverImageUrl') ?? '').trim() || undefined,
    contentMarkdown: String(formData.get('contentMarkdown') ?? ''),
    status: status === 'draft' ? 'draft' : 'published',
    isFeatured: Boolean(formData.get('isFeatured')),
    featuredOrder: featuredOrderText ? Number(featuredOrderText) : undefined
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
  (form.elements.namedItem('isFeatured') as HTMLInputElement).checked = post.isFeatured;
  (form.elements.namedItem('featuredOrder') as HTMLInputElement).value =
    typeof post.featuredOrder === 'number' ? String(post.featuredOrder) : '';
  (form.elements.namedItem('contentMarkdown') as HTMLTextAreaElement).value = post.contentMarkdown;
}

export function renderAdminPostList(posts: AdminPost[], selectedPostId: number): string {
  if (!posts.length) {
    return '<li class="empty-hint">当前筛选条件下暂无文章。</li>';
  }

  return posts
    .map(
      (post) => `<li>
      <button type="button" class="admin-list-button${post.id === selectedPostId ? ' is-active' : ''}" data-role="admin-post-select" data-post-id="${post.id}">
        <strong>${escapeHtml(post.title)}</strong>
        <small>${escapeHtml(post.date)} · ${escapeHtml(formatPostStatus(post))}</small>
      </button>
    </li>`
    )
    .join('');
}

export function renderFeaturedList(posts: AdminPost[]): string {
  const featuredPosts = posts
    .filter((post) => post.status === 'published')
    .sort((left, right) => {
      const leftOrder = typeof left.featuredOrder === 'number' ? left.featuredOrder : Number.MAX_SAFE_INTEGER;
      const rightOrder = typeof right.featuredOrder === 'number' ? right.featuredOrder : Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return right.date.localeCompare(left.date, 'en');
    });

  if (!featuredPosts.length) {
    return '<li class="empty-hint">暂无已发布文章。</li>';
  }

  return featuredPosts
    .map(
      (post) => `<li class="admin-featured-item" data-featured-id="${post.id}">
      <div>
        <strong>${escapeHtml(post.title)}</strong>
        <small>${escapeHtml(post.slug)}</small>
      </div>
      <label>
        <input type="checkbox" data-role="admin-featured-enabled" ${post.isFeatured ? 'checked' : ''} />
        <span>精选</span>
      </label>
      <input type="number" min="1" value="${typeof post.featuredOrder === 'number' ? post.featuredOrder : ''}" data-role="admin-featured-order" placeholder="排序" />
      <button type="button" data-role="admin-featured-save">保存</button>
    </li>`
    )
    .join('');
}

export function renderFriendList(links: AdminFriendLink[]): string {
  if (!links.length) {
    return '<li class="empty-hint">暂无友链。</li>';
  }

  return links
    .map(
      (link) => `<li>
      <div>
        <strong>${escapeHtml(link.name)}</strong>
        <small>${escapeHtml(link.url)}</small>
        <small>${link.enabled ? '已启用' : '已停用'} · 排序 ${link.displayOrder}</small>
      </div>
      <div class="admin-inline-actions">
        <button type="button" data-role="admin-friend-edit" data-friend-id="${link.id}">编辑</button>
        <button type="button" data-role="admin-friend-delete" data-friend-id="${link.id}">删除</button>
      </div>
    </li>`
    )
    .join('');
}
