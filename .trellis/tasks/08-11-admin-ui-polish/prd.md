# 前端：管理界面 UI 审计与系统性重构

## Goal

对博客管理后台（frontend/src/pages/admin.ts + features/admin/* + styles/admin/*）先产出逐模块的 UI 审计清单（带 file:line 与不合理点描述），经用户确认后做一轮系统性 UI 重构（间距/层级/表单反馈/响应式），保持 Vanilla TS + 现有架构不变，无 JS 行为回归。

## Background

- 现状（已核验）：
  - 后台模板：`frontend/src/pages/admin.ts`（426 行，7 面板：posts/featured/friends/about/profile/media/settings）。
  - 后台逻辑：`frontend/src/features/admin/`（dashboard.ts 289 行 / posts.ts 715 行 / friends.ts 422 行 / media.ts 339 行 / content-settings.ts 441 行 / site-settings.ts 117 行 / login.ts 87 行 / shared.ts 220 行 / avatar-crop.ts 46 行）。
  - 后台样式：`frontend/src/styles/admin/admin-core.css`（1224 行）+ `admin-forms.css`（547 行），含 `@media (max-width: 1024px / 640px)` 与 dark mode 适配，但覆盖不完整。
  - 用户反馈："博客管理界面还非常的粗糙，UI 有很多不合理的地方，需要细节优化和调整"；用户未提供现成问题清单（已确认先审计）。
- 父任务决策：D6（Vanilla TS 保留、先审计后重构、不引框架）、D3（featured 面板随子任务 1 废弃，本任务不含 featured）。

## Requirements

1. **UI 审计清单**（本任务第一阶段交付物）：
   - 逐模块产出（posts / friends / about / profile / media / settings / login / 全局布局），每项含：位置（file:line）、问题描述、严重度（高/中/低）、建议修法。
   - 审计维度：布局与间距一致性、层级与视觉焦点、表单标签/校验/错误反馈、空态/加载态/成功态、按钮与危险操作确认、暗色模式、移动端响应式（≤1024 / ≤640）。
   - 清单落盘：`.trellis/tasks/08-11-admin-ui-polish/audit.md`（或 design.md 内），提交前需用户确认范围。
2. **系统性重构**（第二阶段，基于确认后的清单）：
   - 统一 admin 设计令牌（复用 `frontend/src/styles/tokens.css`，不新建体系）。
   - 重排 admin-core.css / admin-forms.css 结构（注释分区、选择器分组、消除 !important 与行内样式）。
   - 表单：标签-控件-校验信息对齐、错误/成功提示统一样式（现有 .admin-form-error/.admin-form-success 规范化）。
   - 反馈：空态提示、加载中状态、按钮 loading 态、危险操作二次确认（统一 confirm 文案或模态）。
   - 响应式：补齐 ≤1024px（面板折叠/列表布局）与 ≤640px（表单单列、工具栏换行）断点。
   - 暗色模式：补齐 `prefers-color-scheme: dark` 覆盖。
   - 不引入框架、不改 JS 行为逻辑（仅视觉与结构 class 调整）；如需微调 DOM 结构，须同步更新对应 JS 选择器引用。
3. **行为回归保障**：admin 各模块功能测试基准（发布/保存/删除/上传/筛选/分页）在重构前后各跑一遍。

## Acceptance Criteria

- [ ] audit.md 清单覆盖全部 admin 模块与全局布局，每项含 file:line、问题、严重度、修法。
- [ ] 用户确认审计清单（评审记录在 task notes 或 commit message 中可溯）。
- [ ] 清单中"高/中"严重度项全部闭环修复（低严重度项可标注 defer 并经用户同意）。
- [ ] 无 JS 行为回归：重构后 admin 全模块手动冒烟 + 构建通过。
- [ ] 样式文件结构重组完成（注释分区、无 !important 残留、无行内 style 残留——除既有限制性需求）。
- [ ] 暗色模式与移动端断点完整覆盖（清单核对）。
- [ ] 自检三命令通过。

## Out of Scope

- 引入前端框架/组件库。
- admin 功能逻辑改动（新增/删除功能）。
- featured 模块（子任务 1 已废弃）。
- 后端 API 调整。

## Open Questions

- [ ] 审计清单确认后，严重度阈值与范围（高/中必须闭环，低可 defer）由用户在确认时一并表态。

## Notes

- 本任务前置依赖：子任务 1 完成（featured 面板已移除，路由已迁 /blog）——执行顺序 1 → 2。
- audit.md 即 design.md 的实体形态：审计阶段完成后，design.md 引用 audit.md 并记录重构设计决策。
