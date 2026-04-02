import { clearAdminToken, readAdminToken } from '../../data/api';
import { setupAdminContentSettingsModule } from './content-settings';
import { setupAdminFriendsModule } from './friends';
import type { AdminFeatureOptions } from './login';
import { setupAdminPostsModule } from './posts';
import { setMessage } from './shared';

export function setupAdminDashboard(options: AdminFeatureOptions): (() => void) | null {
  const rootElement = document.querySelector<HTMLElement>('.page-admin-dashboard');
  if (!rootElement) {
    return null;
  }

  const token = readAdminToken();
  if (!token) {
    options.onNavigate('/admin/login');
    return null;
  }

  const logoutButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-logout"]');
  const tabButtons = Array.from(rootElement.querySelectorAll<HTMLButtonElement>('[data-role="admin-tab"]'));
  const tabPanels = Array.from(rootElement.querySelectorAll<HTMLElement>('[data-role="admin-panel"]'));

  if (!logoutButton || !tabButtons.length || !tabPanels.length) {
    return null;
  }

  const postsModule = setupAdminPostsModule({ rootElement, token });
  const friendsModule = setupAdminFriendsModule({ rootElement, token });
  const contentSettingsModule = setupAdminContentSettingsModule({ rootElement, token });

  if (!postsModule || !friendsModule || !contentSettingsModule) {
    return null;
  }

  const postErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-post-error"]');

  const refreshAll = async (): Promise<void> => {
    await Promise.all([
      postsModule.refresh(),
      friendsModule.refresh(),
      contentSettingsModule.refresh()
    ]);
  };

  void refreshAll().catch((error) => {
    setMessage(postErrorElement, error instanceof Error ? error.message : '后台加载失败', { error: true });
  });

  const handleLogout = (): void => {
    clearAdminToken();
    options.onNavigate('/admin/login');
  };

  const handleTabClick = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const tab = target.dataset.tab ?? '';

    for (const button of tabButtons) {
      button.classList.toggle('is-active', button === target);
    }

    for (const panel of tabPanels) {
      const isActive = panel.dataset.panel === tab;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    }
  };

  logoutButton.addEventListener('click', handleLogout);
  for (const tabButton of tabButtons) {
    tabButton.addEventListener('click', handleTabClick);
  }

  return () => {
    logoutButton.removeEventListener('click', handleLogout);
    for (const tabButton of tabButtons) {
      tabButton.removeEventListener('click', handleTabClick);
    }

    postsModule.destroy();
    friendsModule.destroy();
    contentSettingsModule.destroy();
  };
}
