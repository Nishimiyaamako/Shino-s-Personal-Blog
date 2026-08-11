import {
  adminCreatePost,
  adminDeletePost,
  adminListPosts,
  adminPublishPost,
  adminUnpublishPost,
  adminUpdatePost,
  adminUploadImage
} from '../../data/api';
import type { AdminPost, AdminPostListQuery, AdminPostListResponse } from '../../types/api';
import {
  confirmAdminAction,
  fillPostForm,
  generateSlug,
  readPostFormPayload,
  renderAdminPostList,
  renderMarkdownPreviewHtml,
  setMessage
} from './shared';

interface AdminPostsModuleOptions {
  rootElement: HTMLElement;
  token: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export interface AdminPostsModule {
  refresh: () => Promise<void>;
  destroy: () => void;
}

interface PostFilters {
  q: string;
  status: 'all' | 'draft' | 'published';
  tag: string;
  page: number;
  pageSize: number;
}

export function setupAdminPostsModule(options: AdminPostsModuleOptions): AdminPostsModule | null {
  const { rootElement, token, onDirtyChange } = options;

  const postListElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-list"]');
  const postForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-post-form"]');
  const postNewButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-new"]');
  const postSaveButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-save"]');
  const postPublishButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-publish"]');
  const postUnpublishButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-unpublish"]');
  const postDeleteButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-delete"]');
  const postErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-error"]');
  const postSuccessElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-success"]');
  const postContentTextarea = rootElement.querySelector<HTMLTextAreaElement>('[data-role="admin-post-content"]');
  const postPreviewElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-preview"]');
  const postFormMetaElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-form-meta"]');
  const slugInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-post-slug"]');
  const slugOverrideInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-post-slug-override"]');
  const titleInput = rootElement.querySelector<HTMLInputElement>('input[name="title"]');
  const dateInput = rootElement.querySelector<HTMLInputElement>('input[name="date"]');
  const coverUploadInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-cover-upload"]');
  const coverUploadButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-cover-upload-btn"]');
  const contentUploadInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-content-upload"]');
  const contentUploadButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-content-upload-btn"]');

  const filterForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-post-filter-form"]');
  const searchInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-post-search"]');
  const statusSelect = rootElement.querySelector<HTMLSelectElement>('[data-role="admin-post-status-filter"]');
  const tagInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-post-tag-filter"]');
  const pageSizeSelect = rootElement.querySelector<HTMLSelectElement>('[data-role="admin-post-page-size"]');
  const applyFilterButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-filter-apply"]');
  const resetFilterButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-filter-reset"]');
  const prevPageButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-prev-page"]');
  const nextPageButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-post-next-page"]');
  const pageSummaryElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-page-summary"]');

  if (
    !postListElement
    || !postForm
    || !postNewButton
    || !postSaveButton
    || !postPublishButton
    || !postUnpublishButton
    || !postDeleteButton
    || !postContentTextarea
    || !postPreviewElement
    || !postFormMetaElement
    || !slugInput
    || !titleInput
    || !dateInput
    || !coverUploadInput
    || !coverUploadButton
    || !contentUploadInput
    || !contentUploadButton
    || !filterForm
    || !searchInput
    || !statusSelect
    || !tagInput
    || !pageSizeSelect
    || !resetFilterButton
    || !prevPageButton
    || !nextPageButton
    || !pageSummaryElement
  ) {
    return null;
  }

  let selectedPostId = 0;
  let posts: AdminPost[] = [];
  let busy = false;
  let postFormDirty = false;

  const filters: PostFilters = {
    q: '',
    status: 'all',
    tag: '',
    page: 1,
    pageSize: Number(pageSizeSelect.value) || 20
  };

  let lastListResponse: AdminPostListResponse = {
    items: [],
    total: 0,
    page: 1,
    pageSize: filters.pageSize
  };

  const syncFilterInputs = (): void => {
    searchInput.value = filters.q;
    statusSelect.value = filters.status;
    tagInput.value = filters.tag;
    pageSizeSelect.value = String(filters.pageSize);
  };

  const setPostFormDirty = (nextDirty: boolean): void => {
    if (postFormDirty === nextDirty) {
      return;
    }

    postFormDirty = nextDirty;
    onDirtyChange?.(nextDirty);
  };

  const confirmDiscardDraft = (): boolean => {
    if (!postFormDirty) {
      return true;
    }

    return window.confirm('当前文章有未保存变更，确认丢弃并继续操作吗？');
  };

  const guardBeforeCollectionRefresh = (actionLabel: string): boolean => {
    if (confirmDiscardDraft()) {
      return true;
    }

    setMessage(postErrorElement, `已取消${actionLabel}，当前编辑内容未变更。`, { error: true });
    return false;
  };

  const setBusy = (nextBusy: boolean, pendingButton: 'save' | 'publish' | null = null): void => {
    busy = nextBusy;
    const allActionButtons = [
      postNewButton,
      postSaveButton,
      postPublishButton,
      postUnpublishButton,
      postDeleteButton,
      coverUploadButton,
      contentUploadButton,
      applyFilterButton,
      resetFilterButton,
      prevPageButton,
      nextPageButton
    ];

    for (const button of allActionButtons) {
      if (!button) {
        continue;
      }
      if (nextBusy) {
        button.setAttribute('disabled', 'true');
      } else {
        button.removeAttribute('disabled');
      }
    }

    if (pendingButton === 'save') {
      postSaveButton.textContent = nextBusy ? '保存中…' : '保存草稿';
    }
    if (pendingButton === 'publish') {
      postPublishButton.textContent = nextBusy ? '发布中…' : '发布';
    }
  };

  const getSelectedPost = (): AdminPost | null => {
    return posts.find((post) => post.id === selectedPostId) ?? null;
  };

  const updatePostMarkdownPreview = (): void => {
    postPreviewElement.innerHTML = renderMarkdownPreviewHtml(postContentTextarea.value);
  };

  const updatePostFormHead = (): void => {
    const selectedPost = getSelectedPost();
    if (!selectedPost) {
      postFormMetaElement.textContent = '新建文章 · 先保存草稿，再按需发布';
      return;
    }

    const statusLabel = selectedPost.status === 'published' ? '已发布' : '草稿';
    postFormMetaElement.textContent = `Slug：${selectedPost.slug} · 状态：${statusLabel}`;
  };

  const renderPostCollections = (): void => {
    postListElement.innerHTML = renderAdminPostList(posts, selectedPostId);
  };

  const renderPagination = (): void => {
    const total = Math.max(0, lastListResponse.total);
    const page = Math.max(1, lastListResponse.page);
    const pageSize = Math.max(1, lastListResponse.pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    pageSummaryElement.textContent = `共 ${total} 篇 · 第 ${page} / ${totalPages} 页`;
    prevPageButton.disabled = page <= 1 || busy;
    nextPageButton.disabled = page >= totalPages || busy;
  };

  const syncPostFormBySelection = (): void => {
    fillPostForm(postForm, getSelectedPost());
    updatePostFormHead();
    updatePostMarkdownPreview();
    renderPostCollections();
    setPostFormDirty(false);
  };

  const refresh = async (): Promise<void> => {
    postListElement.innerHTML = '<li class="admin-state-hint">正在加载文章列表…</li>';

    const query: AdminPostListQuery = {
      q: filters.q || undefined,
      status: filters.status,
      tag: filters.tag || undefined,
      page: filters.page,
      pageSize: filters.pageSize
    };

    const postResponse = await adminListPosts(token, query);

    lastListResponse = postResponse;
    posts = postResponse.items;
    filters.page = postResponse.page;
    filters.pageSize = postResponse.pageSize;

    if (!selectedPostId || !posts.find((post) => post.id === selectedPostId)) {
      selectedPostId = posts[0]?.id ?? 0;
    }

    syncPostFormBySelection();
    renderPagination();
  };

  const setFormToNew = (): void => {
    selectedPostId = 0;
    fillPostForm(postForm, null);
    updatePostFormHead();
    updatePostMarkdownPreview();
    setPostFormDirty(false);
    setMessage(postErrorElement, '');
    setMessage(postSuccessElement, '');
    renderPostCollections();
    // Set default date to today
    if (dateInput) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    titleInput?.focus();
  };

  const handleTitleInput = (): void => {
    const title = titleInput.value.trim();
    if (title && !slugOverrideInput?.value.trim()) {
      slugInput.value = generateSlug(title);
      postFormMetaElement.textContent = `新建文章 · Slug 预览：${slugInput.value}`;
    } else if (!title) {
      postFormMetaElement.textContent = '新建文章 · Slug 将自动从标题生成';
    }
    setPostFormDirty(true);
  };

  const runPostAction = async (
    action: () => Promise<void>,
    successMessage: string,
    optionsForRefresh: { resetPage?: boolean; refreshAfter?: boolean } = {},
    pendingButton: 'save' | 'publish' | null = null
  ): Promise<void> => {
    if (busy) {
      return;
    }

    setBusy(true, pendingButton);
    setMessage(postErrorElement, '');
    setMessage(postSuccessElement, '');

    try {
      await action();
      if (optionsForRefresh.resetPage) {
        filters.page = 1;
      }
      if (optionsForRefresh.refreshAfter !== false) {
        await refresh();
      }
      setMessage(postSuccessElement, successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败';
      setMessage(postErrorElement, message, { error: true });
    } finally {
      setBusy(false);
      renderPagination();
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

    if (postId !== selectedPostId && !confirmDiscardDraft()) {
      setMessage(postErrorElement, '已取消切换文章，当前编辑内容未变更。', { error: true });
      return;
    }

    selectedPostId = postId;
    syncPostFormBySelection();
  };

  const handlePostContentInput = (): void => {
    setPostFormDirty(true);
    updatePostMarkdownPreview();
  };

  const handlePostFormInput = (): void => {
    setPostFormDirty(true);
  };

  const handlePostSave = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();

    await runPostAction(async () => {
      const payload = readPostFormPayload(postForm);
      const idValue = Number((postForm.elements.namedItem('id') as HTMLInputElement).value || 0);

      if (idValue > 0) {
        await adminUpdatePost(token, idValue, payload);
        selectedPostId = idValue;
      } else {
        const created = await adminCreatePost(token, payload);
        selectedPostId = created.id;
        filters.page = 1;
      }
    }, '文章已保存。', {}, 'save');
  };

  const handlePostPublish = async (): Promise<void> => {
    if (!selectedPostId) {
      setMessage(postErrorElement, '请先选择一篇文章。', { error: true });
      return;
    }

    await runPostAction(async () => {
      await adminPublishPost(token, selectedPostId);
    }, '文章已发布。', {}, 'publish');
  };

  const handlePostUnpublish = async (): Promise<void> => {
    if (!selectedPostId) {
      setMessage(postErrorElement, '请先选择一篇文章。', { error: true });
      return;
    }

    const selectedPost = getSelectedPost();
    const postTitle = selectedPost?.title ?? '';

    if (!postTitle) {
      setMessage(postErrorElement, '未找到当前文章标题，请刷新后重试。', { error: true });
      return;
    }

    const confirmed = await confirmAdminAction({
      title: '下线文章',
      message: `确定下线「${postTitle}」吗？下线后前台将不再显示该文章。`,
      confirmText: '下线',
      danger: true
    });
    if (!confirmed) {
      return;
    }

    await runPostAction(async () => {
      await adminUnpublishPost(token, selectedPostId);
    }, '文章已下线。');
  };

  const handlePostDelete = async (): Promise<void> => {
    if (!selectedPostId) {
      setMessage(postErrorElement, '请先选择一篇文章。', { error: true });
      return;
    }

    const selectedPost = getSelectedPost();
    const postTitle = selectedPost?.title ?? '';

    if (!postTitle) {
      setMessage(postErrorElement, '未找到当前文章标题，请刷新后重试。', { error: true });
      return;
    }

    const confirmed = await confirmAdminAction({
      title: '删除文章（不可恢复）',
      message: `确定删除「${postTitle}」吗？删除后将移除正文、状态和精选信息。`,
      confirmText: '删除',
      danger: true
    });
    if (!confirmed) {
      return;
    }

    await runPostAction(async () => {
      await adminDeletePost(token, selectedPostId);
      selectedPostId = 0;
    }, '文章已删除。', { resetPage: true });
  };

  const handleCoverUpload = async (): Promise<void> => {
    const file = coverUploadInput.files?.[0];
    if (!file) {
      setMessage(postErrorElement, '请先选择要上传的图片。', { error: true });
      return;
    }

    await runPostAction(async () => {
      const uploaded = await adminUploadImage(token, file);
      (postForm.elements.namedItem('coverImageUrl') as HTMLInputElement).value = uploaded.url;
      setPostFormDirty(true);
      coverUploadInput.value = '';
    }, '图片上传成功，记得保存文章。', { refreshAfter: false });
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

    await runPostAction(async () => {
      const uploaded = await adminUploadImage(token, file);
      const imageAlt = file.name ? file.name.replace(/\.[^./\\]+$/, '') : 'image';
      insertMarkdownAtCursor(`\n![${imageAlt}](${uploaded.url})\n`);
      setPostFormDirty(true);
      contentUploadInput.value = '';
    }, '图片已插入正文，记得保存文章。', { refreshAfter: false });
  };

  const showImageUploadIndicator = (visible: boolean): void => {
    const existing = document.querySelector<HTMLElement>('[data-role="admin-image-upload-indicator"]');
    if (visible && !existing && postContentTextarea?.parentElement) {
      const indicator = document.createElement('div');
      indicator.setAttribute('data-role', 'admin-image-upload-indicator');
      indicator.className = 'admin-upload-indicator';
      indicator.textContent = '正在上传图片…';
      postContentTextarea.parentElement.insertBefore(indicator, postContentTextarea.nextSibling);
    } else if (!visible && existing) {
      existing.remove();
    }
  };

  const handleContentPaste = (event: ClipboardEvent): void => {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (!file) {
          continue;
        }

        showImageUploadIndicator(true);
        runPostAction(async () => {
          const uploaded = await adminUploadImage(token, file);
          const imageAlt = file.name ? file.name.replace(/\.[^./\\]+$/, '') : 'image';
          insertMarkdownAtCursor(`\n![${imageAlt}](${uploaded.url})\n`);
          setPostFormDirty(true);
        }, '图片已粘贴并插入正文，记得保存文章。', { refreshAfter: false }).finally(() => {
          showImageUploadIndicator(false);
        });
        return;
      }
    }
  };

  const handleFilterSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();

    if (!guardBeforeCollectionRefresh('应用筛选')) {
      return;
    }

    filters.q = searchInput.value.trim();
    filters.status = statusSelect.value === 'draft' || statusSelect.value === 'published' ? statusSelect.value : 'all';
    filters.tag = tagInput.value.trim().toLowerCase();
    filters.pageSize = Number(pageSizeSelect.value) || 20;
    filters.page = 1;

    await runPostAction(async () => {
      return Promise.resolve();
    }, '筛选条件已应用。');
  };

  const handleFilterReset = async (): Promise<void> => {
    if (!guardBeforeCollectionRefresh('重置筛选')) {
      return;
    }

    filters.q = '';
    filters.status = 'all';
    filters.tag = '';
    filters.page = 1;
    filters.pageSize = 20;
    syncFilterInputs();

    await runPostAction(async () => {
      return Promise.resolve();
    }, '筛选条件已重置。');
  };

  const handlePrevPage = async (): Promise<void> => {
    if (filters.page <= 1) {
      return;
    }

    if (!guardBeforeCollectionRefresh('切换分页')) {
      return;
    }

    filters.page -= 1;
    await runPostAction(async () => Promise.resolve(), '');
  };

  const handleNextPage = async (): Promise<void> => {
    const totalPages = Math.max(1, Math.ceil(lastListResponse.total / Math.max(1, lastListResponse.pageSize)));
    if (filters.page >= totalPages) {
      return;
    }

    if (!guardBeforeCollectionRefresh('切换分页')) {
      return;
    }

    filters.page += 1;
    await runPostAction(async () => Promise.resolve(), '');
  };

  const handlePostNew = (): void => {
    if (!confirmDiscardDraft()) {
      setMessage(postErrorElement, '已取消新建，当前编辑内容未变更。', { error: true });
      return;
    }

    setFormToNew();
  };

  postListElement.addEventListener('click', handlePostListClick);
  postNewButton.addEventListener('click', handlePostNew);
  postForm.addEventListener('submit', handlePostSave);
  postForm.addEventListener('input', handlePostFormInput);
  postForm.addEventListener('change', handlePostFormInput);
  titleInput.addEventListener('input', handleTitleInput);
  postContentTextarea.addEventListener('input', handlePostContentInput);
  postPublishButton.addEventListener('click', handlePostPublish);
  postUnpublishButton.addEventListener('click', handlePostUnpublish);
  postDeleteButton.addEventListener('click', handlePostDelete);
  coverUploadButton.addEventListener('click', handleCoverUpload);
  contentUploadButton.addEventListener('click', handleContentUpload);
  postContentTextarea.addEventListener('paste', handleContentPaste);
  filterForm.addEventListener('submit', handleFilterSubmit);
  resetFilterButton.addEventListener('click', handleFilterReset);
  prevPageButton.addEventListener('click', handlePrevPage);
  nextPageButton.addEventListener('click', handleNextPage);

  syncFilterInputs();
  updatePostMarkdownPreview();
  renderPagination();

  return {
    refresh,
    destroy: () => {
      postListElement.removeEventListener('click', handlePostListClick);
      postNewButton.removeEventListener('click', handlePostNew);
      postForm.removeEventListener('submit', handlePostSave);
      postForm.removeEventListener('input', handlePostFormInput);
      postForm.removeEventListener('change', handlePostFormInput);
      titleInput.removeEventListener('input', handleTitleInput);
      postContentTextarea.removeEventListener('input', handlePostContentInput);
      postPublishButton.removeEventListener('click', handlePostPublish);
      postUnpublishButton.removeEventListener('click', handlePostUnpublish);
      postDeleteButton.removeEventListener('click', handlePostDelete);
      coverUploadButton.removeEventListener('click', handleCoverUpload);
      contentUploadButton.removeEventListener('click', handleContentUpload);
      filterForm.removeEventListener('submit', handleFilterSubmit);
      resetFilterButton.removeEventListener('click', handleFilterReset);
      prevPageButton.removeEventListener('click', handlePrevPage);
      nextPageButton.removeEventListener('click', handleNextPage);
      setPostFormDirty(false);
    }
  };
}
