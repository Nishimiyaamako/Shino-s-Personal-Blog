import {
  adminFetchAbout,
  adminFetchProfileCard,
  adminUpdateAbout,
  adminUpdateProfileCard
} from '../../data/api';
import { parseContacts, serializeContacts, setMessage } from './shared';

interface AdminContentSettingsModuleOptions {
  rootElement: HTMLElement;
  token: string;
  onDirtyChange?: (scope: 'about-form' | 'profile-form', dirty: boolean) => void;
}

export interface AdminContentSettingsModule {
  refresh: () => Promise<void>;
  destroy: () => void;
}

export function setupAdminContentSettingsModule(
  options: AdminContentSettingsModuleOptions
): AdminContentSettingsModule | null {
  const { rootElement, token, onDirtyChange } = options;

  const aboutForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-about-form"]');
  const aboutErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-about-error"]');
  const aboutSuccessElement = rootElement.querySelector<HTMLElement>('[data-role="admin-about-success"]');

  const profileForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-profile-form"]');
  const profileErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-profile-error"]');
  const profileSuccessElement = rootElement.querySelector<HTMLElement>('[data-role="admin-profile-success"]');

  if (!aboutForm || !profileForm) {
    return null;
  }

  let busy = false;
  let aboutFormDirty = false;
  let profileFormDirty = false;

  const setAboutFormDirty = (nextDirty: boolean): void => {
    if (aboutFormDirty === nextDirty) {
      return;
    }

    aboutFormDirty = nextDirty;
    onDirtyChange?.('about-form', nextDirty);
  };

  const setProfileFormDirty = (nextDirty: boolean): void => {
    if (profileFormDirty === nextDirty) {
      return;
    }

    profileFormDirty = nextDirty;
    onDirtyChange?.('profile-form', nextDirty);
  };

  const setBusy = (nextBusy: boolean): void => {
    busy = nextBusy;
    const aboutSubmitButton = aboutForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    const profileSubmitButton = profileForm.querySelector<HTMLButtonElement>('button[type="submit"]');

    if (nextBusy) {
      aboutSubmitButton?.setAttribute('disabled', 'true');
      profileSubmitButton?.setAttribute('disabled', 'true');
    } else {
      aboutSubmitButton?.removeAttribute('disabled');
      profileSubmitButton?.removeAttribute('disabled');
    }
  };

  const refresh = async (): Promise<void> => {
    const [aboutPayload, profilePayload] = await Promise.all([
      adminFetchAbout(token),
      adminFetchProfileCard(token)
    ]);

    (aboutForm.elements.namedItem('markdown') as HTMLTextAreaElement).value = aboutPayload.markdown;
    (profileForm.elements.namedItem('name') as HTMLInputElement).value = profilePayload.name;
    (profileForm.elements.namedItem('bio') as HTMLTextAreaElement).value = profilePayload.bio;
    (profileForm.elements.namedItem('avatar') as HTMLInputElement).value = profilePayload.avatar;
    (profileForm.elements.namedItem('contacts') as HTMLTextAreaElement).value = serializeContacts(profilePayload.contacts);
    setAboutFormDirty(false);
    setProfileFormDirty(false);
  };

  const handleAboutSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(aboutErrorElement, '');
    setMessage(aboutSuccessElement, '');

    try {
      const markdown = String(new FormData(aboutForm).get('markdown') ?? '');
      await adminUpdateAbout(token, markdown);
      setMessage(aboutSuccessElement, '关于页已保存并立即生效。');
      setAboutFormDirty(false);
    } catch (error) {
      setMessage(aboutErrorElement, error instanceof Error ? error.message : '保存失败', { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(profileErrorElement, '');
    setMessage(profileSuccessElement, '');

    try {
      const formData = new FormData(profileForm);
      const rawContacts = String(formData.get('contacts') ?? '');
      const nonEmptyLines = rawContacts
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const malformedLine = nonEmptyLines.find((line) => line.split('|').filter(Boolean).length < 2);
      if (malformedLine) {
        throw new Error(`联系方式格式不正确：${malformedLine}。请使用“平台|显示名|链接”。`);
      }

      const contacts = parseContacts(rawContacts);

      await adminUpdateProfileCard(token, {
        name: String(formData.get('name') ?? ''),
        bio: String(formData.get('bio') ?? ''),
        avatar: String(formData.get('avatar') ?? ''),
        contacts
      });

      setMessage(profileSuccessElement, '名片卡已保存并立即生效。');
      setProfileFormDirty(false);
    } catch (error) {
      setMessage(profileErrorElement, error instanceof Error ? error.message : '保存失败', { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleAboutFormInput = (): void => {
    setAboutFormDirty(true);
  };

  const handleProfileFormInput = (): void => {
    setProfileFormDirty(true);
  };

  aboutForm.addEventListener('submit', handleAboutSubmit);
  aboutForm.addEventListener('input', handleAboutFormInput);
  aboutForm.addEventListener('change', handleAboutFormInput);
  profileForm.addEventListener('submit', handleProfileSubmit);
  profileForm.addEventListener('input', handleProfileFormInput);
  profileForm.addEventListener('change', handleProfileFormInput);

  return {
    refresh,
    destroy: () => {
      aboutForm.removeEventListener('submit', handleAboutSubmit);
      aboutForm.removeEventListener('input', handleAboutFormInput);
      aboutForm.removeEventListener('change', handleAboutFormInput);
      profileForm.removeEventListener('submit', handleProfileSubmit);
      profileForm.removeEventListener('input', handleProfileFormInput);
      profileForm.removeEventListener('change', handleProfileFormInput);
      setAboutFormDirty(false);
      setProfileFormDirty(false);
    }
  };
}
