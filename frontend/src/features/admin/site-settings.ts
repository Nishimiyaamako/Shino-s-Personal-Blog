import { adminFetchSiteConfig, adminUpdateSiteConfig } from '../../data/api';
import { setMessage } from './shared';

interface AdminSiteSettingsModuleOptions {
  rootElement: HTMLElement;
  token: string;
  onDirtyChange?: (scope: 'settings-form', dirty: boolean) => void;
}

export interface AdminSiteSettingsModule {
  refresh: () => Promise<void>;
  destroy: () => void;
}

export function setupAdminSiteSettingsModule(
  options: AdminSiteSettingsModuleOptions
): AdminSiteSettingsModule | null {
  const { rootElement, token, onDirtyChange } = options;

  const settingsForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-settings-form"]');
  const errorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-settings-error"]');
  const successElement = rootElement.querySelector<HTMLElement>('[data-role="admin-settings-success"]');

  if (!settingsForm) {
    return null;
  }

  let busy = false;
  let formDirty = false;

  const setFormDirty = (nextDirty: boolean): void => {
    if (formDirty === nextDirty) {
      return;
    }

    formDirty = nextDirty;
    onDirtyChange?.('settings-form', nextDirty);
  };

  const setBusy = (nextBusy: boolean): void => {
    busy = nextBusy;
    const submitButton = settingsForm.querySelector<HTMLButtonElement>('button[type="submit"]');

    if (nextBusy) {
      submitButton?.setAttribute('disabled', 'true');
    } else {
      submitButton?.removeAttribute('disabled');
    }
  };

  const refresh = async (): Promise<void> => {
    const config = await adminFetchSiteConfig(token);

    (settingsForm.elements.namedItem('siteTitle') as HTMLInputElement).value = config.siteTitle;
    (settingsForm.elements.namedItem('siteSubtitle') as HTMLInputElement).value = config.siteSubtitle;
    (settingsForm.elements.namedItem('copyrightOwner') as HTMLInputElement).value = config.copyrightOwner;
    (settingsForm.elements.namedItem('poweredBy') as HTMLInputElement).value = config.poweredBy;
    (settingsForm.elements.namedItem('icpRecordText') as HTMLInputElement).value = config.icpRecordText;
    (settingsForm.elements.namedItem('icpRecordUrl') as HTMLInputElement).value = config.icpRecordUrl;
    (settingsForm.elements.namedItem('publicSecurityRecordText') as HTMLInputElement).value = config.publicSecurityRecordText;
    (settingsForm.elements.namedItem('publicSecurityRecordUrl') as HTMLInputElement).value = config.publicSecurityRecordUrl;
    (settingsForm.elements.namedItem('friendLinkTemplate') as HTMLTextAreaElement).value = config.friendLinkTemplate;
    setFormDirty(false);
  };

  const handleSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(errorElement, '');
    setMessage(successElement, '');

    try {
      const formData = new FormData(settingsForm);

      await adminUpdateSiteConfig(token, {
        siteTitle: String(formData.get('siteTitle') ?? ''),
        siteSubtitle: String(formData.get('siteSubtitle') ?? ''),
        copyrightOwner: String(formData.get('copyrightOwner') ?? ''),
        poweredBy: String(formData.get('poweredBy') ?? ''),
        icpRecordText: String(formData.get('icpRecordText') ?? ''),
        icpRecordUrl: String(formData.get('icpRecordUrl') ?? ''),
        publicSecurityRecordText: String(formData.get('publicSecurityRecordText') ?? ''),
        publicSecurityRecordUrl: String(formData.get('publicSecurityRecordUrl') ?? ''),
        friendLinkTemplate: String(formData.get('friendLinkTemplate') ?? '')
      });

      setMessage(successElement, '站点设置已保存并立即生效。');
      setFormDirty(false);
    } catch (error) {
      setMessage(errorElement, error instanceof Error ? error.message : '保存失败', { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleFormInput = (): void => {
    setFormDirty(true);
  };

  settingsForm.addEventListener('submit', handleSubmit);
  settingsForm.addEventListener('input', handleFormInput);
  settingsForm.addEventListener('change', handleFormInput);

  return {
    refresh,
    destroy: () => {
      settingsForm.removeEventListener('submit', handleSubmit);
      settingsForm.removeEventListener('input', handleFormInput);
      settingsForm.removeEventListener('change', handleFormInput);
      setFormDirty(false);
    }
  };
}
