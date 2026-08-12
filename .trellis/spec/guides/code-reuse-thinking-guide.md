# 代码复用思考指南（Shino's Bolg）

> **目的**：写新代码前先搜——这个仓库里可能已经存在了。

---

## 先搜再写（硬性步骤）

```bash
grep -rn "关键字/函数名" frontend/src backend/rust/src
```

## 本仓库的既有复用点（新增代码前先对照）

| 需求 | 既有实现 |
|------|----------|
| DOM 样式变量读写 | `utils/dom-style.ts`（setCssVar / clearCssVar / setCssPxVar / readCssLengthPx） |
| HTML 转义 | `utils/escape-html.ts` |
| 主题键规范化 | `utils/theme.ts`（normalizeThemeKey） |
| 日期格式化 | `utils/date.ts` |
| 标签配色 | `utils/tag-color.ts` |
| 搜索/模糊匹配 | `utils/search.ts` |
| 所有 fetch 包装 | `data/api.ts`（fetchJson + Bearer） |
| 破坏性操作确认 | `features/admin/shared.ts`（confirmAdminAction 样式化 dialog） |
| 代码复制（textarea fallback + 状态重置） | `features/post-detail.ts`（code block copy）与 `features/friends.ts`（友链复制）——**模式已重复 2 次，第三次出现时提取共享 util** |
| 列表/卡片渲染 | `components/post-list.ts`、`components/profile-card.ts` |
| 动效时序/常量/selector | `features/motion.ts`（import，勿重定义） |
| 文章列表数据（含标签/主题过滤） | `data/posts.ts`（getPostsByTag / getThemeStats + 指纹缓存） |
| 站点配置 | `data/site-config.ts`（loadSiteConfig + applyRemoteSiteConfig） |

## 重复模式识别

- **同一选择器/常量出现在 2+ 文件**：提到最近的 owner（motion 常量 → `features/motion.ts`；DOM 选择器 → 对应 feature 模块顶部）
- **同一 DOM 交互逻辑出现 2+ 次**：提取 `utils/` 纯函数（如复制按钮逻辑），各自 feature 只保留挂载代码
- **镜像类型手工同步**：改 `models.rs` 时四件套（api_compat 契约 / `__fixtures__/*.json` / `types/*.ts`）同步，契约测试兜底——不要为"省事"跳过夹具更新
- **setup/teardown 骨架**：新 feature 一律 `(options?) => (() => void) | null` 签名 + 内部 null 守卫（元素不存在返回 null），沿用现有模式

## 何时抽象 / 何时不抽象

- **抽象**：模式出现 3 次、逻辑复杂易错、跨模块共享
- **不抽象**：单处使用、一行琐碎逻辑、抽象比重复更难读（如 feature 的挂载骨架保留在各自文件）

## 提交前检查

- [ ] 新函数/常量已搜索是否存在
- [ ] 没有重复的转义/复制/样式变量逻辑
- [ ] 未在 `features/*` 之外重定义动效常量
- [ ] 新 UI 片段前已检查 `components/` 可复用项
