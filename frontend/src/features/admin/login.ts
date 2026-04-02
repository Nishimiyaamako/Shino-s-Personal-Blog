import { adminLogin, readAdminToken, writeAdminToken } from '../../data/api';
import { setMessage } from './shared';

export interface AdminFeatureOptions {
  onNavigate: (path: string) => void;
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
    const submitButton = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]');

    const formData = new FormData(loginForm);
    const username = String(formData.get('username') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    setMessage(errorElement, '');
    submitButton?.setAttribute('disabled', 'true');

    try {
      const response = await adminLogin(username, password);
      writeAdminToken(response.token);
      options.onNavigate('/admin');
    } catch (error) {
      setMessage(errorElement, error instanceof Error ? error.message : '登录失败', { error: true });
    } finally {
      submitButton?.removeAttribute('disabled');
    }
  };

  loginForm.addEventListener('submit', handleSubmit);

  return () => {
    loginForm.removeEventListener('submit', handleSubmit);
  };
}
