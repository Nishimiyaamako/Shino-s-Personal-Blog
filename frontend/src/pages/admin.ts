import { ADMIN_MODULE_LINKS, resolveAdminModule } from '../router';
import type { PageRenderer } from '../types/router';

const MODULE_ICONS: Record<string, string> = {
  posts: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  featured: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  friends: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  about: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  profile: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
};

function renderSidebarNav(pathname: string): string {
  const activeModule = resolveAdminModule(pathname);

  return ADMIN_MODULE_LINKS
    .map((item) => {
      const isActive = activeModule === item.module;
      const icon = MODULE_ICONS[item.module] ?? '';
      return `<a href="${item.href}" data-link class="admin-nav-item${isActive ? ' is-active' : ''}"${isActive ? ' aria-current="page"' : ''}>
        <span class="admin-nav-icon">${icon}</span>
        <span class="admin-nav-label">${item.label}</span>
      </a>`;
    })
    .join('');
}

function renderPanelHidden(currentPathname: string, panel: string): string {
  const activeModule = resolveAdminModule(currentPathname);
  const isPostsWorkspace = panel === 'posts' && (activeModule === 'posts' || activeModule === 'featured');
  const isActive = activeModule === panel || isPostsWorkspace;
  return isActive ? '' : ' hidden';
}

function renderPostsWorkspace(pathname: string): string {
  const activeModule = resolveAdminModule(pathname);
  const isFeaturedMode = activeModule === 'featured';

  return `
  <div class="admin-posts-workspace${isFeaturedMode ? ' is-featured-focused' : ''}" data-role="admin-posts-workspace">
    <div class="admin-posts-primary${isFeaturedMode ? ' is-collapsed' : ''}" data-role="admin-posts-primary" ${isFeaturedMode ? 'hidden' : ''}>
      <div class="admin-split-layout">
        <aside class="admin-list-panel">
          <div class="admin-list-toolbar">
            <div class="admin-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" data-role="admin-post-search" placeholder="搜索文章..." />
            </div>
            <button type="button" class="admin-btn admin-btn-primary" data-role="admin-post-new">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              新建
            </button>
          </div>

          <form class="admin-filter-bar" data-role="admin-post-filter-form">
            <select name="status" data-role="admin-post-status-filter">
              <option value="all">全部状态</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </select>
            <input type="text" name="tag" data-role="admin-post-tag-filter" placeholder="标签筛选" />
            <select name="pageSize" data-role="admin-post-page-size">
              <option value="10">10 条</option>
              <option value="20" selected>20 条</option>
              <option value="50">50 条</option>
            </select>
            <button type="submit" class="admin-btn admin-btn-ghost" data-role="admin-post-filter-apply">筛选</button>
            <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-post-filter-reset">重置</button>
          </form>

          <ul class="admin-post-list" data-role="admin-post-list" aria-live="polite"></ul>

          <div class="admin-pagination" data-role="admin-post-pagination">
            <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-post-prev-page">上一页</button>
            <span data-role="admin-post-page-summary">第 1 页</span>
            <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-post-next-page">下一页</button>
          </div>
        </aside>

        <div class="admin-editor-panel">
          <form class="admin-post-form" data-role="admin-post-form">
            <input type="hidden" name="id" />

            <div class="admin-editor-head">
              <input type="text" name="title" class="admin-editor-title" placeholder="输入文章标题..." required />
              <p class="admin-editor-meta" data-role="admin-post-form-meta">新建文章 · 先保存草稿，再按需发布</p>
            </div>

            <details class="admin-meta-drawer">
              <summary>元信息设置</summary>
              <div class="admin-meta-grid">
                <label><span>Slug</span><input type="text" name="slug" placeholder="url-identifier" required /></label>
                <label><span>发布日期</span><input type="date" name="date" required /></label>
                <label><span>主题</span><input type="text" name="theme" placeholder="例如：DevOps" /></label>
                <label><span>标签</span><input type="text" name="tags" placeholder="typescript, web" required /></label>
                <label><span>封面地址</span><input type="text" name="coverImageUrl" placeholder="/uploads/images/xxx.webp" /></label>
                <label><span>发布状态</span>
                  <select name="status">
                    <option value="draft">草稿</option>
                    <option value="published">已发布</option>
                  </select>
                </label>
                <label class="admin-checkbox-label"><input type="checkbox" name="isFeatured" /> <span>设为首页精选</span></label>
                <label><span>精选排序</span><input type="number" name="featuredOrder" min="1" placeholder="1" /></label>
              </div>
            </details>

            <label class="admin-summary-field">
              <span>摘要</span>
              <textarea name="summary" rows="2" placeholder="文章摘要，会显示在列表和卡片中..." required></textarea>
            </label>

            <div class="admin-markdown-workspace">
              <div class="admin-markdown-editor">
                <label><span>Markdown 正文</span>
                  <textarea name="contentMarkdown" rows="16" required data-role="admin-post-content" placeholder="在此输入 Markdown 正文..."></textarea>
                </label>
              </div>
              <div class="admin-markdown-preview" aria-label="实时预览">
                <div class="admin-preview-header">预览</div>
                <article class="admin-markdown-preview-body markdown-content" data-role="admin-post-preview">
                  <p class="empty-hint">开始输入后，这里会同步显示预览。</p>
                </article>
              </div>
            </div>

            <div class="admin-upload-bar">
              <div class="admin-upload-group">
                <input type="file" name="coverFile" accept="image/*" data-role="admin-cover-upload" />
                <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-cover-upload-btn">上传封面</button>
              </div>
              <div class="admin-upload-group">
                <input type="file" name="contentFile" accept="image/*" data-role="admin-content-upload" />
                <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-content-upload-btn">插入图片</button>
              </div>
            </div>

            <div class="admin-editor-actions">
              <button type="submit" class="admin-btn admin-btn-primary" data-role="admin-post-save">保存草稿</button>
              <button type="button" class="admin-btn admin-btn-secondary" data-role="admin-post-publish">发布</button>
              <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-post-unpublish">下线</button>
              <button type="button" class="admin-btn admin-btn-danger" data-role="admin-post-delete">删除</button>
            </div>

            <p class="admin-form-error" data-role="admin-post-error" hidden></p>
            <p class="admin-form-success" data-role="admin-post-success" hidden></p>
          </form>
        </div>
      </div>
    </div>

    <div class="admin-featured-workspace${isFeaturedMode ? ' is-active' : ''}" data-role="admin-featured-panel" ${isFeaturedMode ? '' : 'hidden'}>
      <header class="admin-panel-header">
        <h2>首页精选管理</h2>
        <p>仅显示已发布文章。可批量开关精选并调整排序。</p>
      </header>
      <ul class="admin-featured-list" data-role="admin-featured-list" aria-live="polite"></ul>
      <p class="admin-form-error" data-role="admin-featured-error" hidden></p>
      <p class="admin-form-success" data-role="admin-featured-success" hidden></p>
    </div>
  </div>`;
}

export const renderAdminPage: PageRenderer = (context) => {
  const activeModule = resolveAdminModule(context.pathname);

  return `
<div class="admin-app" data-admin-module="${activeModule}">
  <aside class="admin-sidebar">
    <div class="admin-sidebar-brand">
      <span class="admin-brand-mark">🌸</span>
      <span class="admin-brand-name">ShinoLog</span>
    </div>
    <nav class="admin-sidebar-nav" aria-label="后台模块导航">
      ${renderSidebarNav(context.pathname)}
    </nav>
    <div class="admin-sidebar-footer">
      <span class="admin-user-label">管理员</span>
      <button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-role="admin-logout">退出</button>
    </div>
  </aside>

  <main class="admin-main">
    <header class="admin-topbar">
      <div class="admin-topbar-left">
        <h1 class="admin-page-title">${getPageTitle(activeModule)}</h1>
        <p class="admin-runtime-status" data-role="admin-runtime-status" aria-live="polite"></p>
      </div>
      <div class="admin-topbar-right">
        <button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-role="admin-runtime-retry" hidden>重试</button>
        <span class="admin-unsaved-badge" data-role="admin-unsaved-status" hidden>未保存</span>
      </div>
    </header>

    <div class="admin-content">
      <section class="admin-panel" data-role="admin-panel" data-panel="posts"${renderPanelHidden(context.pathname, 'posts')}>
        ${renderPostsWorkspace(context.pathname)}
      </section>

      <section class="admin-panel" data-role="admin-panel" data-panel="friends"${renderPanelHidden(context.pathname, 'friends')}>
        <div class="admin-split-layout">
          <aside class="admin-list-panel">
            <div class="admin-list-toolbar">
              <h2>友链列表</h2>
            </div>
            <ul class="admin-friend-list" data-role="admin-friend-list" aria-live="polite"></ul>
          </aside>
          <div class="admin-editor-panel">
            <form class="admin-friend-form" data-role="admin-friend-form">
              <div class="admin-editor-head">
                <h2 data-role="admin-friend-form-title">新建友链</h2>
                <p class="admin-editor-meta" data-role="admin-friend-form-meta">填写后保存即可在前台展示</p>
              </div>

              <details class="admin-meta-drawer">
                <summary>代码块导入</summary>
                <label>
                  <span>粘贴友链对象代码</span>
                  <textarea name="friendSnippet" rows="5" data-role="admin-friend-import-input" placeholder="name: 'ShinoLog',&#10;description: '...',&#10;avatar: '...',&#10;url: '...'"></textarea>
                </label>
                <p class="admin-import-hint">支持直接粘贴对象代码、可带/不带花括号，或粘贴 Markdown 代码块。解析后仅填充表单，不会自动保存。</p>
                <button type="button" class="admin-btn admin-btn-secondary" data-role="admin-friend-parse">解析并填充</button>
              </details>

              <input type="hidden" name="id" />
              <div class="admin-form-grid">
                <label><span>名称</span><input type="text" name="name" required /></label>
                <label><span>头像链接</span><input type="text" name="avatar" required /></label>
                <label><span>跳转链接</span><input type="text" name="url" required /></label>
                <label><span>排序值</span><input type="number" name="displayOrder" min="0" value="0" /></label>
              </div>
              <label><span>描述</span><textarea name="description" rows="2" required></textarea></label>
              <label class="admin-checkbox-label"><input type="checkbox" name="enabled" checked /> <span>前台可见</span></label>

              <div class="admin-editor-actions">
                <button type="submit" class="admin-btn admin-btn-primary" data-role="admin-friend-submit">保存友链</button>
                <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-friend-cancel" hidden>取消编辑</button>
              </div>
              <p class="admin-form-error" data-role="admin-friend-error" hidden></p>
              <p class="admin-form-success" data-role="admin-friend-success" hidden></p>
            </form>
          </div>
        </div>
      </section>

      <section class="admin-panel" data-role="admin-panel" data-panel="about"${renderPanelHidden(context.pathname, 'about')}>
        <header class="admin-panel-header">
          <h2>关于页内容</h2>
          <p>保存后前台会立即刷新显示。</p>
        </header>
        <form class="admin-about-form" data-role="admin-about-form">
          <label class="admin-markdown-full">
            <span>Markdown 内容</span>
            <textarea name="markdown" rows="24" required placeholder="在此输入关于页的 Markdown 内容..."></textarea>
          </label>
          <div class="admin-editor-actions">
            <button type="submit" class="admin-btn admin-btn-primary">保存关于页</button>
          </div>
          <p class="admin-form-error" data-role="admin-about-error" hidden></p>
          <p class="admin-form-success" data-role="admin-about-success" hidden></p>
        </form>
      </section>

      <section class="admin-panel" data-role="admin-panel" data-panel="profile"${renderPanelHidden(context.pathname, 'profile')}>
        <header class="admin-panel-header">
          <h2>名片卡设置</h2>
          <p>用于首页与文章页侧边栏展示。</p>
        </header>
        <form class="admin-profile-form" data-role="admin-profile-form">
          <div class="admin-form-grid">
            <label><span>昵称</span><input type="text" name="name" required /></label>
            <label><span>头像链接</span><input type="text" name="avatar" required /></label>
          </div>
          <label><span>简介</span><textarea name="bio" rows="2" required></textarea></label>
          <label>
            <span>联系方式（每行 1 条：平台|显示名|链接）</span>
            <textarea name="contacts" rows="8" placeholder="github|Shino|https://github.com/...
email|联系邮箱|mailto:me@example.com"></textarea>
          </label>
          <div class="admin-editor-actions">
            <button type="submit" class="admin-btn admin-btn-primary">保存名片卡</button>
          </div>
          <p class="admin-form-error" data-role="admin-profile-error" hidden></p>
          <p class="admin-form-success" data-role="admin-profile-success" hidden></p>
        </form>
      </section>
    </div>
  </main>
</div>
`;
};

function getPageTitle(module: string): string {
  switch (module) {
    case 'posts': return '文章管理';
    case 'featured': return '精选管理';
    case 'friends': return '友链管理';
    case 'about': return '关于页';
    case 'profile': return '名片卡';
    default: return '后台管理';
  }
}
