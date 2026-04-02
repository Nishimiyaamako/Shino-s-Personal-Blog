import type { PageRenderer } from '../types/router';

export const renderAdminPage: PageRenderer = () => {
  return `
<section class="page page-admin page-admin-dashboard">
  <header class="page-header admin-header">
    <div>
      <p class="admin-kicker">Shino Admin Console</p>
      <h1>内容管理后台</h1>
      <p>统一管理文章、精选、友链、关于页与名片卡，所有操作都在同一会话内完成。</p>
    </div>
    <button type="button" class="admin-logout-button" data-role="admin-logout">退出登录</button>
  </header>

  <nav class="admin-tab-nav" aria-label="后台模块">
    <button type="button" class="is-active" data-role="admin-tab" data-tab="posts">文章</button>
    <button type="button" data-role="admin-tab" data-tab="featured">精选</button>
    <button type="button" data-role="admin-tab" data-tab="friends">友链</button>
    <button type="button" data-role="admin-tab" data-tab="about">关于</button>
    <button type="button" data-role="admin-tab" data-tab="profile">名片</button>
  </nav>

  <div class="admin-panel-wrap">
    <section class="admin-panel is-active" data-role="admin-panel" data-panel="posts">
      <div class="admin-two-col">
        <aside class="admin-list-col">
          <div class="admin-list-head">
            <h2>文章列表</h2>
            <button type="button" data-role="admin-post-new">新建</button>
          </div>

          <form class="admin-filter-form" data-role="admin-post-filter-form">
            <div class="admin-filter-grid">
              <label>
                <span>搜索</span>
                <input type="search" name="q" data-role="admin-post-search" placeholder="标题 / slug / 摘要 / 正文" />
              </label>
              <label>
                <span>状态</span>
                <select name="status" data-role="admin-post-status-filter">
                  <option value="all">全部</option>
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                </select>
              </label>
              <label>
                <span>标签</span>
                <input type="text" name="tag" data-role="admin-post-tag-filter" placeholder="如：typescript" />
              </label>
              <label>
                <span>每页</span>
                <select name="pageSize" data-role="admin-post-page-size">
                  <option value="10">10</option>
                  <option value="20" selected>20</option>
                  <option value="50">50</option>
                </select>
              </label>
            </div>
            <div class="admin-inline-actions">
              <button type="submit" data-role="admin-post-filter-apply">应用筛选</button>
              <button type="button" data-role="admin-post-filter-reset">重置</button>
            </div>
          </form>

          <ul class="admin-post-list" data-role="admin-post-list"></ul>
          <div class="admin-pagination" data-role="admin-post-pagination">
            <button type="button" data-role="admin-post-prev-page">上一页</button>
            <p data-role="admin-post-page-summary">第 1 页</p>
            <button type="button" data-role="admin-post-next-page">下一页</button>
          </div>
        </aside>

        <div class="admin-form-col">
          <form class="admin-post-form" data-role="admin-post-form">
            <div class="admin-form-head">
              <h2 data-role="admin-post-form-title">新建文章</h2>
              <p data-role="admin-post-form-meta">当前为新建模式，保存后可发布。</p>
            </div>
            <input type="hidden" name="id" />
            <label><span>标题</span><input type="text" name="title" required /></label>
            <label><span>slug</span><input type="text" name="slug" required /></label>
            <label><span>日期</span><input type="date" name="date" required /></label>
            <label><span>摘要</span><textarea name="summary" rows="2" required></textarea></label>
            <label><span>主题</span><input type="text" name="theme" placeholder="可选" /></label>
            <label><span>标签（逗号分隔）</span><input type="text" name="tags" required /></label>
            <label><span>封面 URL</span><input type="text" name="coverImageUrl" placeholder="/uploads/images/xxx.webp" /></label>
            <label><span>状态</span>
              <select name="status">
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
            </label>
            <label class="admin-checkbox-label"><input type="checkbox" name="isFeatured" /> <span>首页精选</span></label>
            <label><span>精选排序</span><input type="number" name="featuredOrder" min="1" placeholder="1" /></label>
            <div class="admin-markdown-editor">
              <label><span>正文 Markdown</span><textarea name="contentMarkdown" rows="12" required data-role="admin-post-content"></textarea></label>
              <section class="admin-markdown-preview" aria-label="Markdown 预览">
                <h3>预览</h3>
                <article class="admin-markdown-preview-body markdown-content" data-role="admin-post-preview">
                  <p class="empty-hint">输入 Markdown 后可在这里预览。</p>
                </article>
              </section>
            </div>

            <div class="admin-upload-row">
              <input type="file" name="coverFile" accept="image/*" data-role="admin-cover-upload" />
              <button type="button" data-role="admin-cover-upload-btn">上传图片并填入封面 URL</button>
            </div>
            <div class="admin-upload-row">
              <input type="file" name="contentFile" accept="image/*" data-role="admin-content-upload" />
              <button type="button" data-role="admin-content-upload-btn">上传图片并插入正文</button>
            </div>

            <div class="admin-form-actions">
              <button type="submit" data-role="admin-post-save">保存</button>
              <button type="button" data-role="admin-post-publish">发布</button>
              <button type="button" data-role="admin-post-unpublish">下线</button>
              <button type="button" data-role="admin-post-delete">删除</button>
            </div>
            <p class="admin-form-error" data-role="admin-post-error" hidden></p>
            <p class="admin-form-success" data-role="admin-post-success" hidden></p>
          </form>
        </div>
      </div>
    </section>

    <section class="admin-panel" data-role="admin-panel" data-panel="featured" hidden>
      <h2>精选排序</h2>
      <p>仅显示已发布文章，可快速开关首页精选并调整排序。</p>
      <ul class="admin-featured-list" data-role="admin-featured-list"></ul>
      <p class="admin-form-error" data-role="admin-featured-error" hidden></p>
      <p class="admin-form-success" data-role="admin-featured-success" hidden></p>
    </section>

    <section class="admin-panel" data-role="admin-panel" data-panel="friends" hidden>
      <div class="admin-two-col">
        <aside class="admin-list-col">
          <div class="admin-list-head">
            <h2>友链列表</h2>
          </div>
          <ul class="admin-friend-list" data-role="admin-friend-list"></ul>
        </aside>
        <div class="admin-form-col">
          <form class="admin-friend-form" data-role="admin-friend-form">
            <div class="admin-form-head">
              <h2 data-role="admin-friend-form-title">新建友链</h2>
              <p data-role="admin-friend-form-meta">填写基础信息后即可保存。</p>
            </div>
            <input type="hidden" name="id" />
            <label><span>名称</span><input type="text" name="name" required /></label>
            <label><span>描述</span><textarea name="description" rows="2" required></textarea></label>
            <label><span>头像 URL</span><input type="text" name="avatar" required /></label>
            <label><span>链接 URL</span><input type="text" name="url" required /></label>
            <label><span>排序</span><input type="number" name="displayOrder" min="0" value="0" /></label>
            <label class="admin-checkbox-label"><input type="checkbox" name="enabled" checked /> <span>启用</span></label>
            <div class="admin-form-actions">
              <button type="submit" data-role="admin-friend-submit">保存友链</button>
              <button type="button" data-role="admin-friend-cancel" hidden>取消编辑</button>
            </div>
            <p class="admin-form-error" data-role="admin-friend-error" hidden></p>
            <p class="admin-form-success" data-role="admin-friend-success" hidden></p>
          </form>
        </div>
      </div>
    </section>

    <section class="admin-panel" data-role="admin-panel" data-panel="about" hidden>
      <h2>关于页内容</h2>
      <form data-role="admin-about-form">
        <textarea name="markdown" rows="18" required></textarea>
        <div class="admin-form-actions">
          <button type="submit">保存关于页</button>
        </div>
        <p class="admin-form-error" data-role="admin-about-error" hidden></p>
        <p class="admin-form-success" data-role="admin-about-success" hidden></p>
      </form>
    </section>

    <section class="admin-panel" data-role="admin-panel" data-panel="profile" hidden>
      <h2>名片卡设置</h2>
      <form data-role="admin-profile-form">
        <label><span>昵称</span><input type="text" name="name" required /></label>
        <label><span>简介</span><textarea name="bio" rows="2" required></textarea></label>
        <label><span>头像 URL</span><input type="text" name="avatar" required /></label>
        <label><span>联系方式（每行：platform|label|href）</span><textarea name="contacts" rows="8"></textarea></label>
        <div class="admin-form-actions">
          <button type="submit">保存名片卡</button>
        </div>
        <p class="admin-form-error" data-role="admin-profile-error" hidden></p>
        <p class="admin-form-success" data-role="admin-profile-success" hidden></p>
      </form>
    </section>
  </div>
</section>
`;
};
