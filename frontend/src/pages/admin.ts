import { ADMIN_MODULE_LINKS, resolveAdminModule } from '../router';
import type { PageRenderer } from '../types/router';

const MODULE_ICONS: Record<string, string> = {
  posts: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  friends: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  about: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  profile: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  settings: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  media: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
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
  const isActive = activeModule === panel;
  return isActive ? '' : ' hidden';
}

function renderPostsWorkspace(pathname: string): string {
  return `
  <div class="admin-posts-workspace" data-role="admin-posts-workspace">
    <div class="admin-posts-primary" data-role="admin-posts-primary">
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
            <input type="hidden" name="slug" data-role="admin-post-slug" />

            <div class="admin-editor-head">
              <input type="text" name="title" class="admin-editor-title" placeholder="输入文章标题..." required />
              <p class="admin-editor-meta" data-role="admin-post-form-meta">新建文章 · Slug 将自动从标题生成</p>
            </div>

            <div class="admin-markdown-workspace">
              <div class="admin-markdown-editor">
                <label><span>Markdown 正文</span>
                  <textarea name="contentMarkdown" rows="18" required data-role="admin-post-content" placeholder="从 Obsidian 粘贴 Markdown 正文..."></textarea>
                </label>
              </div>
              <div class="admin-markdown-preview" aria-label="实时预览">
                <div class="admin-preview-header">预览</div>
                <article class="admin-markdown-preview-body markdown-content" data-role="admin-post-preview">
                  <p class="empty-hint">开始输入后，这里会同步显示预览。</p>
                </article>
              </div>
            </div>

            <div class="admin-quick-meta">
              <label><span>主题</span><input type="text" name="theme" placeholder="例如：DevOps" /></label>
              <label><span>标签</span><input type="text" name="tags" placeholder="typescript, web" required /></label>
              <label><span>发布日期</span><input type="date" name="date" required /></label>
              <label><span>封面地址</span><input type="text" name="coverImageUrl" placeholder="/uploads/images/xxx.webp" /></label>
            </div>

            <label class="admin-summary-field">
              <span>摘要</span>
              <textarea name="summary" rows="2" placeholder="文章摘要，会显示在列表和卡片中..." required></textarea>
            </label>

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

            <details class="admin-meta-drawer">
              <summary>高级设置</summary>
              <div class="admin-meta-grid">
                <label><span>Slug</span><input type="text" name="slugManual" data-role="admin-post-slug-override" placeholder="留空则自动生成" /></label>
                <label><span>发布状态</span>
                  <select name="status">
                    <option value="draft">草稿</option>
                    <option value="published">已发布</option>
                  </select>
                </label>
              </div>
            </details>

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
              <input type="search" class="form-input" data-role="admin-friend-search" placeholder="搜索友链…" style="margin-top:6px;width:100%;" />
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
          <fieldset class="admin-about-fieldset">
            <legend>Hero 区域</legend>
            <div class="admin-form-grid">
              <label><span>标题</span><input type="text" name="heroTitle" required placeholder="关于" /></label>
              <label><span>副标题</span><input type="text" name="heroSubtitle" placeholder="例如：Welcome to my blog" /></label>
            </div>
          </fieldset>

          <fieldset class="admin-about-fieldset">
            <legend>开场说明</legend>
            <div data-role="admin-about-intro-list"><!-- dynamic --></div>
            <button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-role="admin-about-add-intro">添加段落</button>
          </fieldset>

          <fieldset class="admin-about-fieldset">
            <legend>左右叙事区</legend>
            <div data-role="admin-about-narrative-list"><!-- dynamic --></div>
            <button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-role="admin-about-add-narrative">添加叙事区</button>
          </fieldset>

          <fieldset class="admin-about-fieldset">
            <legend>事件时间线</legend>
            <label><span>时间线标题</span><input type="text" name="timelineTitle" placeholder="例如：事件表" /></label>
            <div data-role="admin-about-timeline-list" style="margin-top:0.75rem"><!-- dynamic --></div>
            <button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-role="admin-about-add-timeline">添加事件</button>
          </fieldset>

          <div class="admin-editor-actions">
            <button type="submit" class="admin-btn admin-btn-primary">保存关于页</button>
          </div>
          <p class="admin-form-error" data-role="admin-about-error" hidden></p>
          <p class="admin-form-success" data-role="admin-about-success" hidden></p>
        </form>
      </section>

      <section class="admin-panel" data-role="admin-panel" data-panel="settings"${renderPanelHidden(context.pathname, 'settings')}>
        <header class="admin-panel-header">
          <h2>站点设置</h2>
          <p>修改顶栏标题、页脚备案号、友链模板等全局信息。</p>
        </header>
        <form class="admin-settings-form" data-role="admin-settings-form">
          <fieldset>
            <legend>顶栏</legend>
            <div class="admin-form-grid">
              <label><span>站点标题（Logo 文字）</span><input type="text" name="siteTitle" required /></label>
              <label><span>副标题</span><input type="text" name="siteSubtitle" placeholder="留空则不显示" /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>页脚</legend>
            <div class="admin-form-grid">
              <label><span>版权所有者</span><input type="text" name="copyrightOwner" required /></label>
              <label><span>Powered by 文案</span><input type="text" name="poweredBy" /></label>
            </div>
            <div class="admin-form-grid">
              <label><span>ICP 备案文案</span><input type="text" name="icpRecordText" placeholder="蜀ICP备xxxx号" /></label>
              <label><span>ICP 备案链接</span><input type="text" name="icpRecordUrl" placeholder="https://beian.miit.gov.cn/" /></label>
            </div>
            <div class="admin-form-grid">
              <label><span>公安备案文案</span><input type="text" name="publicSecurityRecordText" placeholder="川公网安备xxxx号" /></label>
              <label><span>公安备案链接</span><input type="text" name="publicSecurityRecordUrl" placeholder="https://beian.mps.gov.cn/..." /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>友链模板</legend>
            <label>
              <span>"添加我" 模板（访客复制后用于交换友链）</span>
              <textarea name="friendLinkTemplate" rows="6" required></textarea>
            </label>
          </fieldset>
          <div class="admin-editor-actions">
            <button type="submit" class="admin-btn admin-btn-primary">保存站点设置</button>
          </div>
          <p class="admin-form-error" data-role="admin-settings-error" hidden></p>
          <p class="admin-form-success" data-role="admin-settings-success" hidden></p>
        </form>
      </section>

      <section class="admin-panel" data-role="admin-panel" data-panel="media"${renderPanelHidden(context.pathname, 'media')}>
        <header class="admin-panel-header">
          <h2>媒体管理</h2>
          <p>管理上传的图片，查看存储使用情况与引用关系。</p>
        </header>
        <div class="admin-media-stats" data-role="admin-media-stats" aria-live="polite"></div>
        <div class="admin-media-toolbar">
          <div>
            <button type="button" class="admin-btn admin-btn-ghost admin-media-filter-btn" data-role="admin-media-filter-btn" data-filter="all">全部</button>
            <button type="button" class="admin-btn admin-btn-ghost admin-media-filter-btn" data-role="admin-media-filter-btn" data-filter="referenced">已引用</button>
            <button type="button" class="admin-btn admin-btn-ghost admin-media-filter-btn" data-role="admin-media-filter-btn" data-filter="orphaned">未引用</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <select class="admin-select" data-role="admin-media-sort" style="height:32px;font-size:0.8125rem;">
              <option value="created_at-desc">时间 ↓</option>
              <option value="created_at-asc">时间 ↑</option>
              <option value="size-desc">大小 ↓</option>
              <option value="size-asc">大小 ↑</option>
            </select>
            <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-media-upload-btn">上传图片</button>
            <input type="file" accept="image/*" data-role="admin-media-upload-input" hidden />
            <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-role="admin-media-bulk-delete" hidden>删除选中</button>
          </div>
        </div>
        <div class="admin-media-grid" data-role="admin-media-grid" aria-live="polite"></div>
        <div class="admin-pagination">
          <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-media-prev-page">上一页</button>
          <span data-role="admin-media-page-summary"></span>
          <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-media-next-page">下一页</button>
        </div>
        <p class="admin-form-error" data-role="admin-media-error" hidden></p>
      </section>

      <section class="admin-panel" data-role="admin-panel" data-panel="profile"${renderPanelHidden(context.pathname, 'profile')}>
        <header class="admin-panel-header">
          <h2>名片卡设置</h2>
          <p>用于首页与文章页侧边栏展示。</p>
        </header>
        <form class="admin-profile-form" data-role="admin-profile-form">
          <div class="admin-form-grid">
            <label><span>昵称</span><input type="text" name="name" required /></label>
          </div>
          <div class="admin-avatar-field">
            <label><span>头像</span></label>
            <div class="admin-avatar-preview-wrap">
              <img data-role="admin-avatar-preview" src="" alt="头像预览" />
            </div>
            <input type="file" name="avatarFile" accept="image/*" data-role="admin-avatar-upload" hidden />
            <input type="hidden" name="avatar" data-role="admin-avatar-url" />
            <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-avatar-upload-btn">上传头像</button>
          </div>
          <label><span>简介</span><textarea name="bio" rows="2" required></textarea></label>
          <div class="admin-contacts-section">
            <label><span>联系方式</span></label>
            <div class="admin-contact-list" data-role="admin-contact-list" aria-live="polite">
              <!-- dynamically rendered -->
            </div>
            <div class="admin-contact-add-row">
              <select data-role="admin-contact-platform">
                <option value="">选择平台...</option>
                <option value="__custom__">自定义...</option>
              </select>
              <input type="text" data-role="admin-contact-href" placeholder="链接地址" />
              <button type="button" class="admin-btn admin-btn-secondary" data-role="admin-contact-add">添加</button>
            </div>
          </div>
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
    case 'friends': return '友链管理';
    case 'about': return '关于页';
    case 'profile': return '名片卡';
    case 'media': return '媒体管理';
    case 'settings': return '站点设置';
    default: return '后台管理';
  }
}
