# 前端：管理界面 UI 审计与系统性重构 — Implement

## 执行顺序

### [块 1] 审计清单产出（前置，需用户确认）
1. 派 `trellis-research` 子代理逐模块审计，输出草稿（每个文件：file:line + 问题 + 严重度建议）：
   - 全局布局：pages/admin.ts、styles/admin/admin-core.css、admin-forms.css
   - 模块：features/admin/{posts,friends,media,content-settings,site-settings,login,shared}.ts
2. 主会话汇总去重、复核 file:line，落盘 `audit.md`（含严重度分级与修法）。
3. 提交 audit.md；向用户呈现清单，确认范围（高/中必闭环、低可 defer）。
4. **等待用户确认后再进入块 2。**

### [块 2] 全局与登录页
5. 内联样式类化（admin.ts 四处 style=...，见 design §3.2）。
6. admin-panel-header 统一；tokens 变量接管硬编码色值。
7. 登录页视觉同源（admin-login-card / brand）。
8. typecheck + build + 冒烟。提交。

### [块 3] 文章管理面板
9. 编辑器区（admin-editor-head / markdown-workspace / quick-meta / meta-drawer / actions）响应式与视觉统一。
10. 列表区（search / filter-bar / pagination）窄屏适配；空态补全。
11. 表单错误/成功提示统一样式与反馈。
12. 冒烟：新建/保存/发布/删除/上传/预览。提交。

### [块 4] 友链 + 关于 + 名片卡 + 媒体 + 设置面板
13. 按 audit 清单逐面板修复（每面板一个提交，含冒烟）。
14. 危险操作确认（删除类）统一。
15. 暗色模式补缺（清单核对）。

### [块 5] 收尾
16. 全模块回归冒烟矩阵（design §4）。
17. grep 复查：无 !important 残留（除既有）、无行内 style 残留、无硬编码色值新增。
18. 自检三命令；提交。

## 验证命令

```bash
cd frontend && npm run typecheck && npm run build
cd .. && ./deploy/scripts/local-verify.sh
grep -rn '⚠ 待核验' . --include='*.md'
grep -rnE '(password|passwd|api[_-]?key|token|secret|private[_-]?key)[[:space:]]*[:=]' . --include='*.md'
git config core.hooksPath
```

## 关键文件

| 文件 | 改动 |
| --- | --- |
| .trellis/tasks/08-11-admin-ui-polish/audit.md（新） | 审计清单（需用户确认） |
| frontend/src/pages/admin.ts | 内联样式类化、panel-header 统一 |
| frontend/src/styles/admin/admin-core.css | 布局/组件重构、令牌化 |
| frontend/src/styles/admin/admin-forms.css | 表单体系重构 |
| frontend/src/features/admin/*.ts | 仅按需微调（结构随 class 改名时同步） |
| frontend/src/styles/tokens.css | 按需补充 admin 令牌（不破坏现有） |

## 风险与回滚

- 每块独立提交可 revert；改 DOM 前先 grep data-role 引用。
- 审计清单未确认前不得进入块 2（用户评审门禁）。

## 提交前自检

- [ ] audit.md 已提交且用户确认
- [ ] 高/中严重度项闭环，defer 项用户知情
- [ ] typecheck + build 通过
- [ ] 冒烟矩阵全绿
- [ ] 自检三命令通过
