# main.ts 拆分 — 实施计划

## 前置

- [ ] 基线冻结：`cd frontend && bun run typecheck && bun run build && bun test` 全绿；记录 main.ts 行数（3426）与 dist 体积
- [ ] 通读 main.ts 全文，标注各函数精确行界（以 design.md 映射表为基准校正）

## 实施顺序（每刀一个 commit，先验证后继续）

### Commit A — 动效提取 `features/motion.ts`
- 搬移 L850-2000 全部动效代码（selector 表、常量、11 个 setup\*Motion、辅助类型），原位置删除
- main.ts 从 motion.ts import 所需 setup，setupPageEnhancements 内调用点改为引用导入
- 验证：`bun run typecheck && bun run build`；冒烟动效页面（首页/文章详情/关于/标签）

### Commit B — 外壳提取 `components/shell.ts`
- 搬移 L18-105（历史状态助手、常量）、L107-484（renderApp 及全部渲染函数）、L486-649（setupHeaderDrawer）、setupScrollTopButton（L2079-2176）
- shell.ts 导出 renderApp、navigateTo、confirmAdminNavigation、setupHeaderDrawer 等
- main.ts 仅保留 bootstrap：调用 renderApp + 全局事件代理 + beforeunload
- 验证：typecheck + build；冒烟首页/管理端

### Commit C1-C5 — 页面增强按页分发（每页一个 commit）
- C1 `features/post-detail.ts`：setupPostDetailBackButton、setupPostDetailToc（含 heading id 辅助）、setupPostDetailCodeBlockCopy
- C2 `features/tags.ts`：setupTagCloudInteractions
- C3 `features/posts.ts`：setupPostDateSortToggle、setupPostThemeFilter
- C4 `features/archive.ts`：setupArchiveTimelineReveal
- C5 `features/friends.ts`：setupFriendLinkCopyButton
- 每刀验证：typecheck + build + 对应页面冒烟

### Commit D — main.ts 收尾 bootstrap
- setupPageEnhancements 拆为增强表（按路由匹配，函数体与挂载条件机械搬移）
- main.ts 收尾：入口 + 增强表 + 全局事件代理（click/popstate/beforeunload）+ cleanup 时序
- 全量验证：三命令 + 完整冒烟清单 + 与基线 diff 抽查（HTML 输出、class 名）

## 冒烟清单（手工）

- [ ] 首页 landing：动效节奏、reduced-motion 切换
- [ ] 文章详情：TOC 高亮/点击、代码复制按钮、返回按钮、滚动置顶、代码块动效
- [ ] 博客列表：日期排序切换、主题过滤、post-card 动效
- [ ] 标签页：标签云交互
- [ ] 归档页：时间线 reveal
- [ ] 友链页：复制按钮
- [ ] 关于页：内容动效、hydration
- [ ] 管理端：登录/面板/导航离开确认
- [ ] 浏览器前进后退（popstate + history 索引）

## 验证命令

```bash
cd frontend && bun run typecheck && bun run build && bun test
```

## 回滚点

- 每刀独立 commit，任意一步验证失败可 `git revert` 上一 commit 继续。
