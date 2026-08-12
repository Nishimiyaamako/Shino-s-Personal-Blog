# main.ts 拆分 — 技术设计

## 现状归属映射（函数 → 目标模块）

| 模块 | 内容（实测行号） |
| --- | --- |
| `features/motion.ts` | L850-2000 整片：PAGE_STAGGER_SELECTORS 等 selector 表、SIDE_PANEL_*/CONTENT_RHYTHM_*/MOTION_DELAY_MS 等常量、restoreNodePlacement、resolveContentRhythmGroup、setupMobileSidePanelPlacement、setupRouteEnterTransition、setupSidePanelPopMotion、orderPostCardsByVisualFlow、orderPostCardsTopToBottom、setupPostCardRiseMotion、setupGlobalMotionChoreography、resolveAboutPageElement、setupAboutContentMotion、setupAboutPageHydration（含 isAbortError）、MotionScopeNode 等类型 |
| `components/shell.ts` | L18-105（app root/常量/history 助手）、L107-484（renderApp、renderAdminShell、renderNavigation、header/footer/rails 渲染、navigateTo、confirmAdminNavigation、hasUnsavedAdminChanges、applyFixedPreviewState、ensureHistoryIndexState）、L486-649（setupHeaderDrawer）、L2079-2176（setupScrollTopButton，滚动置顶属外壳）、L3344+（shouldHandleLinkClick 归全局事件代理，留 main.ts） |
| `features/post-detail.ts` | setupPostDetailBackButton、setupPostDetailToc、setupPostDetailCodeBlockCopy、getHeadingTextContent、normalizeHeadingId、createUniqueHeadingId、slugifyHeadingText、decodeHashTargetId |
| `features/tags.ts` | setupTagCloudInteractions |
| `features/posts.ts` | setupPostDateSortToggle、setupPostThemeFilter |
| `features/archive.ts` | setupArchiveTimelineReveal |
| `features/friends.ts` | setupFriendLinkCopyButton |
| `main.ts`（bootstrap） | 入口：导入各 setup，建立 路由→增强函数表（替代 setupPageEnhancements 的 switch/if 链）、renderApp 调用、全局 click 代理 + popstate + beforeunload、模块级 cleanup 变量 |

## 依赖方向

- `motion.ts`：零依赖 main 侧（自包含常量与 DOM 工具，依赖 utils/dom-style 如有引用）。
- `shell.ts`：依赖 router/index（resolveRoute、isAdminPathname）、config/site（loadSiteConfig）、types/router、features/public-runtime（setupPublicDataHydration 等 hydration 编排仍由 renderApp 调用——确认引用关系后按需导入）。
- `features/*.ts`：依赖 shell 导出的 navigateTo（post-detail 返回按钮、滚动置顶可能引用）、utils/*；motion 由 shell/renderApp 侧不再直接引用（setupPageEnhancements 删后，动效 setup 改由 motion.ts 导出并在 bootstrap 的增强表里按路由注册）。
- 禁止：任何新模块 import main.ts（main.ts 是叶子）。

## 关键设计点

1. **setupPageEnhancements 的拆法**：现为单函数内按 pathname 分支调用各 setup 并收集 cleanup。拆后主表结构：
   ```ts
   type PageEnhancer = (ctx: { pathname: string; routePath: string }) => (() => void) | null;
   const PAGE_ENHANCERS: Array<{ match: string | RegExp; setup: PageEnhancer }> = [...]
   ```
   各 setup 内部保留自己的挂载条件（现有 if 条件不动，机械搬移），表只做路由匹配；setupPageEnhancements 的调用点（renderApp 内）改为调用 bootstrap 的 `runPageEnhancers`。为减少行为差异风险，保守做法：每个 setup 函数签名与调用参数保持原样，仅把调用集合从 switch 换成数组遍历。
2. **cleanup 聚合**：renderApp 现持有 `cleanupPageEnhancements` 模块级变量。拆分后 main.ts 保留该变量与调用时序（先 cleanup 旧、再渲染、再 setup 新）——这是行为关键点，不得改变。
3. **动效拆分**：动效 setup 的调用目前散在 setupPageEnhancements 内（按路由条件调用 setupSidePanelPopMotion 等）。拆后这些调用留在 bootstrap 的增强表/或由各页面 feature 调用。更贴合"按宿主页分发"原则：把与特定页面强绑定的动效（setupAboutContentMotion→about、setupAboutPageHydration→about、setupPostCardRiseMotion→posts、setupMobileSidePanelPlacement/setupSidePanelPopMotion/setupGlobalMotionChoreography/setupRouteEnterTransition→全局路由级）按宿主注册进增强表，动效函数本体留在 motion.ts。
4. **滚动置顶按钮**：setupScrollTopButton 为全局外壳行为（多页共用），归 shell.ts。
5. **history 状态助手**（cloneHistoryState/readHistoryIndex/createHistoryStateWithIndex/ensureHistoryIndexState/applyFixedPreviewState/HISTORY_STATE_NAV_INDEX_KEY）与 navigateTo 强耦合，同归 shell.ts。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 行为回归（无浏览器测试） | 纯搬移 + 逐刀验证 build/typecheck + 冒烟清单；每刀 commit 可回退 |
| 循环 import | 依赖方向单向（pages/features → shell → router/config）；motion 不 import shell |
| 常量/辅助函数遗漏引用 | 每刀提取后跑 typecheck，未导出符号即刻报错 |
| 动效时序改动 | setup 调用参数与顺序保持不变，仅搬位置 |

## 兼容性

- 不改变任何对外 HTML 结构/class/事件名；不改变 router、data、pages 层任何文件（除 main.ts 与新增文件）。
- admin 端渲染（renderAdminShell）与 setupPageEnhancements 的 admin 分支保持原逻辑，仅搬位置。
