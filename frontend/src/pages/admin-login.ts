import type { PageRenderer } from '../types/router';

export const renderAdminLoginPage: PageRenderer = () => {
  return `
<section class="page page-admin page-admin-login">
  <header class="page-header">
    <h1>后台登录</h1>
    <p>使用管理员账号登录后可管理文章、友链、关于页和名片卡。</p>
  </header>

  <form class="admin-login-form" data-role="admin-login-form" autocomplete="off">
    <label>
      <span>用户名</span>
      <input type="text" name="username" placeholder="admin" required />
    </label>
    <label>
      <span>密码</span>
      <input type="password" name="password" placeholder="••••••••" required />
    </label>
    <button type="submit">登录</button>
    <p class="admin-form-error" data-role="admin-login-error" hidden></p>
  </form>
</section>
`;
};
