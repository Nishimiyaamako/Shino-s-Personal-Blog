import {
  adminCreatePost,
  adminDeletePost,
  adminListPosts,
  adminPublishPost,
  adminSetFeatured,
  adminUnpublishPost,
  adminUpdatePost,
  adminUploadImage
} from '../../data/api';
import type { AdminPost, AdminPostListQuery, AdminPostListResponse } from '../../types/api';
import {
  fillPostForm,
  readPostFormPayload,
  renderAdminPostList,
  renderFeaturedList,
  renderMarkdownPreviewHtml,
  setMessage
} from './shared';

interface AdminPostsModuleOptions {
  rootElement: HTMLElement;
  token: string;
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
  const { rootElement, token } = options;

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
  const postFormTitleElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-form-title"]');
  const postFormMetaElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-form-meta"]');
  const coverUploadInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-cover-upload"]');
  const coverUploadButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-cover-upload-btn"]');
  const contentUploadInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-content-upload"]');
  const contentUploadButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-content-upload-btn"]');
  const featuredListElement = rootElement.querySelector<HTMLElement>('[data-role="admin-featured-list"]');
  const featuredErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-featured-error"]');
  const featuredSuccessElement = rootElement.querySelector<HTMLElement>('[data-role="admin-featured-success"]');

  const filterForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-post-filter-form"]');
  const searchInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-post-search"]');
  const statusSelect = rootElement.querySelector<HTMLSelectElement>('[data-role="admin-post-status-filter"]');
  const tagInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-post-tag-filter"]');
  const pageSizeSelect = rootElement.querySelector<HTMLSelectElement>('[data-role="admin-post-page-size"]');
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
    || !postFormTitleElement
    || !postFormMetaElement
    || !coverUploadInput
    || !coverUploadButton
    || !contentUploadInput
    || !contentUploadButton
    || !featuredListElement
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
  let featuredSourcePosts: AdminPost[] = [];
  let busy = false;

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

  const setBusy = (nextBusy: boolean): void => {
    busy = nextBusy;
    const allActionButtons = [
      postNewButton,
      postSaveButton,
      postPublishButton,
      postUnpublishButton,
      postDeleteButton,
      coverUploadButton,
      contentUploadButton,
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
      postFormTitleElement.textContent = '新建文章';
      postFormMetaElement.textContent = '当前为新建模式，保存后可发布。';
      return;
    }

    postFormTitleElement.textContent = `编辑文章：${selectedPost.title}`;
    postFormMetaElement.textContent = `slug: ${selectedPost.slug} · 状态: ${selectedPost.status}`;
  };

  const renderPostCollections = (): void => {
    postListElement.innerHTML = renderAdminPostList(posts, selectedPostId);
    featuredListElement.innerHTML = renderFeaturedList(featuredSourcePosts);
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
  };

  const refresh = async (): Promise<void> => {
    const query: AdminPostListQuery = {
      q: filters.q || undefined,
      status: filters.status,
      tag: filters.tag || undefined,
      page: filters.page,
      pageSize: filters.pageSize
    };

    const [postResponse, featuredResponse] = await Promise.all([
      adminListPosts(token, query),
      adminListPosts(token, {
        status: 'published',
        page: 1,
        pageSize: 200
      })
    ]);

    lastListResponse = postResponse;
    posts = postResponse.items;
    featuredSourcePosts = featuredResponse.items;
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
    setMessage(postErrorElement, '');
    setMessage(postSuccessElement, '');
    renderPostCollections();
  };

  const runPostAction = async (
    action: () => Promise<void>,
    successMessage: string,
    optionsForRefresh: { resetPage?: boolean } = {}
  ): Promise<void> => {
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(postErrorElement, '');
    setMessage(postSuccessElement, '');

    try {
      await action();
      if (optionsForRefresh.resetPage) {
        filters.page = 1;
      }
      await refresh();
      setMessage(postSuccessElement, successMessage);
      setMessage(featuredSuccessElement, '');
      setMessage(featuredErrorElement, '');
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

    selectedPostId = postId;
    syncPostFormBySelection();
  };

  const handlePostContentInput = (): void => {
    updatePostMarkdownPreview();
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
    }, '文章已保存。');
  };

  const handlePostPublish = async (): Promise<void> => {
    if (!selectedPostId) {
      setMessage(postErrorElement, '请先选择一篇文章。', { error: true });
      return;
    }

    await runPostAction(async () => {
      await adminPublishPost(token, selectedPostId);
    }, '文章已发布。');
  };

  const handlePostUnpublish = async (): Promise<void> => {
    if (!selectedPostId) {
      setMessage(postErrorElement, '请先选择一篇文章。', { error: true });
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

    if (!window.confirm('确认删除这篇文章吗？该操作不可撤销。')) {
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
      coverUploadInput.value = '';
    }, '图片上传成功。');
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
      contentUploadInput.value = '';
    }, '图片已插入正文。');
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

    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(featuredErrorElement, '');
    setMessage(featuredSuccessElement, '');

    try {
      await adminSetFeatured(
        token,
        postId,
        Boolean(enabledElement?.checked),
        orderElement?.value ? Number(orderElement.value) : undefined
      );
      await refresh();
      setMessage(featuredSuccessElement, '精选状态已更新。');
    } catch (error) {
      setMessage(featuredErrorElement, error instanceof Error ? error.message : '更新精选失败', { error: true });
    } finally {
      setBusy(false);
      renderPagination();
    }
  };

  const handleFilterSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
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

    filters.page -= 1;
    await runPostAction(async () => Promise.resolve(), '');
  };

  const handleNextPage = async (): Promise<void> => {
    const totalPages = Math.max(1, Math.ceil(lastListResponse.total / Math.max(1, lastListResponse.pageSize)));
    if (filters.page >= totalPages) {
      return;
    }

    filters.page += 1;
    await runPostAction(async () => Promise.resolve(), '');
  };

  const handlePostNew = (): void => {
    setFormToNew();
  };

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
      postContentTextarea.removeEventListener('input', handlePostContentInput);
      postPublishButton.removeEventListener('click', handlePostPublish);
      postUnpublishButton.removeEventListener('click', handlePostUnpublish);
      postDeleteButton.removeEventListener('click', handlePostDelete);
      coverUploadButton.removeEventListener('click', handleCoverUpload);
      contentUploadButton.removeEventListener('click', handleContentUpload);
      featuredListElement.removeEventListener('click', handleFeaturedSave);
      filterForm.removeEventListener('submit', handleFilterSubmit);
      resetFilterButton.removeEventListener('click', handleFilterReset);
      prevPageButton.removeEventListener('click', handlePrevPage);
      nextPageButton.removeEventListener('click', handleNextPage);
    }
  };
}
