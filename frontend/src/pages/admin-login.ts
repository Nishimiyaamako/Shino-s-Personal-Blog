import type { PageRenderer } from '../types/router';

export const renderAdminLoginPage: PageRenderer = () => {
  return `
<div class="admin-app admin-app-login">
  <main class="admin-login-main">
    <div class="admin-login-card">
      <div class="admin-login-brand">
        <span class="admin-brand-mark">🌸</span>
        <h1>ShinoLog</h1>
        <p>内容管理后台</p>
      </div>

      <form class="admin-login-form" data-role="admin-login-form" autocomplete="off">
        <label>
          <span>管理员账号</span>
          <input type="text" name="username" placeholder="例如：admin" required />
        </label>
        <label>
          <span>登录密码</span>
          <input type="password" name="password" placeholder="请输入密码" required />
        </label>
        <button type="submit" class="admin-btn admin-btn-primary admin-btn-lg">登录后台</button>
        <p class="admin-form-error" data-role="admin-login-error" hidden></p>
      </form>
    </div>
  </main>
</div>
`;
};
