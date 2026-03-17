import './styles/shell.onboard.css';
import { PRIMARY_NAV_LINKS, resolveRoute } from './router';
import { initializeDynamicTheme } from './theme/dynamic-theme';

/**
 * 前端 SPA（单页应用）入口文件
 *
 * 这个文件负责三件核心事情：
 * 1) 根据当前 URL 匹配路由并渲染页面
 * 2) 拦截站内链接点击，用 History API 实现无刷新跳转
 * 3) 监听浏览器前进/后退，保证页面与 URL 始终同步
 */

/**
 * 站点标题基础名。
 */
const SITE_TITLE = 'Shino\'s Blog';

/**
 * 找到页面挂载点：#app。
 * 所有页面 HTML 都会被塞进这个容器里。
 */
const appRoot = document.querySelector<HTMLDivElement>('#app');

// 如果 index.html 没有提供 #app，就直接报错，避免页面“无声失败”。
if (!appRoot) {
  throw new Error('Missing #app mount element.');
}

const appElement = appRoot;
const COPY_BUTTON_SELECTOR = 'button[data-copy-url]';
const COPY_FEEDBACK_DURATION_MS = 1500;
const copyButtonResetTimers = new WeakMap<HTMLButtonElement, number>();

/**
 * 根据当前地址渲染整页。
 *
 * 渲染内容包含两部分：
 * - 公共壳层：header + nav
 * - 当前路由页面：route.render(context)
 */
function renderApp(): void {
  // 用当前 pathname 做路由匹配，拿到页面渲染函数与参数。
  const { route, context, isFallback } = resolveRoute(window.location.pathname);

  // 未命中路由时（兜底 404）在标题里带上原路径，方便排查。
  const pageTitle = isFallback ? `404 (${context.pathname})` : route.title;

  // 当前路径（已被 router 标准化）用于判断导航高亮状态。
  const currentPath = context.pathname;

  // 同步浏览器标签页标题。
  document.title = `${SITE_TITLE} | ${pageTitle}`;

  // 404 调试链接也走统一的高亮样式规则。
  const debugLinkClass = `nav-link nav-link--debug${isNavLinkActive('/404', currentPath) ? ' nav-link--active' : ''}`;

  // 渲染应用外壳 + 当前页面内容。
  appElement.innerHTML = `
<div class="app-shell">
  <header class="app-header">
    <div class="shell-container header-row">
      <p class="brand">
        <strong class="brand-title">${SITE_TITLE}</strong>
        <span class="brand-divider" aria-hidden="true">·</span>
        <span class="brand-subtitle">Minimal Warm</span>
      </p>

      <nav class="top-nav" aria-label="主导航">
        ${renderNavigation(currentPath)}
        <a class="${debugLinkClass}" href="/404" data-link>/404</a>
      </nav>
    </div>
  </header>

  <div class="shell-content shell-container">
    ${route.render(context)}
  </div>
</div>
`;
}

/**
 * 渲染顶部导航链接。
 *
 * 导航数据来自 router 中的 PRIMARY_NAV_LINKS，
 * 会根据当前路径自动给“当前菜单项”添加 active 样式。
 *
 * @param currentPath 当前页面路径（如 /posts、/tags/typescript）
 * @returns 可直接插入模板的导航 HTML 字符串
 */
function renderNavigation(currentPath: string): string {
  return PRIMARY_NAV_LINKS.map(({ href, label }) => {
    const activeClass = isNavLinkActive(href, currentPath) ? ' nav-link--active' : '';
    return `<a class="nav-link${activeClass}" href="${href}" data-link>${label}</a>`;
  }).join('');
}

/**
 * 判断某个导航链接是否处于激活态。
 *
 * 规则：
 * - 首页（/）必须精确匹配
 * - 其他链接允许子路径匹配（例如 /posts 会匹配 /posts/hello-world）
 */
function isNavLinkActive(href: string, currentPath: string): boolean {
  if (href === '/') {
    return currentPath === '/';
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

/**
 * 进行一次站内导航。
 *
 * @param path 目标路径（如 /posts/hello-world）
 * @param options.replace 是否替换当前历史记录（默认 push）
 */
function navigateTo(path: string, options: { replace?: boolean } = {}): void {
  // 统一转成完整 URL，再拿 pathname，避免字符串拼接错误。
  const url = new URL(path, window.location.origin);
  const nextPathname = url.pathname;

  if (options.replace) {
    // replaceState：不新增历史记录，常用于“重定向”式跳转。
    window.history.replaceState(null, '', nextPathname);
  } else if (window.location.pathname !== nextPathname) {
    // pushState：新增一条历史记录，用户可通过后退键回到上一页。
    window.history.pushState(null, '', nextPathname);
  }

  // 地址更新后立即重渲染。
  renderApp();

  // 跳页后回到顶部，符合大多数内容站体验。
  window.scrollTo(0, 0);
}

/**
 * 判断一次点击是否应该交给 SPA 路由接管。
 *
 * 目标：只接管“普通左键点击的站内链接”，
 * 不破坏浏览器原生行为（新标签打开、下载、外链等）。
 */
function shouldHandleLinkClick(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  // 如果事件已经被别处处理过，就不再接管。
  if (event.defaultPrevented) {
    return false;
  }

  // 只处理鼠标左键。
  if (event.button !== 0) {
    return false;
  }

  // 按住组合键通常表示“用户想走浏览器原生行为”（如新标签打开）。
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  // target 不是当前窗口时（例如 _blank），不拦截。
  if (anchor.target && anchor.target !== '_self') {
    return false;
  }

  // download 链接保持原生下载行为。
  if (anchor.hasAttribute('download')) {
    return false;
  }

  // 只接管同源链接，外链交给浏览器正常跳转。
  return anchor.origin === window.location.origin;
}

type CopyButtonStatus = 'success' | 'failure';

function resetCopyButtonStatus(button: HTMLButtonElement): void {
  delete button.dataset.copyStatus;
}

function scheduleCopyButtonReset(button: HTMLButtonElement): void {
  const existingTimer = copyButtonResetTimers.get(button);

  if (existingTimer !== undefined) {
    window.clearTimeout(existingTimer);
  }

  const timerId = window.setTimeout(() => {
    resetCopyButtonStatus(button);
    copyButtonResetTimers.delete(button);
  }, COPY_FEEDBACK_DURATION_MS);

  copyButtonResetTimers.set(button, timerId);
}

function setCopyButtonStatus(button: HTMLButtonElement, status: CopyButtonStatus): void {
  button.dataset.copyStatus = status;
  scheduleCopyButtonReset(button);
}

function fallbackCopyText(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();

  const copied = document.execCommand('copy');
  textarea.remove();

  if (!copied) {
    throw new Error('Clipboard copy failed.');
  }
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return;
  }

  fallbackCopyText(text);
}

function handleCopyButtonClick(event: MouseEvent, target: Element): boolean {
  const copyButton = target.closest(COPY_BUTTON_SELECTOR);

  if (!(copyButton instanceof HTMLButtonElement)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();

  const copyUrl = copyButton.dataset.copyUrl;

  if (!copyUrl) {
    setCopyButtonStatus(copyButton, 'failure');
    return true;
  }

  void copyTextToClipboard(copyUrl)
    .then(() => {
      setCopyButtonStatus(copyButton, 'success');
    })
    .catch(() => {
      setCopyButtonStatus(copyButton, 'failure');
    });

  return true;
}

/**
 * 全局点击拦截：
 * click -> 判断是否可接管 -> preventDefault -> navigateTo -> renderApp
 */
document.addEventListener('click', (event) => {
  const target = event.target;

  // 非 Element（极少见）直接忽略。
  if (!(target instanceof Element)) {
    return;
  }

  // 友链复制按钮优先处理，避免触发其他点击逻辑。
  if (handleCopyButtonClick(event, target)) {
    return;
  }

  // 支持点击 <a> 内部子元素：用 closest 回溯到最近的 a[data-link]。
  const anchor = target.closest('a[data-link]');

  if (!(anchor instanceof HTMLAnchorElement)) {
    return;
  }

  if (!shouldHandleLinkClick(event, anchor)) {
    return;
  }

  const href = anchor.getAttribute('href');

  // 防御式判断：没有 href 时不处理。
  if (!href) {
    return;
  }

  // 阻止浏览器整页刷新跳转，改走 SPA 导航。
  event.preventDefault();
  navigateTo(href);
});

/**
 * 监听前进/后退按钮：
 * 浏览器历史变化时重新渲染当前路径对应页面。
 */
window.addEventListener('popstate', () => {
  renderApp();
});

// 应用启动时首屏渲染一次。
void initializeDynamicTheme()
  .catch(() => {
    // 主题初始化失败时静默降级，避免影响内容渲染。
  })
  .finally(() => {
    renderApp();
  });
