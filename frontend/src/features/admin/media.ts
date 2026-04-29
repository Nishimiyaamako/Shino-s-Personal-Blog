import { adminDeleteMedia, adminListMedia, adminUploadImage } from '../../data/api';
import type { AdminMediaAsset, AdminMediaListQuery, AdminMediaListResponse } from '../../types/api';
import { escapeHtml } from '../../utils/escape-html';

interface AdminMediaModuleOptions {
  rootElement: HTMLElement;
  token: string;
}

export interface AdminMediaModule {
  refresh: () => Promise<void>;
  destroy: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function setupAdminMediaModule(options: AdminMediaModuleOptions): AdminMediaModule | null {
  const { rootElement, token } = options;

  const statsElement = rootElement.querySelector<HTMLElement>('[data-role="admin-media-stats"]');
  const gridElement = rootElement.querySelector<HTMLElement>('[data-role="admin-media-grid"]');
  const errorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-media-error"]');
  const prevPageButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-media-prev-page"]');
  const nextPageButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-media-next-page"]');
  const pageSummaryElement = rootElement.querySelector<HTMLElement>('[data-role="admin-media-page-summary"]');
  const filterButtons = Array.from(
    rootElement.querySelectorAll<HTMLButtonElement>('[data-role="admin-media-filter-btn"]')
  );
  const sortSelect = rootElement.querySelector<HTMLSelectElement>('[data-role="admin-media-sort"]');
  const uploadBtn = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-media-upload-btn"]');
  const uploadInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-media-upload-input"]');
  const bulkDeleteBtn = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-media-bulk-delete"]');

  if (!statsElement || !gridElement || !prevPageButton || !nextPageButton || !pageSummaryElement) {
    return null;
  }

  let busy = false;
  let currentFilter: AdminMediaListQuery['filter'] = 'all';
  let currentPage = 1;
  let currentSort = 'created_at';
  let currentOrder: 'ASC' | 'DESC' = 'DESC';
  let lastResponse: AdminMediaListResponse | null = null;
  let selectedIds = new Set<number>();

  const setBusy = (v: boolean): void => {
    busy = v;
    const buttons = [prevPageButton, nextPageButton, ...filterButtons];
    if (uploadBtn) buttons.push(uploadBtn);
    if (bulkDeleteBtn) buttons.push(bulkDeleteBtn);
    for (const btn of buttons) {
      if (v) btn.setAttribute('disabled', 'true');
      else btn.removeAttribute('disabled');
    }
  };

  const syncActiveFilter = (): void => {
    for (const btn of filterButtons) {
      btn.classList.toggle('is-active', (btn.dataset.filter || 'all') === currentFilter);
    }
  };

  const updateBulkDeleteVisibility = (): void => {
    if (!bulkDeleteBtn) return;
    bulkDeleteBtn.textContent = `删除选中 (${selectedIds.size})`;
    bulkDeleteBtn.hidden = selectedIds.size === 0;
  };

  const renderStats = (): void => {
    if (!lastResponse) return;
    const { totalCount, totalSize, orphanedCount } = lastResponse.stats;
    statsElement.innerHTML = `
      <span class="admin-media-stat">共 <strong>${totalCount}</strong> 个文件</span>
      <span class="admin-media-stat">占用 <strong>${formatSize(totalSize)}</strong></span>
      ${orphanedCount > 0 ? `<span class="admin-media-stat admin-media-stat--warn">${orphanedCount} 个未引用</span>` : ''}
    `;
  };

  const renderGrid = (): void => {
    if (!lastResponse) return;

    const { items } = lastResponse;

    if (items.length === 0) {
      gridElement.innerHTML = '<p class="admin-media-empty">暂无图片。</p>';
      return;
    }

    gridElement.innerHTML = items
      .map((asset) => renderMediaCard(asset))
      .join('');
  };

  const renderPagination = (): void => {
    if (!lastResponse) {
      pageSummaryElement.textContent = '';
      prevPageButton.disabled = true;
      nextPageButton.disabled = true;
      return;
    }

    const { page, total, pageSize } = lastResponse;
    const totalPages = Math.ceil(total / pageSize) || 1;
    pageSummaryElement.textContent = `第 ${page} 页 / 共 ${totalPages} 页（${total} 项）`;
    prevPageButton.disabled = page <= 1;
    nextPageButton.disabled = page >= totalPages;
  };

  const renderMediaCard = (asset: AdminMediaAsset): string => {
    const refList =
      asset.references.length > 0
        ? asset.references
            .map((r) => `<a href="/admin/posts" data-link class="admin-media-ref-link">${escapeHtml(r.postTitle)}</a>`)
            .join(', ')
        : '';

    return `
      <div class="admin-media-card${asset.isOrphaned ? ' is-orphaned' : ''}">
        <label class="admin-media-card-select">
          <input type="checkbox" data-role="admin-media-select" data-media-id="${asset.id}" ${selectedIds.has(asset.id) ? 'checked' : ''} />
        </label>
        <div class="admin-media-card-preview">
          <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.fileName)}" loading="lazy" />
        </div>
        <div class="admin-media-card-info">
          <p class="admin-media-card-name" title="${escapeHtml(asset.fileName)}">${escapeHtml(asset.fileName)}</p>
          <p class="admin-media-card-meta">
            <span>${formatSize(asset.size)}</span>
            <span>${formatDate(asset.createdAt)}</span>
          </p>
          ${asset.isOrphaned
            ? '<span class="admin-media-badge admin-media-badge--orphan">未引用</span>'
            : `<span class="admin-media-badge admin-media-badge--ref" title="${escapeHtml(refList)}">已引用 (${asset.references.length})</span>`
          }
          ${asset.isOrphaned
            ? `<button type="button" class="admin-btn admin-btn-danger admin-btn-sm admin-media-delete-btn" data-media-id="${asset.id}" data-media-name="${escapeHtml(asset.fileName)}">删除</button>`
            : ''
          }
        </div>
      </div>`;
  };

  const refresh = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      lastResponse = await adminListMedia(token, {
        page: currentPage,
        pageSize: 20,
        sort: currentSort as AdminMediaListQuery['sort'],
        order: currentOrder === 'ASC' ? 'asc' : 'desc',
        filter: currentFilter
      });
      syncActiveFilter();
      renderStats();
      renderGrid();
      renderPagination();
    } catch (e) {
      if (errorElement) {
        errorElement.textContent = e instanceof Error ? e.message : '加载失败';
        errorElement.hidden = false;
      }
    } finally {
      setBusy(false);
    }
  };

  const handleFilterClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest<HTMLButtonElement>('[data-role="admin-media-filter-btn"]');
    if (!btn) return;
    const filter = (btn.dataset.filter || 'all') as AdminMediaListQuery['filter'];
    currentFilter = filter;
    currentPage = 1;
    refresh();
  };

  const handlePrevPage = (): void => {
    if (currentPage <= 1) return;
    currentPage--;
    refresh();
  };

  const handleNextPage = (): void => {
    if (!lastResponse) return;
    const totalPages = Math.ceil(lastResponse.total / lastResponse.pageSize) || 1;
    if (currentPage >= totalPages) return;
    currentPage++;
    refresh();
  };

  const handleDelete = async (event: Event): Promise<void> => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest<HTMLButtonElement>('.admin-media-delete-btn');
    if (!btn) return;
    const id = Number(btn.dataset.mediaId);
    if (!Number.isFinite(id)) return;
    const name = btn.dataset.mediaName || '该图片';

    if (!window.confirm(`确认删除 ${name}？\n此操作不可撤销。`)) return;

    try {
      await adminDeleteMedia(token, id);
      currentPage = 1;
      await refresh();
    } catch (e) {
      if (errorElement) {
        errorElement.textContent = e instanceof Error ? e.message : '删除失败';
        errorElement.hidden = false;
      }
    }
  };

  const handleSortChange = (): void => {
    if (!sortSelect) return;
    const [sort, order] = sortSelect.value.split('-');
    currentSort = sort;
    currentOrder = order === 'asc' ? 'ASC' : 'DESC';
    currentPage = 1;
    refresh();
  };

  const handleUploadClick = (): void => {
    uploadInput?.click();
  };

  const handleUploadInputChange = async (): Promise<void> => {
    const file = uploadInput?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (errorElement) {
        errorElement.textContent = '仅支持图片文件';
        errorElement.hidden = false;
      }
      return;
    }

    try {
      setBusy(true);
      await adminUploadImage(token, file);
      if (uploadInput) uploadInput.value = '';
      currentPage = 1;
      await refresh();
    } catch (e) {
      if (errorElement) {
        errorElement.textContent = e instanceof Error ? e.message : '上传失败';
        errorElement.hidden = false;
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSelectionChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.role !== 'admin-media-select') return;

    const id = Number(target.dataset.mediaId);
    if (target.checked) {
      selectedIds.add(id);
    } else {
      selectedIds.delete(id);
    }
    updateBulkDeleteVisibility();
  };

  const handleBulkDelete = async (): Promise<void> => {
    if (selectedIds.size === 0) return;

    if (!window.confirm(`确认删除选中的 ${selectedIds.size} 个文件？\n此操作不可撤销。`)) return;

    try {
      setBusy(true);

      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(ids.map((id) => adminDeleteMedia(token, id)));

      const failed = results.filter((r) => r.status === 'rejected').length;

      selectedIds.clear();
      updateBulkDeleteVisibility();
      currentPage = 1;
      await refresh();

      if (failed > 0 && errorElement) {
        errorElement.textContent = `${ids.length - failed} 个成功，${failed} 个失败`;
        errorElement.hidden = false;
      }
    } catch (e) {
      if (errorElement) {
        errorElement.textContent = e instanceof Error ? e.message : '批量删除失败';
        errorElement.hidden = false;
      }
    } finally {
      setBusy(false);
    }
  };

  const filterBar = rootElement.querySelector<HTMLElement>('.admin-media-toolbar');
  const paginationBar = rootElement.querySelector<HTMLElement>('[data-role="admin-media-pagination"]')?.parentElement;

  filterBar?.addEventListener('click', handleFilterClick);
  prevPageButton.addEventListener('click', handlePrevPage);
  nextPageButton.addEventListener('click', handleNextPage);
  gridElement.addEventListener('click', handleDelete);
  gridElement.addEventListener('change', handleSelectionChange);
  sortSelect?.addEventListener('change', handleSortChange);
  uploadBtn?.addEventListener('click', handleUploadClick);
  uploadInput?.addEventListener('change', handleUploadInputChange);
  bulkDeleteBtn?.addEventListener('click', handleBulkDelete);

  return {
    refresh,
    destroy: () => {
      filterBar?.removeEventListener('click', handleFilterClick);
      prevPageButton.removeEventListener('click', handlePrevPage);
      nextPageButton.removeEventListener('click', handleNextPage);
      gridElement.removeEventListener('click', handleDelete);
      gridElement.removeEventListener('change', handleSelectionChange);
      sortSelect?.removeEventListener('change', handleSortChange);
      uploadBtn?.removeEventListener('click', handleUploadClick);
      uploadInput?.removeEventListener('change', handleUploadInputChange);
      bulkDeleteBtn?.removeEventListener('click', handleBulkDelete);
    }
  };
}
