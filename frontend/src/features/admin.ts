import {
  adminCreateFriendLink,
  adminCreatePost,
  adminDeleteFriendLink,
  adminDeletePost,
  adminFetchAbout,
  adminFetchProfileCard,
  adminListFriendLinks,
  adminListPosts,
  adminLogin,
  adminPublishPost,
  adminSetFeatured,
  adminUnpublishPost,
  adminUpdateAbout,
  adminUpdateFriendLink,
  adminUpdatePost,
  adminUpdateProfileCard,
  adminUploadImage,
  clearAdminToken,
  readAdminToken,
  writeAdminToken
} from '../data/api';
import type { AdminFriendLink, AdminPost, AdminProfileCard } from '../types/api';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { escapeHtml } from '../utils/escape-html';

interface AdminFeatureOptions {
  onNavigate: (path: string) => void;
}

marked.use({
  gfm: true,
  breaks: false,
  async: false
});

const MARKDOWN_PREVIEW_EMPTY_HTML = '<p class="empty-hint">输入 Markdown 后可在这里预览。</p>';

function setMessage(
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

function splitTags(rawTags: string): string[] {
  return rawTags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function serializeContacts(contacts: AdminProfileCard['contacts']): string {
  return contacts
    .map((contact) => `${contact.platform}|${contact.label}|${contact.href}`)
    .join('\n');
}

function parseContacts(rawValue: string): AdminProfileCard['contacts'] {
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

function renderMarkdownPreviewHtml(markdownText: string): string {
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

function formatPostStatus(post: AdminPost): string {
  return `${post.status}${post.isFeatured ? ' · featured' : ''}`;
}

function readPostFormPayload(form: HTMLFormElement): Partial<AdminPost> {
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

function fillPostForm(form: HTMLFormElement, post: AdminPost | null): void {
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

function renderAdminPostList(posts: AdminPost[], selectedPostId: number): string {
  if (!posts.length) {
    return '<li class="empty-hint">暂无文章。</li>';
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

function renderFeaturedList(posts: AdminPost[]): string {
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

function renderFriendList(links: AdminFriendLink[]): string {
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

export function setupAdminLogin(options: AdminFeatureOptions): (() => void) | null {
  const loginForm = document.querySelector<HTMLFormElement>('[data-role="admin-login-form"]');

  if (!loginForm) {
    return null;
  }

  const errorElement = document.querySelector<HTMLElement>('[data-role="admin-login-error"]');

  if (readAdminToken()) {
    options.onNavigate('/admin');
    return null;
  }

  const handleSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const username = String(formData.get('username') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    setMessage(errorElement, '');

    try {
      const response = await adminLogin(username, password);
      writeAdminToken(response.token);
      options.onNavigate('/admin');
    } catch (error) {
      setMessage(errorElement, error instanceof Error ? error.message : '登录失败', { error: true });
    }
  };

  loginForm.addEventListener('submit', handleSubmit);

  return () => {
    loginForm.removeEventListener('submit', handleSubmit);
  };
}

export function setupAdminDashboard(options: AdminFeatureOptions): (() => void) | null {
  const rootElement = document.querySelector<HTMLElement>('.page-admin-dashboard');

  if (!rootElement) {
    return null;
  }

  const token = readAdminToken();

  if (!token) {
    options.onNavigate('/admin/login');
    return null;
  }

  const logoutButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-logout"]');
  const tabButtons = Array.from(rootElement.querySelectorAll<HTMLButtonElement>('[data-role="admin-tab"]'));
  const tabPanels = Array.from(rootElement.querySelectorAll<HTMLElement>('[data-role="admin-panel"]'));

  const postListElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-list"]');
  const postForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-post-form"]');
  const postNewButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-new"]');
  const postPublishButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-publish"]');
  const postUnpublishButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-unpublish"]');
  const postDeleteButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-delete"]');
  const postErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-error"]');
  const postSuccessElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-success"]');
  const postContentTextarea = rootElement.querySelector<HTMLTextAreaElement>('[data-role="admin-post-content"]');
  const postPreviewElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-preview"]');
  const coverUploadInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-cover-upload"]');
  const coverUploadButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-cover-upload-btn"]');
  const contentUploadInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-content-upload"]');
  const contentUploadButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-content-upload-btn"]');

  const featuredListElement = rootElement.querySelector<HTMLElement>('[data-role="admin-featured-list"]');

  const friendListElement = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-list"]');
  const friendForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-friend-form"]');
  const friendErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-error"]');
  const friendSubmitButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-friend-submit"]');
  const friendCancelButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-friend-cancel"]');

  const aboutForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-about-form"]');
  const aboutErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-about-error"]');
  const aboutSuccessElement = rootElement.querySelector<HTMLElement>('[data-role="admin-about-success"]');

  const profileForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-profile-form"]');
  const profileErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-profile-error"]');
  const profileSuccessElement = rootElement.querySelector<HTMLElement>('[data-role="admin-profile-success"]');

  if (
    !logoutButton
    || !postListElement
    || !postForm
    || !postNewButton
    || !postPublishButton
    || !postUnpublishButton
    || !postDeleteButton
    || !featuredListElement
    || !friendListElement
    || !friendForm
    || !aboutForm
    || !profileForm
    || !postContentTextarea
    || !postPreviewElement
    || !coverUploadInput
    || !coverUploadButton
    || !contentUploadInput
    || !contentUploadButton
    || !friendSubmitButton
    || !friendCancelButton
  ) {
    return null;
  }

  let selectedPostId = 0;
  let selectedFriendId = 0;
  let posts: AdminPost[] = [];
  let friendLinks: AdminFriendLink[] = [];

  const updatePostMarkdownPreview = (): void => {
    postPreviewElement.innerHTML = renderMarkdownPreviewHtml(postContentTextarea.value);
  };

  const getFriendById = (friendId: number): AdminFriendLink | null => {
    return friendLinks.find((friend) => friend.id === friendId) ?? null;
  };

  const fillFriendForm = (friend: AdminFriendLink | null): void => {
    if (!friend) {
      friendForm.reset();
      (friendForm.elements.namedItem('id') as HTMLInputElement).value = '';
      (friendForm.elements.namedItem('displayOrder') as HTMLInputElement).value = '0';
      (friendForm.elements.namedItem('enabled') as HTMLInputElement).checked = true;
      friendSubmitButton.textContent = '保存友链';
      friendCancelButton.hidden = true;
      selectedFriendId = 0;
      return;
    }

    selectedFriendId = friend.id;
    (friendForm.elements.namedItem('id') as HTMLInputElement).value = String(friend.id);
    (friendForm.elements.namedItem('name') as HTMLInputElement).value = friend.name;
    (friendForm.elements.namedItem('description') as HTMLTextAreaElement).value = friend.description;
    (friendForm.elements.namedItem('avatar') as HTMLInputElement).value = friend.avatar;
    (friendForm.elements.namedItem('url') as HTMLInputElement).value = friend.url;
    (friendForm.elements.namedItem('displayOrder') as HTMLInputElement).value = String(friend.displayOrder);
    (friendForm.elements.namedItem('enabled') as HTMLInputElement).checked = friend.enabled;
    friendSubmitButton.textContent = '更新友链';
    friendCancelButton.hidden = false;
  };

  fillFriendForm(null);

  const getSelectedPost = (): AdminPost | null => {
    return posts.find((post) => post.id === selectedPostId) ?? null;
  };

  const renderPostCollections = (): void => {
    postListElement.innerHTML = renderAdminPostList(posts, selectedPostId);
    featuredListElement.innerHTML = renderFeaturedList(posts);
  };

  const renderFriendCollection = (): void => {
    friendListElement.innerHTML = renderFriendList(friendLinks);
  };

  const syncPostFormBySelection = (): void => {
    fillPostForm(postForm, getSelectedPost());
    updatePostMarkdownPreview();
    renderPostCollections();
  };

  const refreshData = async (): Promise<void> => {
    const [nextPosts, nextFriendLinks, aboutPayload, profilePayload] = await Promise.all([
      adminListPosts(token),
      adminListFriendLinks(token),
      adminFetchAbout(token),
      adminFetchProfileCard(token)
    ]);

    posts = nextPosts;
    friendLinks = nextFriendLinks;

    if (!selectedPostId || !posts.find((post) => post.id === selectedPostId)) {
      selectedPostId = posts[0]?.id ?? 0;
    }

    if (!selectedFriendId || !friendLinks.find((friend) => friend.id === selectedFriendId)) {
      selectedFriendId = 0;
    }

    renderPostCollections();
    renderFriendCollection();
    syncPostFormBySelection();
    fillFriendForm(getFriendById(selectedFriendId));

    (aboutForm.elements.namedItem('markdown') as HTMLTextAreaElement).value = aboutPayload.markdown;

    (profileForm.elements.namedItem('name') as HTMLInputElement).value = profilePayload.name;
    (profileForm.elements.namedItem('bio') as HTMLTextAreaElement).value = profilePayload.bio;
    (profileForm.elements.namedItem('avatar') as HTMLInputElement).value = profilePayload.avatar;
    (profileForm.elements.namedItem('contacts') as HTMLTextAreaElement).value = serializeContacts(profilePayload.contacts);
  };

  void refreshData().catch((error) => {
    setMessage(postErrorElement, error instanceof Error ? error.message : '后台加载失败', { error: true });
  });

  const handleLogout = (): void => {
    clearAdminToken();
    options.onNavigate('/admin/login');
  };

  const handleTabClick = (event: Event): void => {
    const target = event.currentTarget;

    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const tab = target.dataset.tab ?? '';

    for (const button of tabButtons) {
      button.classList.toggle('is-active', button === target);
    }

    for (const panel of tabPanels) {
      const isActive = panel.dataset.panel === tab;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    }
  };

  const handlePostListClick = (event: Event): void => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>('[data-role="admin-post-select"]');

    if (!button) {
      return;
    }

    const postId = Number(button.dataset.postId ?? 0);

    if (!Number.isInteger(postId) || postId <= 0) {
      return;
    }

    selectedPostId = postId;
    syncPostFormBySelection();
  };

  const handlePostNew = (): void => {
    selectedPostId = 0;
    fillPostForm(postForm, null);
    updatePostMarkdownPreview();
    setMessage(postErrorElement, '');
    setMessage(postSuccessElement, '');
    renderPostCollections();
  };

  const handlePostContentInput = (): void => {
    updatePostMarkdownPreview();
  };

  const handlePostSave = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();

    setMessage(postErrorElement, '');
    setMessage(postSuccessElement, '');

    try {
      const payload = readPostFormPayload(postForm);
      const idValue = Number((postForm.elements.namedItem('id') as HTMLInputElement).value || 0);

      if (idValue > 0) {
        await adminUpdatePost(token, idValue, payload);
        selectedPostId = idValue;
      } else {
        const created = await adminCreatePost(token, payload);
        selectedPostId = created.id;
      }

      await refreshData();
      setMessage(postSuccessElement, '文章已保存。');
    } catch (error) {
      setMessage(postErrorElement, error instanceof Error ? error.message : '保存失败', { error: true });
    }
  };

  const handlePostPublish = async (): Promise<void> => {
    if (!selectedPostId) {
      setMessage(postErrorElement, '请先选择一篇文章。', { error: true });
      return;
    }

    try {
      await adminPublishPost(token, selectedPostId);
      await refreshData();
      setMessage(postSuccessElement, '文章已发布。');
    } catch (error) {
      setMessage(postErrorElement, error instanceof Error ? error.message : '发布失败', { error: true });
    }
  };

  const handlePostUnpublish = async (): Promise<void> => {
    if (!selectedPostId) {
      setMessage(postErrorElement, '请先选择一篇文章。', { error: true });
      return;
    }

    try {
      await adminUnpublishPost(token, selectedPostId);
      await refreshData();
      setMessage(postSuccessElement, '文章已下线。');
    } catch (error) {
      setMessage(postErrorElement, error instanceof Error ? error.message : '下线失败', { error: true });
    }
  };

  const handlePostDelete = async (): Promise<void> => {
    if (!selectedPostId) {
      setMessage(postErrorElement, '请先选择一篇文章。', { error: true });
      return;
    }

    try {
      await adminDeletePost(token, selectedPostId);
      selectedPostId = 0;
      await refreshData();
      setMessage(postSuccessElement, '文章已删除。');
    } catch (error) {
      setMessage(postErrorElement, error instanceof Error ? error.message : '删除失败', { error: true });
    }
  };

  const handleCoverUpload = async (): Promise<void> => {
    const file = coverUploadInput.files?.[0];

    if (!file) {
      setMessage(postErrorElement, '请先选择要上传的图片。', { error: true });
      return;
    }

    try {
      const uploaded = await adminUploadImage(token, file);
      (postForm.elements.namedItem('coverImageUrl') as HTMLInputElement).value = uploaded.url;
      coverUploadInput.value = '';
      setMessage(postSuccessElement, '图片上传成功。');
    } catch (error) {
      setMessage(postErrorElement, error instanceof Error ? error.message : '上传失败', { error: true });
    }
  };

  const insertMarkdownAtCursor = (content: string): void => {
    const selectionStart = postContentTextarea.selectionStart ?? postContentTextarea.value.length;
    const selectionEnd = postContentTextarea.selectionEnd ?? postContentTextarea.value.length;

    postContentTextarea.setRangeText(content, selectionStart, selectionEnd, 'end');
    updatePostMarkdownPreview();
    postContentTextarea.focus();
  };

  const handleContentUpload = async (): Promise<void> => {
    const file = contentUploadInput.files?.[0];

    if (!file) {
      setMessage(postErrorElement, '请先选择要上传的图片。', { error: true });
      return;
    }

    try {
      const uploaded = await adminUploadImage(token, file);
      const imageAlt = file.name ? file.name.replace(/\.[^./\\]+$/, '') : 'image';
      insertMarkdownAtCursor(`\n![${imageAlt}](${uploaded.url})\n`);
      contentUploadInput.value = '';
      setMessage(postSuccessElement, '图片已插入正文。');
    } catch (error) {
      setMessage(postErrorElement, error instanceof Error ? error.message : '上传失败', { error: true });
    }
  };

  const handleFeaturedSave = async (event: Event): Promise<void> => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const saveButton = target.closest<HTMLButtonElement>('[data-role="admin-featured-save"]');

    if (!saveButton) {
      return;
    }

    const itemElement = saveButton.closest<HTMLElement>('.admin-featured-item');

    if (!itemElement) {
      return;
    }

    const postId = Number(itemElement.dataset.featuredId ?? 0);

    if (!postId) {
      return;
    }

    const enabledElement = itemElement.querySelector<HTMLInputElement>('[data-role="admin-featured-enabled"]');
    const orderElement = itemElement.querySelector<HTMLInputElement>('[data-role="admin-featured-order"]');

    try {
      await adminSetFeatured(
        token,
        postId,
        Boolean(enabledElement?.checked),
        orderElement?.value ? Number(orderElement.value) : undefined
      );
      await refreshData();
      setMessage(postSuccessElement, '精选状态已更新。');
    } catch (error) {
      setMessage(postErrorElement, error instanceof Error ? error.message : '更新精选失败', { error: true });
    }
  };

  const handleFriendFormSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();

    setMessage(friendErrorElement, '');

    try {
      const formData = new FormData(friendForm);
      const friendId = Number(formData.get('id') ?? 0);
      const payload = {
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? ''),
        avatar: String(formData.get('avatar') ?? ''),
        url: String(formData.get('url') ?? ''),
        displayOrder: Number(formData.get('displayOrder') ?? 0),
        enabled: Boolean(formData.get('enabled'))
      };

      if (friendId > 0) {
        await adminUpdateFriendLink(token, friendId, payload);
      } else {
        await adminCreateFriendLink(token, payload);
      }

      fillFriendForm(null);
      await refreshData();
    } catch (error) {
      setMessage(friendErrorElement, error instanceof Error ? error.message : '友链保存失败', { error: true });
    }
  };

  const handleFriendCancel = (): void => {
    setMessage(friendErrorElement, '');
    fillFriendForm(null);
  };

  const handleFriendListClick = async (event: Event): Promise<void> => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const editButton = target.closest<HTMLButtonElement>('[data-role="admin-friend-edit"]');
    if (editButton) {
      const friendId = Number(editButton.dataset.friendId ?? 0);

      if (!friendId) {
        return;
      }

      fillFriendForm(getFriendById(friendId));
      setMessage(friendErrorElement, '');
      return;
    }

    const deleteButton = target.closest<HTMLButtonElement>('[data-role="admin-friend-delete"]');
    if (!deleteButton) {
      return;
    }

    const friendId = Number(deleteButton.dataset.friendId ?? 0);

    if (!friendId) {
      return;
    }

    try {
      await adminDeleteFriendLink(token, friendId);

      if (selectedFriendId === friendId) {
        fillFriendForm(null);
      }

      await refreshData();
    } catch (error) {
      setMessage(friendErrorElement, error instanceof Error ? error.message : '删除友链失败', { error: true });
    }
  };

  const handleAboutSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();

    setMessage(aboutErrorElement, '');
    setMessage(aboutSuccessElement, '');

    try {
      const markdown = String(new FormData(aboutForm).get('markdown') ?? '');
      await adminUpdateAbout(token, markdown);
      setMessage(aboutSuccessElement, '关于页已保存。');
    } catch (error) {
      setMessage(aboutErrorElement, error instanceof Error ? error.message : '保存失败', { error: true });
    }
  };

  const handleProfileSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();

    setMessage(profileErrorElement, '');
    setMessage(profileSuccessElement, '');

    try {
      const formData = new FormData(profileForm);
      const contacts = parseContacts(String(formData.get('contacts') ?? ''));

      await adminUpdateProfileCard(token, {
        name: String(formData.get('name') ?? ''),
        bio: String(formData.get('bio') ?? ''),
        avatar: String(formData.get('avatar') ?? ''),
        contacts
      });

      setMessage(profileSuccessElement, '名片卡已保存。');
    } catch (error) {
      setMessage(profileErrorElement, error instanceof Error ? error.message : '保存失败', { error: true });
    }
  };

  logoutButton.addEventListener('click', handleLogout);
  postListElement.addEventListener('click', handlePostListClick);
  postNewButton.addEventListener('click', handlePostNew);
  postForm.addEventListener('submit', handlePostSave);
  postContentTextarea.addEventListener('input', handlePostContentInput);
  postPublishButton.addEventListener('click', handlePostPublish);
  postUnpublishButton.addEventListener('click', handlePostUnpublish);
  postDeleteButton.addEventListener('click', handlePostDelete);
  coverUploadButton.addEventListener('click', handleCoverUpload);
  contentUploadButton.addEventListener('click', handleContentUpload);
  featuredListElement.addEventListener('click', handleFeaturedSave);
  friendForm.addEventListener('submit', handleFriendFormSubmit);
  friendCancelButton.addEventListener('click', handleFriendCancel);
  friendListElement.addEventListener('click', handleFriendListClick);
  aboutForm.addEventListener('submit', handleAboutSubmit);
  profileForm.addEventListener('submit', handleProfileSubmit);

  for (const tabButton of tabButtons) {
    tabButton.addEventListener('click', handleTabClick);
  }

  return () => {
    logoutButton.removeEventListener('click', handleLogout);
    postListElement.removeEventListener('click', handlePostListClick);
    postNewButton.removeEventListener('click', handlePostNew);
    postForm.removeEventListener('submit', handlePostSave);
    postContentTextarea.removeEventListener('input', handlePostContentInput);
    postPublishButton.removeEventListener('click', handlePostPublish);
    postUnpublishButton.removeEventListener('click', handlePostUnpublish);
    postDeleteButton.removeEventListener('click', handlePostDelete);
    coverUploadButton.removeEventListener('click', handleCoverUpload);
    contentUploadButton.removeEventListener('click', handleContentUpload);
    featuredListElement.removeEventListener('click', handleFeaturedSave);
    friendForm.removeEventListener('submit', handleFriendFormSubmit);
    friendCancelButton.removeEventListener('click', handleFriendCancel);
    friendListElement.removeEventListener('click', handleFriendListClick);
    aboutForm.removeEventListener('submit', handleAboutSubmit);
    profileForm.removeEventListener('submit', handleProfileSubmit);

    for (const tabButton of tabButtons) {
      tabButton.removeEventListener('click', handleTabClick);
    }
  };
}
