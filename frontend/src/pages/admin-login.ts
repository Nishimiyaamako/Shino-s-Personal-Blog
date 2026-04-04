import type { PageRenderer } from '../types/router';

export const renderAdminLoginPage: PageRenderer = () => {
  return `
<section class="page page-admin page-admin-login">
  <header class="admin-login-head">
    <p class="admin-kicker">Content Ops Console</p>
    <h1>管理员登录</h1>
    <p>登录后可管理文章、精选、友链、关于页与名片卡。</p>
  </header>

  <form class="admin-login-form" data-role="admin-login-form" autocomplete="off">
    <label>
      <span>管理员账号</span>
      <input type="text" name="username" placeholder="例如：admin" required />
    </label>
    <label>
      <span>登录密码</span>
      <input type="password" name="password" placeholder="请输入密码" required />
    </label>
    <button type="submit" class="admin-btn admin-btn-primary">登录后台</button>
    <p class="admin-form-error" data-role="admin-login-error" hidden></p>
  </form>
</section>
`;
};
