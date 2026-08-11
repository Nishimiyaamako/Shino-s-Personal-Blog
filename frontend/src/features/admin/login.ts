import { adminLogin, readAdminToken, writeAdminToken } from '../../data/api';
import { setMessage } from './shared';

export interface AdminFeatureOptions {
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
  currentPathname: string;
  currentSearch: string;
}

const ALLOWED_NEXT_PATHS = new Set([
  '/admin',
  '/admin/posts',
  '/admin/friends',
  '/admin/about',
  '/admin/profile',
  '/admin/settings'
]);

function resolveNextPath(pathname: string, search: string): string {
  const searchParams = new URLSearchParams(search);
  const next = searchParams.get('next')?.trim() ?? '';

  if (!next.startsWith('/')) {
    return '/admin/posts';
  }

  try {
    const resolved = new URL(next, window.location.origin);
    if (!ALLOWED_NEXT_PATHS.has(resolved.pathname)) {
      return '/admin/posts';
    }

    if (resolved.pathname === '/admin') {
      return '/admin/posts';
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return '/admin/posts';
  }
}

export function setupAdminLogin(options: AdminFeatureOptions): (() => void) | null {
  const loginForm = document.querySelector<HTMLFormElement>('[data-role="admin-login-form"]');

  if (!loginForm) {
    return null;
  }

  const errorElement = document.querySelector<HTMLElement>('[data-role="admin-login-error"]');
  const targetPath = resolveNextPath(options.currentPathname, options.currentSearch);

  if (readAdminToken()) {
    options.onNavigate(targetPath, { replace: true });
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
      options.onNavigate(targetPath, { replace: true });
    } catch (error) {
      const fallback = '登录失败，请检查账号或密码后重试。';
      setMessage(errorElement, error instanceof Error ? error.message : fallback, { error: true });
    } finally {
      submitButton?.removeAttribute('disabled');
    }
  };

  loginForm.addEventListener('submit', handleSubmit);

  return () => {
    loginForm.removeEventListener('submit', handleSubmit);
  };
}
