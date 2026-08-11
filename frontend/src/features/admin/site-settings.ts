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

const REQUIRED_SETTINGS_FIELDS: Array<{ name: string; label: string }> = [
  { name: 'siteTitle', label: '站点标题（Logo 文字）' },
  { name: 'copyrightOwner', label: '版权所有者' },
  { name: 'friendLinkTemplate', label: '友链模板' }
];

const SUCCESS_AUTO_HIDE_MS = 4000;

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
  let successTimer: ReturnType<typeof setTimeout> | undefined;

  const setFormDirty = (nextDirty: boolean): void => {
    if (formDirty === nextDirty) {
      return;
    }

    formDirty = nextDirty;
    onDirtyChange?.('settings-form', nextDirty);
  };

  const validateSettingsForm = (): boolean => {
    let firstInvalidLabel = '';

    for (const field of REQUIRED_SETTINGS_FIELDS) {
      const input = settingsForm.elements.namedItem(field.name) as HTMLInputElement | HTMLTextAreaElement | null;
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
      setMessage(errorElement, `请填写「${firstInvalidLabel}」。`, { error: true });
      return false;
    }

    return true;
  };

  const flashSuccess = (message: string): void => {
    setMessage(successElement, message);
    clearTimeout(successTimer);
    successTimer = setTimeout(() => {
      setMessage(successElement, '');
    }, SUCCESS_AUTO_HIDE_MS);
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
    (settingsForm.elements.namedItem('slogan') as HTMLInputElement).value = config.slogan ?? '';
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

    if (!validateSettingsForm()) {
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
        slogan: String(formData.get('slogan') ?? ''),
        copyrightOwner: String(formData.get('copyrightOwner') ?? ''),
        poweredBy: String(formData.get('poweredBy') ?? ''),
        icpRecordText: String(formData.get('icpRecordText') ?? ''),
        icpRecordUrl: String(formData.get('icpRecordUrl') ?? ''),
        publicSecurityRecordText: String(formData.get('publicSecurityRecordText') ?? ''),
        publicSecurityRecordUrl: String(formData.get('publicSecurityRecordUrl') ?? ''),
        friendLinkTemplate: String(formData.get('friendLinkTemplate') ?? '')
      });

      flashSuccess('站点设置已保存并立即生效。');
      setFormDirty(false);
    } catch (error) {
      setMessage(errorElement, error instanceof Error ? error.message : '保存失败', { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleFormInput = (event: Event): void => {
    if (event.target instanceof HTMLElement) {
      event.target.classList.remove('is-invalid');
    }
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
      clearTimeout(successTimer);
      setFormDirty(false);
    }
  };
}
