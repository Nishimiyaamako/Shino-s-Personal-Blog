# 前端：管理界面 UI 审计与系统性重构 — Design

## 1. 架构基线（不引入框架）

- 维持现状：模板字符串渲染（pages/admin.ts）+ 事件委托（features/admin/*）+ 两文件 CSS（admin-core.css / admin-forms.css）。
- 设计令牌复用 `frontend/src/styles/tokens.css`（颜色/间距/圆角/阴影变量），admin 样式缺令牌的地方优先补令牌变量，不硬编码。
- 重构原则：**视觉与结构（class/DOM）可调，JS 行为（data-role/事件绑定）保持兼容**；改 DOM 结构必须同步检索 `data-role` 引用（`grep -rn "data-role" frontend/src/features/admin`）。

## 2. 审计清单结构（audit.md）

```
# Admin UI 审计清单
## 全局与布局（admin.ts + admin-core.css）
| # | 位置(file:line) | 问题 | 严重度 | 修法 |
## 模块
### 文章管理（posts 面板 + features/admin/posts.ts + shared.ts）
### 友链管理（friends 面板 + features/admin/friends.ts）
### 关于页（about 面板 + content-settings.ts）
### 名片卡（profile 面板）
### 媒体管理（media 面板 + media.ts）
### 站点设置（settings 面板 + site-settings.ts）
### 登录页（login.ts + admin-login 样式）
```

- 严重度定义：**高**=功能可用性受损/明显视觉错误；**中**=体验不佳/不一致；**低**=锦上添花。
- 审计执行：`trellis-research` 子代理逐模块读文件产出草稿，主会话汇总去重，人工复核 file:line 后交用户确认。

## 3. 重构分层（确认清单后执行）

### 3.1 样式组织
- `admin-core.css`：布局骨架（sidebar/topbar/panel/split/editor-workspace）+ 组件原语（btn/input/select 已在 forms 或 core？核验后归位）。
- `admin-forms.css`：表单体系（label 行、admin-form-grid、quick-meta、meta-drawer、错误/成功提示、checkbox）。
- 目标：类名归属单一文件；删除重复定义；CSS 变量接管硬编码色值（`grep -nE '#[0-9a-fA-F]{3,6}' admin-*.css` 逐条处置）。

### 3.2 已知薄弱区（审计重点关注，预置候选）
- 内联样式残留：admin.ts 内 `style="margin-top:6px;width:100%;"`（:210 友链搜索框）、`style="display:flex;align-items:center;gap:8px;"`（:348 媒体工具栏）、`style="margin-top:0.75rem"`（:281 时间线容器）、`style="height:32px;font-size:0.8125rem;"`（:349 select）→ 全部类化。
- 面板头部一致性：admin-panel-header（friends/about/settings/media/profile 各有，posts 无 header）→ 统一 panel-header 结构。
- 编辑器区（posts）：admin-editor-head / markdown-workspace 双栏在 ≤640px 是否单栏、quick-meta 四字段响应式（现有 admin-quick-meta @media 核验）。
- 列表区：admin-list-panel 搜索/筛选/分页工具条在窄屏换行与对齐。
- 状态提示：admin-form-error/admin-form-success 的固定定位与出现动画；保存成功后按钮态。
- 危险操作：删除文章/友链/媒体确认（现状 window.confirm 或自定义？核验 features/admin/* 中 confirm 用法，统一视觉确认组件为可选低优先项）。
- 空态：admin-post-list 等空数据时的占位（现有 empty-hint 复用 or 新增 admin-empty）。
- 暗色模式：grep `prefers-color-scheme` 覆盖率，缺项补齐。
- 移动端：≤1024px sidebar 折叠（现状是否固定侧栏？核验 layout），≤640px 表单单列。

### 3.3 登录页
- login.ts 卡片样式（admin-app-login/login-card 已存在）→ 与主后台视觉同源（brand-mark 统一）。

## 4. 回归验证

- 构建：`npm run typecheck && npm run build`（frontend/）。
- 手动冒烟矩阵（重构前后各一次，记录于 task notes）：
  - 文章：新建/保存草稿/发布/下线/删除/筛选/搜索/分页/精选（已废弃无需测）/封面与正文插图上传/预览。
  - 友链：新建/编辑/删除/代码块导入解析/搜索。
  - 关于：intro/narrative/timeline 增删存。
  - 名片卡：头像裁剪上传、联系人增删。
  - 媒体：上传/筛选/排序/分页/批量删除。
  - 设置：保存与回填。
  - 登录/登出。
- 无回归判据：每个 data-role 绑定事件在重构后仍可触发（抽查 key 路径 + 全量冒烟）。

## 5. 回滚

- 重构按模块分提交（posts → friends/about/profile/media/settings → 登录/全局），每提交可独立 revert。
- audit.md 与代码提交分离：清单确认提交 → 各模块重构提交。

## 6. 风险

- DOM 结构调整破坏 JS 选择器 → 改 DOM 前 grep data-role 引用清单。
- CSS 归位漏改导致样式丢失 → 每模块重构后立即本地预览冒烟，不攒批。
- 暗色模式补缺时色值不匹配 → 复用 tokens 变量，避免新硬编码。
