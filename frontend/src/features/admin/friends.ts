import {
  adminCreateFriendLink,
  adminDeleteFriendLink,
  adminListFriendLinks,
  adminUpdateFriendLink
} from '../../data/api';
import type { AdminFriendLink } from '../../types/api';
import { renderFriendList, setMessage } from './shared';

interface AdminFriendsModuleOptions {
  rootElement: HTMLElement;
  token: string;
}

export interface AdminFriendsModule {
  refresh: () => Promise<void>;
  destroy: () => void;
}

export function setupAdminFriendsModule(options: AdminFriendsModuleOptions): AdminFriendsModule | null {
  const { rootElement, token } = options;

  const friendListElement = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-list"]');
  const friendForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-friend-form"]');
  const friendErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-error"]');
  const friendSuccessElement = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-success"]');
  const friendSubmitButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-friend-submit"]');
  const friendCancelButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-friend-cancel"]');
  const friendFormTitle = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-form-title"]');
  const friendFormMeta = rootElement.querySelector<HTMLElement>('[data-role="admin-friend-form-meta"]');

  if (
    !friendListElement
    || !friendForm
    || !friendSubmitButton
    || !friendCancelButton
    || !friendFormTitle
    || !friendFormMeta
  ) {
    return null;
  }

  let friendLinks: AdminFriendLink[] = [];
  let selectedFriendId = 0;
  let busy = false;

  const setBusy = (nextBusy: boolean): void => {
    busy = nextBusy;
    if (nextBusy) {
      friendSubmitButton.setAttribute('disabled', 'true');
      friendCancelButton.setAttribute('disabled', 'true');
    } else {
      friendSubmitButton.removeAttribute('disabled');
      friendCancelButton.removeAttribute('disabled');
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
      friendFormMeta.textContent = '填写基础信息后即可保存。';
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
    friendFormTitle.textContent = `编辑友链：${friend.name}`;
    friendFormMeta.textContent = `当前链接：${friend.url}`;
  };

  const refresh = async (): Promise<void> => {
    friendLinks = await adminListFriendLinks(token);

    if (!selectedFriendId || !friendLinks.find((friend) => friend.id === selectedFriendId)) {
      selectedFriendId = 0;
    }

    friendListElement.innerHTML = renderFriendList(friendLinks);
    fillFriendForm(getFriendById(selectedFriendId));
  };

  const handleFriendFormSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    if (busy) {
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

  const handleFriendCancel = (): void => {
    setMessage(friendErrorElement, '');
    setMessage(friendSuccessElement, '');
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

    if (!window.confirm('确认删除该友链吗？')) {
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

  friendForm.addEventListener('submit', handleFriendFormSubmit);
  friendCancelButton.addEventListener('click', handleFriendCancel);
  friendListElement.addEventListener('click', handleFriendListClick);
  fillFriendForm(null);

  return {
    refresh,
    destroy: () => {
      friendForm.removeEventListener('submit', handleFriendFormSubmit);
      friendCancelButton.removeEventListener('click', handleFriendCancel);
      friendListElement.removeEventListener('click', handleFriendListClick);
    }
  };
}
