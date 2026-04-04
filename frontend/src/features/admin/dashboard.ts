import { clearAdminToken, readAdminToken } from '../../data/api';
import { resolveAdminModule, type AdminModuleRoute } from '../../router';
import { setupAdminContentSettingsModule, type AdminContentSettingsModule } from './content-settings';
import { setupAdminFriendsModule, type AdminFriendsModule } from './friends';
import type { AdminFeatureOptions } from './login';
import { setupAdminPostsModule, type AdminPostsModule } from './posts';

const POSTS_WORKSPACE_MODULES: ReadonlySet<AdminModuleRoute> = new Set(['posts', 'featured']);
type DirtyScope = 'posts-form' | 'friends-form' | 'about-form' | 'profile-form';

function getRuntimeStatusText(module: AdminModuleRoute): string {
  switch (module) {
    case 'posts':
      return '已进入文章管理。';
    case 'featured':
      return '已进入精选管理。';
    case 'friends':
      return '已进入友链管理。';
    case 'about':
      return '已进入关于页管理。';
    case 'profile':
      return '已进入名片卡管理。';
    default:
      return '后台已就绪。';
  }
}

export function setupAdminDashboard(options: AdminFeatureOptions): (() => void) | null {
  const rootElement = document.querySelector<HTMLElement>('.page-admin-dashboard');
  if (!rootElement) {
    return null;
  }

  const token = readAdminToken();
  if (!token) {
    const nextPath =
      options.currentPathname === '/admin'
        ? '/admin/posts'
        : `${options.currentPathname}${options.currentSearch}`;
    options.onNavigate(`/admin/login?next=${encodeURIComponent(nextPath)}`, { replace: true });
    return null;
  }

  if (options.currentPathname === '/admin') {
    options.onNavigate('/admin/posts', { replace: true });
    return null;
  }

  const logoutButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-logout"]');
  const runtimeStatusElement = rootElement.querySelector<HTMLElement>('[data-role="admin-runtime-status"]');
  const runtimeRetryButton = rootElement.querySelector<HTMLButtonElement>('[data-role="admin-runtime-retry"]');
  const unsavedStatusElement = rootElement.querySelector<HTMLElement>('[data-role="admin-unsaved-status"]');
  const tabPanels = Array.from(rootElement.querySelectorAll<HTMLElement>('[data-role="admin-panel"]'));

  if (!logoutButton || !runtimeStatusElement || !runtimeRetryButton || !tabPanels.length) {
    return null;
  }

  let postsModule: AdminPostsModule | null = null;
  let friendsModule: AdminFriendsModule | null = null;
  let contentSettingsModule: AdminContentSettingsModule | null = null;
  let refreshInFlight = false;
  let destroyed = false;
  const dirtyScopes = new Set<DirtyScope>();

  const setRuntimeStatus = (message: string, optionsForStatus: { error?: boolean; retry?: boolean } = {}): void => {
    runtimeStatusElement.textContent = message;
    runtimeStatusElement.classList.toggle('is-error', optionsForStatus.error === true);
    const shouldShowRetry = optionsForStatus.retry === true;
    runtimeRetryButton.hidden = !shouldShowRetry;
    runtimeRetryButton.disabled = !shouldShowRetry;
  };

  const syncDirtyState = (): void => {
    const hasDirty = dirtyScopes.size > 0;
    rootElement.dataset.adminDirty = hasDirty ? 'true' : 'false';

    if (!unsavedStatusElement) {
      return;
    }

    unsavedStatusElement.hidden = !hasDirty;
  };

  const setDirtyScope = (scope: DirtyScope, dirty: boolean): void => {
    if (dirty) {
      dirtyScopes.add(scope);
    } else {
      dirtyScopes.delete(scope);
    }

    syncDirtyState();
  };

  const resolveActivePanel = (module: AdminModuleRoute): string => {
    return POSTS_WORKSPACE_MODULES.has(module) ? 'posts' : module;
  };

  const activatePanelByModule = (module: AdminModuleRoute): HTMLElement | null => {
    const panelKey = resolveActivePanel(module);
    let activePanel: HTMLElement | null = null;

    for (const panel of tabPanels) {
      const isActive = panel.dataset.panel === panelKey;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
      panel.setAttribute('aria-busy', 'false');

      if (isActive) {
        activePanel = panel;
      }
    }

    return activePanel;
  };

  const setPanelLoading = (panel: HTMLElement | null, loading: boolean): void => {
    if (!panel) {
      return;
    }

    panel.classList.toggle('is-loading', loading);
    panel.setAttribute('aria-busy', loading ? 'true' : 'false');
  };

  const ensurePostsModule = (): AdminPostsModule => {
    if (!postsModule) {
      const created = setupAdminPostsModule({
        rootElement,
        token,
        onDirtyChange: (dirty) => {
          setDirtyScope('posts-form', dirty);
        }
      });
      if (!created) {
        throw new Error('文章模块初始化失败，请刷新后重试。');
      }
      postsModule = created;
    }

    return postsModule;
  };

  const ensureFriendsModule = (): AdminFriendsModule => {
    if (!friendsModule) {
      const created = setupAdminFriendsModule({
        rootElement,
        token,
        onDirtyChange: (dirty) => {
          setDirtyScope('friends-form', dirty);
        }
      });
      if (!created) {
        throw new Error('友链模块初始化失败，请刷新后重试。');
      }
      friendsModule = created;
    }

    return friendsModule;
  };

  const ensureContentSettingsModule = (): AdminContentSettingsModule => {
    if (!contentSettingsModule) {
      const created = setupAdminContentSettingsModule({
        rootElement,
        token,
        onDirtyChange: (scope, dirty) => {
          setDirtyScope(scope, dirty);
        }
      });
      if (!created) {
        throw new Error('内容设置模块初始化失败，请刷新后重试。');
      }
      contentSettingsModule = created;
    }

    return contentSettingsModule;
  };

  const refreshActiveModule = async (): Promise<void> => {
    if (refreshInFlight || destroyed) {
      return;
    }

    const activeModule = resolveAdminModule(options.currentPathname);
    const activePanel = activatePanelByModule(activeModule);
    refreshInFlight = true;

    setPanelLoading(activePanel, true);
    setRuntimeStatus('正在加载模块数据…', { retry: false });

    try {
      if (POSTS_WORKSPACE_MODULES.has(activeModule)) {
        await ensurePostsModule().refresh();
      } else if (activeModule === 'friends') {
        await ensureFriendsModule().refresh();
      } else {
        await ensureContentSettingsModule().refresh();
      }

      if (!destroyed) {
        setRuntimeStatus(getRuntimeStatusText(activeModule), { retry: false });
      }
    } catch (error) {
      if (destroyed) {
        return;
      }

      const message = error instanceof Error ? error.message : '模块加载失败，请稍后重试。';
      setRuntimeStatus(message, { error: true, retry: true });
    } finally {
      setPanelLoading(activePanel, false);
      refreshInFlight = false;
    }
  };

  void refreshActiveModule();

  const handleRetry = (): void => {
    void refreshActiveModule();
  };

  const handleLogout = (): void => {
    clearAdminToken();
    options.onNavigate('/admin/login', { replace: true });
  };

  syncDirtyState();
  logoutButton.addEventListener('click', handleLogout);
  runtimeRetryButton.addEventListener('click', handleRetry);

  return () => {
    destroyed = true;
    logoutButton.removeEventListener('click', handleLogout);
    runtimeRetryButton.removeEventListener('click', handleRetry);
    postsModule?.destroy();
    friendsModule?.destroy();
    contentSettingsModule?.destroy();
    dirtyScopes.clear();
    delete rootElement.dataset.adminDirty;
    if (unsavedStatusElement) {
      unsavedStatusElement.hidden = true;
    }
  };
}
