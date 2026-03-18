import './styles/global.css';

import { renderProfileCard } from './components/profile-card';
import { PRIMARY_NAV_LINKS, resolveRoute } from './router';

const SITE_TITLE = 'Shino';
const SITE_SUBTITLE = '';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('Missing #app mount element.');
}

const appElement = appRoot;

function renderApp(): void {
  const { route, context, isFallback } = resolveRoute(window.location.pathname);
  const pageTitle = isFallback ? `404 (${context.pathname})` : route.title;
  const hasProfileCard = shouldRenderProfileCard(route.path);
  const mainClassName = hasProfileCard ? 'site-main site-main--with-profile' : 'site-main';
  const pageContent = route.render(context);
  const mainLayout = hasProfileCard
    ? `<div class="site-main-layout">
        ${renderProfileCard()}
        <div class="site-page-content">${pageContent}</div>
      </div>`
    : `<div class="site-page-content">${pageContent}</div>`;

  document.title = `${pageTitle} | ${SITE_TITLE}`;

  appElement.innerHTML = `
<a class="skip-link" href="#main-content">跳到正文</a>
<div class="app-shell">
  <header class="site-header">
    <div class="site-header-inner">
      <a href="/" class="brand" data-link>
        <strong>${SITE_TITLE}</strong>
        <span>${SITE_SUBTITLE}</span>
      </a>
      <nav class="site-nav" aria-label="主导航">
        ${renderNavigation(context.pathname)}
      </nav>
    </div>
  </header>

  <main id="main-content" class="${mainClassName}" tabindex="-1">
    ${mainLayout}
  </main>

  <footer class="site-footer" style="text-align: center;">
    <p>© ${new Date().getFullYear()} ${SITE_TITLE}. Built with Vite + TypeScript.</p>
  </footer>
</div>
`;
}

function shouldRenderProfileCard(routePath: string): boolean {
  return routePath === '/' || routePath === '/posts' || routePath === '/posts/:slug';
}

function renderNavigation(pathname: string): string {
  return PRIMARY_NAV_LINKS.map(({ href, label }) => {
    const isActive = isNavActive(pathname, href);
    const activeClass = isActive ? 'is-active' : '';
    const current = isActive ? ' aria-current="page"' : '';
    return `<a href="${href}" data-link class="${activeClass}"${current}>${label}</a>`;
  }).join('');
}

function isNavActive(currentPath: string, navHref: string): boolean {
  if (navHref === '/') {
    return currentPath === '/';
  }

  return currentPath === navHref || currentPath.startsWith(`${navHref}/`);
}

function navigateTo(path: string, options: { replace?: boolean } = {}): void {
  const url = new URL(path, window.location.origin);
  const nextPathname = url.pathname;

  if (options.replace) {
    window.history.replaceState(null, '', nextPathname);
  } else if (window.location.pathname !== nextPathname) {
    window.history.pushState(null, '', nextPathname);
  }

  renderApp();
  window.scrollTo(0, 0);
}

function shouldHandleLinkClick(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  if (event.defaultPrevented) {
    return false;
  }

  if (event.button !== 0) {
    return false;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  if (anchor.target && anchor.target !== '_self') {
    return false;
  }

  if (anchor.hasAttribute('download')) {
    return false;
  }

  return anchor.origin === window.location.origin;
}

document.addEventListener('click', (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const anchor = target.closest('a[data-link]');

  if (!(anchor instanceof HTMLAnchorElement)) {
    return;
  }

  if (!shouldHandleLinkClick(event, anchor)) {
    return;
  }

  const href = anchor.getAttribute('href');

  if (!href) {
    return;
  }

  event.preventDefault();
  navigateTo(href);
});

window.addEventListener('popstate', () => {
  renderApp();
});

renderApp();
