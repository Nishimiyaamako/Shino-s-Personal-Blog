import {
  adminCreateFriendLink,
  adminDeleteFriendLink,
  adminListFriendLinks,
  adminUpdateFriendLink
} from '../../data/api';
import type { AdminFriendLink } from '../../types/api';
import { confirmAdminAction, renderFriendList, setMessage } from './shared';

type FriendImportField = 'name' | 'description' | 'avatar' | 'url';

const FRIEND_IMPORT_FIELDS: FriendImportField[] = ['name', 'description', 'avatar', 'url'];

const FRIEND_REQUIRED_FIELDS: Array<{ name: string; label: string }> = [
  { name: 'name', label: '名称' },
  { name: 'avatar', label: '头像链接' },
  { name: 'url', label: '跳转链接' }
];

function extractCodeBlockContent(rawSnippet: string): string {
  const normalized = rawSnippet.trim();
  const fencedBlock = normalized.match(/```[^\n]*\n([\s\S]*?)```/);
  return fencedBlock?.[1]?.trim() ?? normalized;
}

function isFriendImportField(value: string): value is FriendImportField {
  return FRIEND_IMPORT_FIELDS.some((field) => field === value);
}

function parseFriendImportValue(rawValue: string): string | null {
  const normalized = rawValue.trim().replace(/,\s*$/, '');
  const quote = normalized.at(0);

  if (!quote || (quote !== '\'' && quote !== '"') || normalized.at(-1) !== quote) {
    return null;
  }

  return normalized
    .slice(1, -1)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, '\'')
    .replace(/\\\\/g, '\\');
}

function parseFriendSnippet(rawSnippet: string): {
  parsed: Partial<Record<FriendImportField, string>>;
  skipped: string[];
} {
  const snippetBody = extractCodeBlockContent(rawSnippet)
    .replace(/;\s*$/, '')
    .trim()
    .replace(/,\s*$/, '')
    .trim();

  const unwrappedSnippet = snippetBody.startsWith('{') && snippetBody.endsWith('}')
    ? snippetBody.slice(1, -1).trim()
    : snippetBody;

  const parsed: Partial<Record<FriendImportField, string>> = {};
  const skipped: string[] = [];

  for (const rawLine of unwrappedSnippet.split(/\r?\n/)) {
    const normalizedLine = rawLine.trim();

    if (!normalizedLine || normalizedLine === '{' || normalizedLine === '}' || normalizedLine.startsWith('//')) {
      continue;
    }

    const cleanedLine = normalizedLine.replace(/,\s*$/, '');
    const separatorIndex = cleanedLine.indexOf(':');
    if (separatorIndex <= 0) {
      skipped.push(normalizedLine.slice(0, 40));
      continue;
    }

    const rawField = cleanedLine
      .slice(0, separatorIndex)
      .trim()
      .replace(/^['"`]/, '')
      .replace(/['"`]$/, '');
    if (!isFriendImportField(rawField)) {
      skipped.push(rawField);
      continue;
    }

    const parsedValue = parseFriendImportValue(cleanedLine.slice(separatorIndex + 1));
    if (parsedValue === null) {
      skipped.push(rawField);
      continue;
    }

    parsed[rawField] = parsedValue;
  }

  return { parsed, skipped };
}

interface AdminFriendsModuleOptions {
  rootElement: HTMLElement;
  token: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export interface AdminFriendsModule {
  refresh: () => Promise<void>;
  destroy: () => void;
}

export function setupAdminFriendsModule(options: AdminFriendsModuleOptions): AdminFriendsModule | null {
  const { rootElement, token, onDirtyChange } = options;

  const friendListElement = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-list"]');
  const friendSearchInput = rootElement.querySelector<HTMLInputElement>('[data-role="admin-friend-search"]');
  const friendForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-friend-form"]');
  const friendErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-error"]');
  const friendSuccessElement = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-success"]');
  const friendSubmitButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-friend-submit"]');
  const friendCancelButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-friend-cancel"]');
  const friendFormTitle = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-form-title"]');
  const friendFormMeta = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-form-meta"]');
  const friendImportInput = rootElement.querySelector<HTMLTextAreaElement>('[data-role="admin-friend-import-input"]');
  const friendImportParseButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-friend-parse"]');
  const friendImportBadge = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-import-badge"]');

  if (
    !friendListElement
    || !friendForm
    || !friendSubmitButton
    || !friendCancelButton
    || !friendFormTitle
    || !friendFormMeta
    || !friendImportInput
    || !friendImportParseButton
  ) {
    return null;
  }

  let friendLinks: AdminFriendLink[] = [];
  let selectedFriendId = 0;
  let busy = false;
  let formDirty = false;
  let importParsed = false;
  let searchQuery = '';
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  const syncImportBadge = (): void => {
    if (!friendImportBadge) {
      return;
    }
    friendImportBadge.hidden = !(friendImportInput.value.trim().length > 0 && !importParsed);
  };  const filterBySearch = (links: AdminFriendLink[]): AdminFriendLink[] => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (link) =>
        link.name.toLowerCase().includes(q) ||
        link.url.toLowerCase().includes(q) ||
        link.description.toLowerCase().includes(q)
    );
  };

  const setFormDirty = (nextDirty: boolean): void => {
    if (formDirty === nextDirty) {
      return;
    }

    formDirty = nextDirty;
    onDirtyChange?.(nextDirty);
  };

  const validateFriendForm = (): boolean => {
    let firstInvalidLabel = '';

    for (const field of FRIEND_REQUIRED_FIELDS) {
      const input = friendForm.elements.namedItem(field.name) as HTMLInputElement | null;
      if (!input) {
        continue;
      }
      const valid = input.value.trim().length > 0;
      input.classList.toggle('is-invalid', !valid);
      if (!valid && !firstInvalidLabel) {
        firstInvalidLabel = field.label;
        input.focus();
      }
    }

    if (firstInvalidLabel) {
      setMessage(friendErrorElement, `请填写「${firstInvalidLabel}」。`, { error: true });
      return false;
    }

    return true;
  };

  const confirmDiscardDraft = async (actionLabel: string): Promise<boolean> => {
    if (!formDirty) {
      return true;
    }

    const shouldContinue = await confirmAdminAction({
      title: '放弃未保存的修改？',
      message: '当前友链表单有未保存变更，确认丢弃并继续操作吗？'
    });
    if (!shouldContinue) {
      setMessage(friendErrorElement, `已取消${actionLabel}，当前编辑内容未变更。`, { error: true });
    }
    return shouldContinue;
  };

  const setBusy = (nextBusy: boolean): void => {
    busy = nextBusy;
    if (nextBusy) {
      friendSubmitButton.setAttribute('disabled', 'true');
      friendCancelButton.setAttribute('disabled', 'true');
      friendImportParseButton.setAttribute('disabled', 'true');
    } else {
      friendSubmitButton.removeAttribute('disabled');
      friendCancelButton.removeAttribute('disabled');
      friendImportParseButton.removeAttribute('disabled');
    }
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
      friendFormTitle.textContent = '新建友链';
      friendFormMeta.textContent = '填写后保存即可在前台展示。';
      friendImportInput.value = '';
      importParsed = false;
      syncImportBadge();
      selectedFriendId = 0;
      setFormDirty(false);
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
    friendFormTitle.textContent = `编辑友链：${friend.name}`;
    friendFormMeta.textContent = `当前地址：${friend.url}`;
    friendImportInput.value = '';
    importParsed = false;
    syncImportBadge();
    setFormDirty(false);
  };

  const renderFilteredList = (): void => {
    friendListElement.innerHTML = renderFriendList(filterBySearch(friendLinks));
  };

  const refresh = async (): Promise<void> => {
    friendLinks = await adminListFriendLinks(token);

    if (!selectedFriendId || !friendLinks.find((friend) => friend.id === selectedFriendId)) {
      selectedFriendId = 0;
    }

    renderFilteredList();
    fillFriendForm(getFriendById(selectedFriendId));
  };

  const handleFriendSearchInput = (): void => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = friendSearchInput?.value ?? '';
      renderFilteredList();
    }, 250);
  };

  const handleFriendFormSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    if (busy) {
      return;
    }

    if (!validateFriendForm()) {
      return;
    }

    setBusy(true);
    setMessage(friendErrorElement, '');
    setMessage(friendSuccessElement, '');

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
        selectedFriendId = friendId;
      } else {
        await adminCreateFriendLink(token, payload);
        selectedFriendId = 0;
      }

      await refresh();
      setMessage(friendSuccessElement, '友链已保存。');
    } catch (error) {
      setMessage(friendErrorElement, error instanceof Error ? error.message : '友链保存失败', { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleFriendCancel = async (): Promise<void> => {
    if (!(await confirmDiscardDraft('取消编辑'))) {
      return;
    }

    setMessage(friendErrorElement, '');
    setMessage(friendSuccessElement, '');
    fillFriendForm(null);
  };

  const handleFriendImportParse = (): void => {
    if (busy) {
      return;
    }

    setMessage(friendErrorElement, '');
    setMessage(friendSuccessElement, '');

    const { parsed, skipped } = parseFriendSnippet(friendImportInput.value);
    const parsedFields = FRIEND_IMPORT_FIELDS.filter((field) => Object.hasOwn(parsed, field));

    if (!parsedFields.length) {
      setMessage(friendErrorElement, '未识别到可用字段，请粘贴包含 name/description/avatar/url 的对象代码块。', { error: true });
      return;
    }

    if (parsed.name !== undefined) {
      (friendForm.elements.namedItem('name') as HTMLInputElement).value = parsed.name;
    }
    if (parsed.description !== undefined) {
      (friendForm.elements.namedItem('description') as HTMLTextAreaElement).value = parsed.description;
    }
    if (parsed.avatar !== undefined) {
      (friendForm.elements.namedItem('avatar') as HTMLInputElement).value = parsed.avatar;
    }
    if (parsed.url !== undefined) {
      (friendForm.elements.namedItem('url') as HTMLInputElement).value = parsed.url;
    }

    importParsed = true;
    syncImportBadge();
    setFormDirty(true);
    let statusMsg = `已填充 ${parsedFields.length} 个字段，请确认后保存。`;
    if (skipped.length > 0) {
      statusMsg += ` ${skipped.length} 个字段被跳过: ${skipped.join(', ')}`;
      setMessage(friendErrorElement, `${skipped.length} 个字段被跳过: ${skipped.join(', ')}`, { error: true });
    }
    setMessage(friendSuccessElement, statusMsg);
  };

  const handleFriendFormInput = (event: Event): void => {
    if (event.target === friendImportInput) {
      return;
    }

    if (event.target instanceof HTMLElement) {
      event.target.classList.remove('is-invalid');
    }

    setFormDirty(true);
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

      if (friendId !== selectedFriendId && !(await confirmDiscardDraft('切换友链'))) {
        return;
      }

      fillFriendForm(getFriendById(friendId));
      setMessage(friendErrorElement, '');
      setMessage(friendSuccessElement, '');
      return;
    }

    const deleteButton = target.closest<HTMLButtonElement>('[data-role="admin-friend-delete"]');
    if (!deleteButton || busy) {
      return;
    }

    const friendId = Number(deleteButton.dataset.friendId ?? 0);
    if (!friendId) {
      return;
    }

    if (friendId !== selectedFriendId && !(await confirmDiscardDraft('删除友链'))) {
      return;
    }

    const friendName = getFriendById(friendId)?.name ?? '该友链';
    const confirmed = await confirmAdminAction({
      title: '删除友链',
      message: `确定删除友链「${friendName}」吗？删除后前台将立即不可见。`,
      confirmText: '删除',
      danger: true
    });
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage(friendErrorElement, '');
    setMessage(friendSuccessElement, '');

    try {
      await adminDeleteFriendLink(token, friendId);

      if (selectedFriendId === friendId) {
        fillFriendForm(null);
      }

      await refresh();
      setMessage(friendSuccessElement, '友链已删除。');
    } catch (error) {
      setMessage(friendErrorElement, error instanceof Error ? error.message : '删除友链失败', { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleFriendImportInput = (): void => {
    importParsed = false;
    syncImportBadge();
  };

  friendForm.addEventListener('submit', handleFriendFormSubmit);
  friendForm.addEventListener('input', handleFriendFormInput);
  friendForm.addEventListener('change', handleFriendFormInput);
  friendImportParseButton.addEventListener('click', handleFriendImportParse);
  friendCancelButton.addEventListener('click', handleFriendCancel);
  friendListElement.addEventListener('click', handleFriendListClick);
  friendSearchInput?.addEventListener('input', handleFriendSearchInput);
  friendImportInput.addEventListener('input', handleFriendImportInput);
  fillFriendForm(null);

  return {
    refresh,
    destroy: () => {
      friendForm.removeEventListener('submit', handleFriendFormSubmit);
      friendForm.removeEventListener('input', handleFriendFormInput);
      friendForm.removeEventListener('change', handleFriendFormInput);
      friendImportParseButton.removeEventListener('click', handleFriendImportParse);
      friendCancelButton.removeEventListener('click', handleFriendCancel);
      friendListElement.removeEventListener('click', handleFriendListClick);
      friendSearchInput?.removeEventListener('input', handleFriendSearchInput);
      friendImportInput.removeEventListener('input', handleFriendImportInput);
      clearTimeout(searchTimer);
      setFormDirty(false);
    }
  };
}
