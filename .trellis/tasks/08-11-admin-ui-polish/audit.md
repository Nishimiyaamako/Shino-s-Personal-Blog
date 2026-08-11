# Admin UI 审计清单

> 任务：08-11-admin-ui-polish · 审计日期：2026-08-11 · 审计方式：主会话逐文件阅读（pages/admin.ts + features/admin/* + styles/admin/*）
> 严重度：**高**=功能可用性受损/明显视觉错误；**中**=体验不佳/不一致；**低**=锦上添花

## 全局与布局（pages/admin.ts + admin-core.css + admin-forms.css）

| # | 位置 | 问题 | 严重度 | 修法 |
| --- | --- | --- | --- | --- |
| G1 | admin-core.css:1107-1143 | `--admin-*` 令牌**只在 dark mode 内定义**，亮色全部靠 `var(--admin-x, fallback)` 兜底，令牌形同虚设；且 tokens.css 中无任何 admin 令牌 | 中 | 在 `.admin-app` 根上定义亮色 `--admin-*` 令牌（tokens.css 或 admin-core.css 顶部），dark 块仅覆盖差异 |
| G2 | admin-forms.css:140-548（avatar/contacts/media/about 段） | 该段硬编码**暗色系**色值（`#1b1e27`、`#3a4152`、`#80a0c0`、`#eceff4`），亮色模式下也是暗底亮字——与全局亮色体系割裂，属明显视觉错误 | **高** | 全段改用 `var(--admin-*)` 令牌，随主题切换 |
| G3 | admin-forms.css:296-297 | `!important` 残留（`.admin-media-filter-btn.is-active`） | 中 | 消除，用更高优先级选择器或令牌 |
| G4 | admin-core.css:4-61 vs admin-forms.css:13-31 | `label>span` 标签样式两处重复定义（quick-meta 与 form 系），维护双份 | 低 | 归并到统一表单令牌/选择器 |
| G5 | admin.ts:193 / :264 / :332-333 | 内联样式残留 3 处（`style="margin-top:6px;width:100%;"`、`style="margin-top:0.75rem"`、`style="display:flex;...height:32px;font-size:0.8125rem;"`） | 中 | 全部类化（`.admin-friend-search`、`.admin-about-timeline-list`、`.admin-media-toolbar select` 等） |
| G6 | admin.ts:333（.admin-select） | `.admin-select` 类在 CSS 中**无定义**（媒体排序 select 无样式，浏览器默认外观突兀） | **高** | 新增 `.admin-select` 样式（与 forms 系 select 一致） |
| G7 | admin.ts:193（class="form-input"） | 友链搜索框借用**公开站点组件样式**（components/forms.css 的 .form-input），风格与 admin 体系不统一 | 中 | 改 `.admin-search-box` 或 admin 化类名 |
| G8 | admin.ts:293-334（settings 面板） | settings 面板 fieldset/legend 无专属样式（裸默认边框），与 about 面板 `.admin-about-fieldset` 视觉不一致 | 中 | 统一 fieldset/legend 样式（`legend` 全局化或加 `.admin-fieldset` 类） |
| G9 | admin-core.css:404-419 vs :455-462 | 标题体系双轨：`.admin-panel-header h2`（16px）与 `.admin-list-toolbar h2`（13px uppercase），面板内层级混乱 | 低 | 统一为 panel-header 层级 |
| G10 | admin-forms.css:172-174 | `img[src=""]` 隐藏依赖选择器；头像预览为空时无占位图 | 低 | 加占位样式（背景色/虚线框） |
| G11 | admin.ts:169-186（sidebar） | ≤768px sidebar 依赖 `.is-open` 类，但**代码中无 toggle 按钮**（admin.ts 与 dashboard.ts 均未发现触发元素），窄屏无法打开导航 | **高** | 补 sidebar 抽屉 toggle（按钮 + 事件）或改默认展开 |
| G12 | admin-core.css:1005-1009 | `.admin-btn-primary` 硬编码 `color: #fff`，dark 下 OK 但非令牌化 | 低 | 用 `var(--admin-on-accent)` 或保持（低优先） |

## 文章管理（posts 面板 + features/admin/posts.ts + shared.ts）

| # | 位置 | 问题 | 严重度 | 修法 |
| --- | --- | --- | --- | --- |
| P1 | posts.ts:39-60（confirmByExactTitle） | 删除文章需**输入标题全名**确认——过于严苛（文章多时记不住标题）；且为 `window.confirm` 原生弹窗 | 中 | 改简化确认（如输入 slug 或双确认），后续可替换为样式化 dialog（低优先） |
| P2 | posts.ts:155-165 等 | 未保存提示用 `window.confirm`（3 处）+ main.ts:439-452 导航拦截 | 低 | 统一为样式化 dialog（defer，属 UX 债务已知项） |
| P3 | posts.ts:589 / admin.ts:143-148 | 保存/发布按钮**无 loading 态**（提交中可重复点击造成双写） | **高** | 提交时按钮 disabled + 文案变化 |
| P4 | shared.ts:147-159（renderAdminPostList） | 文章列表条目仅标题+日期+状态，无封面缩略/标签预览，信息密度低 | 低 | 可选增强（defer） |
| P5 | admin-core.css:827-839（markdown textarea） | 编辑器 textarea 无 min-height 约束（依赖 workspace min-height:400px），字号 14px 行高 1.7 尚可；textarea 无暗色语法高亮底色区分 | 低 | 低优先 |
| P6 | admin.ts:91-103 | 双栏 markdown 编辑/预览在 ≤1024px 已单栏；但编辑与预览 header 样式重复（`.admin-markdown-editor label>span` 与 `.admin-preview-header`） | 低 | 合并为 `.admin-pane-header` |
| P7 | admin.ts:56-70（filter-bar） | 筛选条 4 控件+2 按钮在 ≤640px 换行后无间距统一（gap 6px 过挤） | 低 | 断点内 gap 调整 |
| P8 | admin.ts:74-78（pagination） | 分页条 `justify-content: space-between` 在窄屏下"上一页/第x页/下一页"挤在一行，无 wrap | 低 | flex-wrap + 居中 |

## 友链管理（friends 面板 + friends.ts）

| # | 位置 | 问题 | 严重度 | 修法 |
| --- | --- | --- | --- | --- |
| F1 | admin.ts:210（搜索框） | 友链搜索框无独立样式（内联 style + form-input 借用），见 G5/G7 | 中 | 类化 + admin 样式 |
| F2 | admin.ts:215-249（friend 表单） | 表单字段 2 列 grid 在 640px 断点 OK（G 类已覆盖 admin-form-grid）；但**头像/URL 输入无校验提示**（required 空值仅浏览器默认气泡） | 中 | 表单校验提示统一（见 S1） |
| F3 | admin.ts:221-229（代码块导入） | details 折叠默认收起，无"未导入"角标提示 | 低 | 可选（defer） |
| F4 | friends.ts:375 | 删除友链 `window.confirm` 原生弹窗 | 低 | 统一 dialog（defer，与 P2 同批） |
| F5 | shared.ts:200-219（renderFriendList） | 友链列表行"已启用/排序"信息用 `small` 无视觉分级（状态无颜色标识） | 低 | 状态徽标（enabled/disabled 着色） |

## 关于页（about 面板 + content-settings.ts）

| # | 位置 | 问题 | 严重度 | 修法 |
| --- | --- | --- | --- | --- |
| A1 | admin.ts:241-283 | 4 个 fieldset 的 legend 均无样式（裸默认），与 admin-about-fieldset 边框有但 legend 未风格化 | 中 | 统一 legend 样式（同 G8） |
| A2 | admin-forms.css:521-528 | timeline 行日期 input 固定 `width:8rem`，窄屏 + 长详情会溢出 | 中 | 断点内让日期 input 自适应 |
| A3 | content-settings.ts（动态行渲染） | 段落/叙事/时间线行操作按钮（删除行）无样式确认、误触风险 | 低 | 行删除按钮 danger 化 |
| A4 | admin.ts:268-283 | 时间线/叙事动态区无"拖动排序"，仅手动顺序 | 低 | defer（功能增强） |

## 名片卡（profile 面板）

| # | 位置 | 问题 | 严重度 | 修法 |
| --- | --- | --- | --- | --- |
| PR1 | admin-forms.css:140-263 | 整段暗色硬编码（见 G2），亮色模式错乱 | **高** | 令牌化（随 G2 一并修） |
| PR2 | admin-forms.css:229-263（add-row） | 联系人添加行 select 固定 min-width 8rem，窄屏溢出 | 中 | 断点自适应 |
| PR3 | admin.ts:374-407 | 头像上传无尺寸/格式校验提示（仅 canvas 裁剪兜底） | 低 | 上传前校验提示（defer） |

## 媒体管理（media 面板 + media.ts）

| # | 位置 | 问题 | 严重度 | 修法 |
| --- | --- | --- | --- | --- |
| M1 | admin-forms.css:286-298 + admin.ts:332-333 | 工具栏 select 无样式（见 G6）；filter 按钮 !important（见 G3） | **高** | 类化 + 令牌化 |
| M2 | admin-forms.css:315-335 | 卡片选择框 hover 才显示（opacity 0→1），**触屏不可达** | 中 | 移动端常显 + 提供"全选"按钮 |
| M3 | admin.ts:357 / media.ts:211,283 | 批量删除按钮无数量角标联动动画；单删/批删均 window.confirm | 低 | 数量徽标 + 统一 dialog（defer） |
| M4 | admin-forms.css:342-344 | 未引用媒体仅边框变色，无 icon/文字标记，辨识度低 | 低 | 加角标 icon（低优先） |

## 站点设置（settings 面板 + site-settings.ts）

| # | 位置 | 问题 | 严重度 | 修法 |
| --- | --- | --- | --- | --- |
| S1 | admin.ts:281-316 | 全部设置字段 required 用浏览器默认气泡校验，无统一错误样式；保存成功后 success 提示 3 秒后是否消失？(site-settings.ts 核验无自动消失) | 中 | 表单校验 + 提示统一（自动消失） |
| S2 | admin.ts:322-327 | 友链模板 textarea 无等宽字体与行号（对 YAML 式模板不友好） | 低 | 等宽字体（同 friend 导入 textarea 风格） |
| S3 | admin.ts:293-334 | legend/fieldset 无样式（见 G8/A1 同源） | 中 | 统一修复 |

## 登录页（login.ts + admin-login.ts）

| # | 位置 | 问题 | 严重度 | 修法 |
| --- | --- | --- | --- | --- |
| L1 | admin-core.css:128-140 vs forms 输入 | 登录输入 min-height 42px 与后台表单 38px 不一致 | 低 | 统一为 38px 或视觉对齐 |
| L2 | admin.ts（后台）/ admin-login.ts | 后台品牌 mark「🌸」与登录页一致（可接受）；登录错误提示在按钮下方无图标 | 低 | 错误提示加 icon（统一 S1 体系） |

## 响应式 / 暗色模式总账

| # | 位置 | 问题 | 严重度 | 修法 |
| --- | --- | --- | --- | --- |
| R1 | admin-core.css:1065-1104 | 仅 1024/768 两个断点；**≤640px 断点缺失**（quick-meta 有 640 但 split/表单/工具栏无） | **高** | 补 640px 断点（列表单栏、工具条 wrap、按钮全宽可选） |
| R2 | admin-core.css:1107-1143 | dark 覆盖只到 quick-meta/login 输入与 4 个 class；editor/friend-list/media 卡片等大量区域靠 fallback 硬编码，暗色不完整 | 中 | 令牌化后暗色自动完整（G2 修复后复验） |
| R3 | admin-forms.css:117-138 | forms 暗色 override 仅覆盖 input/select/textarea 底色，select 下拉箭头 SVG 是亮色硬编码 `%236b6b6b` | 中 | 暗色下换箭头色（mask 或 CSS var） |
| R4 | admin-core.css:372-374 | `.admin-content` 固定 padding 20px 24px，窄屏无收缩 | 低 | 断点内收 padding |

## 统计

- 高：G2、G6、G11、P3、M1、PR1、R1（7 项）
- 中：G1、G3、G5、G7、G8、P1、F1、F2、A1、A2、M2、PR2、S1、S3、R2、R3（16 项）
- 低：G4、G9、G10、G12、P2、P4、P5、P6、P7、P8、F3、F4、F5、A3、A4、PR3、M3、M4、S2、L1、L2、R4（22 项）
- 合计 45 项

## 重构优先级建议（待用户确认）

1. **P0（高，先做）**：G2/PR1/M1 暗色硬编码令牌化 → G6 .admin-select → G11 sidebar toggle → P3 按钮 loading → R1 640px 断点 → R3 暗色箭头
2. **P1（中）**：G5 内联样式类化、G7 搜索框 admin 化、G8/A1/S3 fieldset/legend 统一、G1 亮色令牌、P1 删除确认简化、F2/S1 表单校验提示、A2/PR2 窄屏自适应、R2 暗色复验
3. **P2（低，可 defer）**：G4 标签样式归并、P2/F4/M3 统一 dialog、其余视觉打磨项
