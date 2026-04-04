import { ADMIN_MODULE_LINKS, resolveAdminModule } from '../router';
import type { PageRenderer } from '../types/router';

function renderModuleNav(pathname: string): string {
  const activeModule = resolveAdminModule(pathname);

  return ADMIN_MODULE_LINKS
    .map((item) => {
      const isActive = activeModule === item.module;
      return `<a href="${item.href}" data-link class="${isActive ? 'is-active' : ''}"${isActive ? ' aria-current="page"' : ''}>
        <strong>${item.label}</strong>
        <small>${item.href}</small>
      </a>`;
    })
    .join('');
}

function renderModulePanelClass(currentPathname: string, panel: string): string {
  const activeModule = resolveAdminModule(currentPathname);
  const isPostsWorkspace = panel === 'posts' && (activeModule === 'posts' || activeModule === 'featured');
  const isActive = activeModule === panel || isPostsWorkspace;
  return isActive ? 'admin-panel is-active' : 'admin-panel';
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
  <section class="admin-posts-workspace${isFeaturedMode ? ' is-featured-focused' : ''}" data-role="admin-posts-workspace">
    <section class="admin-posts-primary${isFeaturedMode ? ' is-collapsed' : ''}" data-role="admin-posts-primary" ${isFeaturedMode ? 'hidden' : ''}>
      <div class="admin-two-col">
        <aside class="admin-list-col">
          <div class="admin-list-head">
            <h2>文章列表</h2>
            <button type="button" class="admin-btn admin-btn-secondary" data-role="admin-post-new">新建文章</button>
          </div>

          <form class="admin-filter-form" data-role="admin-post-filter-form">
            <div class="admin-filter-grid">
              <label>
                <span>关键词搜索</span>
                <input type="search" name="q" data-role="admin-post-search" placeholder="标题、Slug、摘要或正文片段" />
              </label>
              <label>
                <span>发布状态</span>
                <select name="status" data-role="admin-post-status-filter">
                  <option value="all">全部状态</option>
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                </select>
              </label>
              <label>
                <span>标签筛选</span>
                <input type="text" name="tag" data-role="admin-post-tag-filter" placeholder="例如：typescript" />
              </label>
              <label>
                <span>每页条数</span>
                <select name="pageSize" data-role="admin-post-page-size">
                  <option value="10">10 条</option>
                  <option value="20" selected>20 条</option>
                  <option value="50">50 条</option>
                </select>
              </label>
            </div>
            <div class="admin-inline-actions">
              <button type="submit" class="admin-btn admin-btn-secondary" data-role="admin-post-filter-apply">应用筛选</button>
              <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-post-filter-reset">清空筛选</button>
            </div>
          </form>

          <ul class="admin-post-list" data-role="admin-post-list" aria-live="polite"></ul>
          <div class="admin-pagination" data-role="admin-post-pagination">
            <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-post-prev-page">上一页</button>
            <p data-role="admin-post-page-summary">第 1 页</p>
            <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-post-next-page">下一页</button>
          </div>
        </aside>

        <div class="admin-form-col">
          <form class="admin-post-form" data-role="admin-post-form">
            <div class="admin-form-head">
              <h2 data-role="admin-post-form-title">新建文章</h2>
              <p data-role="admin-post-form-meta">先保存草稿，再按需发布。</p>
            </div>
            <input type="hidden" name="id" />

            <section class="admin-form-section" aria-label="文章基础信息">
              <h3>基础信息</h3>
              <label><span>标题</span><input type="text" name="title" required /></label>
              <label><span>Slug（URL 标识）</span><input type="text" name="slug" required /></label>
              <label><span>发布日期</span><input type="date" name="date" required /></label>
              <label><span>摘要</span><textarea name="summary" rows="2" required></textarea></label>
              <label><span>主题（可选）</span><input type="text" name="theme" placeholder="例如：DevOps" /></label>
              <label><span>标签（逗号分隔）</span><input type="text" name="tags" required placeholder="例如：typescript,web" /></label>
            </section>

            <section class="admin-form-section" aria-label="发布设置">
              <h3>发布设置</h3>
              <label><span>封面地址</span><input type="text" name="coverImageUrl" placeholder="/uploads/images/xxx.webp" /></label>
              <label><span>发布状态</span>
                <select name="status">
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                </select>
              </label>
              <label class="admin-checkbox-label"><input type="checkbox" name="isFeatured" /> <span>设为首页精选</span></label>
              <label><span>精选排序</span><input type="number" name="featuredOrder" min="1" placeholder="例如：1" /></label>
            </section>

            <section class="admin-form-section" aria-label="正文编辑">
              <h3>正文</h3>
              <div class="admin-markdown-editor">
                <label><span>Markdown 正文</span><textarea name="contentMarkdown" rows="12" required data-role="admin-post-content"></textarea></label>
                <section class="admin-markdown-preview" aria-label="Markdown 预览">
                  <h4>实时预览</h4>
                  <article class="admin-markdown-preview-body markdown-content" data-role="admin-post-preview">
                    <p class="empty-hint">开始输入后，这里会同步显示预览。</p>
                  </article>
                </section>
              </div>
            </section>

            <section class="admin-form-section" aria-label="媒体上传">
              <h3>媒体上传</h3>
              <div class="admin-upload-row">
                <input type="file" name="coverFile" accept="image/*" data-role="admin-cover-upload" />
                <button type="button" class="admin-btn admin-btn-secondary" data-role="admin-cover-upload-btn">上传封面并填入链接</button>
              </div>
              <div class="admin-upload-row">
                <input type="file" name="contentFile" accept="image/*" data-role="admin-content-upload" />
                <button type="button" class="admin-btn admin-btn-secondary" data-role="admin-content-upload-btn">上传正文图片并插入</button>
              </div>
            </section>

            <div class="admin-form-actions admin-form-actions-sticky">
              <button type="submit" class="admin-btn admin-btn-primary" data-role="admin-post-save">保存草稿</button>
              <button type="button" class="admin-btn admin-btn-secondary" data-role="admin-post-publish">发布文章</button>
              <button type="button" class="admin-btn admin-btn-warning" data-role="admin-post-unpublish">下线文章</button>
              <button type="button" class="admin-btn admin-btn-danger" data-role="admin-post-delete">删除文章</button>
            </div>
            <p class="admin-form-error" data-role="admin-post-error" hidden></p>
            <p class="admin-form-success" data-role="admin-post-success" hidden></p>
          </form>
        </div>
      </div>
    </section>

    <section class="admin-featured-panel${isFeaturedMode ? ' is-active' : ''}" data-role="admin-featured-panel" ${isFeaturedMode ? '' : 'hidden'}>
      <header class="admin-subhead">
        <h2>首页精选管理</h2>
        <p>仅显示已发布文章。可批量开关精选并调整排序。</p>
      </header>
      <ul class="admin-featured-list" data-role="admin-featured-list" aria-live="polite"></ul>
      <p class="admin-form-error" data-role="admin-featured-error" hidden></p>
      <p class="admin-form-success" data-role="admin-featured-success" hidden></p>
    </section>
  </section>`;
}

export const renderAdminPage: PageRenderer = (context) => {
  const activeModule = resolveAdminModule(context.pathname);

  return `
<section class="page page-admin page-admin-dashboard" data-admin-module="${activeModule}">
  <header class="admin-shell-head">
    <div>
      <p class="admin-kicker">Content Ops Console</p>
      <h1>后台管理控制台</h1>
      <p>面向日常运维的内容工作台：高频操作优先、风险动作可控、状态反馈明确。</p>
    </div>
    <div class="admin-shell-head-actions">
      <a href="/admin/posts" data-link class="admin-btn admin-btn-ghost">返回文章管理</a>
      <button type="button" class="admin-btn admin-btn-secondary" data-role="admin-logout">退出登录</button>
    </div>
  </header>
  <div class="admin-runtime-row">
    <p class="admin-runtime-status" data-role="admin-runtime-status" aria-live="polite"></p>
    <button type="button" class="admin-btn admin-btn-ghost admin-runtime-retry" data-role="admin-runtime-retry" hidden>重试加载</button>
  </div>
  <p class="admin-unsaved-status" data-role="admin-unsaved-status" aria-live="polite" hidden>当前有未保存变更，离开前请先保存。</p>

  <div class="admin-workbench">
    <aside class="admin-module-nav" aria-label="后台模块导航">
      <h2>模块导航</h2>
      <nav class="admin-module-nav-list">
        ${renderModuleNav(context.pathname)}
      </nav>
    </aside>

    <div class="admin-panel-wrap">
      <section class="${renderModulePanelClass(context.pathname, 'posts')}" data-role="admin-panel" data-panel="posts"${renderPanelHidden(context.pathname, 'posts')}>
        ${renderPostsWorkspace(context.pathname)}
      </section>

      <section class="${renderModulePanelClass(context.pathname, 'friends')}" data-role="admin-panel" data-panel="friends"${renderPanelHidden(context.pathname, 'friends')}>
        <div class="admin-two-col">
          <aside class="admin-list-col">
            <div class="admin-list-head">
              <h2>友链列表</h2>
            </div>
            <ul class="admin-friend-list" data-role="admin-friend-list" aria-live="polite"></ul>
          </aside>
          <div class="admin-form-col">
            <form class="admin-friend-form" data-role="admin-friend-form">
              <div class="admin-form-head">
                <h2 data-role="admin-friend-form-title">新建友链</h2>
                <p data-role="admin-friend-form-meta">录入基础信息后即可展示到前台。</p>
              </div>
              <input type="hidden" name="id" />
              <label><span>名称</span><input type="text" name="name" required /></label>
              <label><span>描述</span><textarea name="description" rows="2" required></textarea></label>
              <label><span>头像链接</span><input type="text" name="avatar" required /></label>
              <label><span>跳转链接</span><input type="text" name="url" required /></label>
              <label><span>排序值</span><input type="number" name="displayOrder" min="0" value="0" /></label>
              <label class="admin-checkbox-label"><input type="checkbox" name="enabled" checked /> <span>前台可见</span></label>
              <div class="admin-form-actions">
                <button type="submit" class="admin-btn admin-btn-primary" data-role="admin-friend-submit">保存友链</button>
                <button type="button" class="admin-btn admin-btn-ghost" data-role="admin-friend-cancel" hidden>取消编辑</button>
              </div>
              <p class="admin-form-error" data-role="admin-friend-error" hidden></p>
              <p class="admin-form-success" data-role="admin-friend-success" hidden></p>
            </form>
          </div>
        </div>
      </section>

      <section class="${renderModulePanelClass(context.pathname, 'about')}" data-role="admin-panel" data-panel="about"${renderPanelHidden(context.pathname, 'about')}>
        <header class="admin-subhead">
          <h2>关于页内容</h2>
          <p>保存后前台会立即刷新显示。</p>
        </header>
        <form class="admin-about-form" data-role="admin-about-form">
          <label>
            <span>Markdown 内容</span>
            <textarea name="markdown" rows="18" required></textarea>
          </label>
          <div class="admin-form-actions">
            <button type="submit" class="admin-btn admin-btn-primary">保存关于页</button>
          </div>
          <p class="admin-form-error" data-role="admin-about-error" hidden></p>
          <p class="admin-form-success" data-role="admin-about-success" hidden></p>
        </form>
      </section>

      <section class="${renderModulePanelClass(context.pathname, 'profile')}" data-role="admin-panel" data-panel="profile"${renderPanelHidden(context.pathname, 'profile')}>
        <header class="admin-subhead">
          <h2>名片卡设置</h2>
          <p>用于首页与文章页侧边栏展示。</p>
        </header>
        <form class="admin-profile-form" data-role="admin-profile-form">
          <label><span>昵称</span><input type="text" name="name" required /></label>
          <label><span>简介</span><textarea name="bio" rows="2" required></textarea></label>
          <label><span>头像链接</span><input type="text" name="avatar" required /></label>
          <label>
            <span>联系方式（每行 1 条：平台|显示名|链接，例如 github|Shino|https://github.com/...）</span>
            <textarea name="contacts" rows="8" placeholder="github|Shino|https://github.com/...\nemail|联系邮箱|mailto:me@example.com"></textarea>
          </label>
          <div class="admin-form-actions">
            <button type="submit" class="admin-btn admin-btn-primary">保存名片卡</button>
          </div>
          <p class="admin-form-error" data-role="admin-profile-error" hidden></p>
          <p class="admin-form-success" data-role="admin-profile-success" hidden></p>
        </form>
      </section>
    </div>
  </div>
</section>
`;
};
