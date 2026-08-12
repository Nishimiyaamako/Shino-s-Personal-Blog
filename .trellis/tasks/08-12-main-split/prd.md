# main.ts 拆分：动效/外壳/页面增强三刀拆解

## Goal

将 3426 行 `frontend/src/main.ts` 拆为 `features/motion.ts`、`components/shell.ts`、按宿主页分发的 `features/*.ts` 与精简 bootstrap，页面行为零变化。

## Background

- 现状实测（main.ts，3426 行）：
  - L18-105：app root、history 状态助手、常量
  - L107-484：外壳渲染（renderApp / renderAdminShell / renderNavigation / header drawer 触发器 / footer / TOC rail / 主题 rail / scroll-top 按钮 / navigateTo / confirmAdminNavigation）
  - L486-649：`setupHeaderDrawer`
  - L649-849：`setupPageEnhancements`（全页增强编排器）
  - L850-2000：动效系统（selector 表 + ~50 个常量 + 11 个 setup\*Motion）
  - L2001-3426：页面增强（post-detail TOC/代码复制/返回按钮、标签云、日期排序、主题过滤、归档 reveal、友链复制）+ 全局事件代理
- 项目已有 `pages/`（纯渲染）、`features/`（行为绑定）、`components/`、`utils/` 分层；`features/public-runtime.ts` 已承载数据 hydration 与搜索模态框。main.ts 是唯一单体文件。
- 仓库仅有 vitest 单测（无浏览器级测试），行为回归靠 build + 手工冒烟。

## Requirements

1. 动效系统整体迁 `features/motion.ts`：selector 表、时序常量（SIDE_PANEL_* / CONTENT_RHYTHM_* / MOTION_DELAY_MS 等）留在文件内，导出各 `setup*Motion` 与动效辅助类型。
2. 外壳渲染迁 `components/shell.ts`：renderApp 渲染逻辑、renderNavigation、header/footer 相关渲染函数、TOC/主题 rail、scroll-top、navigateTo、confirmAdminNavigation、history 状态助手；导出 bootstrap 需要的入口与导航工具。
3. 页面增强按宿主页分发：
   - `features/post-detail.ts`：TOC、代码复制按钮、返回按钮、滚动置顶
   - `features/tags.ts`：标签云交互
   - `features/posts.ts`：日期排序切换、主题过滤
   - `features/archive.ts`：归档时间线 reveal
   - `features/friends.ts`：友链复制按钮
4. `setupPageEnhancements` 退化为按路由注册的页面增强入口表（各 setup 内部自行判断是否需要挂载）。
5. `main.ts` 收尾为 bootstrap：渲染外壳 + 注册增强表 + 全局事件代理（目标 ≤300 行）。

## Acceptance Criteria

- [ ] main.ts ≤300 行，仅含 bootstrap 与全局事件代理
- [ ] DOM 输出、class 名、事件行为、动效时序与拆分前一致（diff 抽查 + 冒烟清单）
- [ ] `bun run typecheck && bun run build && bun test` 全绿
- [ ] 无循环 import（build 成功即证）
- [ ] 冒烟清单通过：首页 / 文章详情（TOC、代码复制、返回、滚动置顶）/ 标签页（标签云）/ 博客列表（排序、主题过滤）/ 归档 / 友链 / 关于 / 管理端 + 动效节奏（reduced-motion 切换）

## Notes

- 纯机械提取，不重构逻辑、不改变 HTML 输出。
- feature setup 保持 `(options?) => (() => void) | null` 签名约定（spec/frontend/directory-structure.md）。
- 动效常量不泄漏出 motion.ts；跨模块共享的 navigateTo 由 shell.ts 导出。
- 每刀一个 commit，每步验证后再继续（见 implement.md）。
