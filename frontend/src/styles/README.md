# Styles README

## 导入顺序

`main.ts` 只引入 `global.css`，其余样式通过 manifest 聚合：

1. `tokens.css`：全局 token、主题预览、dark mode、响应式 token
2. `base.css`：reset、文本与链接、`app-shell` 背景装饰
3. `layout.css`：header/nav/main/footer、通用页面壳层布局
4. `content.css`：共享内容壳、about/profile/archive/friends/markdown
5. `posts.css`：post list/card、tag、post detail、theme rail、TOC、floating actions
6. `motion.css`：keyframes、动效状态类、`prefers-reduced-motion` 兜底

> Import order matters。新增样式时优先放进正确分层，而不是回填到 `global.css`。

## 何时使用全局 token

满足下面任一条件时，优先放进 `tokens.css`：

- 被 3+ 个区域复用
- 属于全局语义（如 focus ring、transition、surface、spacing、motion）
- 会同时被 light/dark 或多个组件共享

本次已统一的典型 token：

- `--motion-transition-feedback`
- `--motion-transition-state`
- `--focus-ring-outline-soft`
- `--focus-ring-outline-strong`
- `--control-surface-soft`
- `--control-shadow-hover`

## 何时使用局部 recipe 变量

如果公式只服务单一模块或单一视觉模式，不要强行升级成全局 token。

推荐做法：

- 在组件根选择器上声明局部变量
- 变量名带模块前缀，避免跨模块污染
- 只抽“有语义”的值，不为一次性 `color-mix()` 单独建全局 token

适合留在局部的例子：

- `about-*`
- `post-cover-*`
- `floating-scroll-*`

## TS 什么时候走 `dom-style.ts`

凡是运行时读写 CSS 自定义属性，默认走 `frontend/src/utils/dom-style.ts`：

- `setCssVar`：写字符串值（如 `--motion-index`、`--route-enter-delay`）
- `setCssPxVar`：写像素值（内部会 `Math.round`）
- `clearCssVar`：移除运行时写入的自定义属性
- `readCssLengthPx`：读取 `rem` / `px` / 数字型 CSS 变量并转为像素

适用场景：

- 动效 stagger index
- floating button 定位偏移
- TOC 进度高度
- 运行时布局补偿

不建议用它做的事：

- 批量 class 状态切换
- 通用动画算法抽象
- 一次性的普通内联样式赋值
