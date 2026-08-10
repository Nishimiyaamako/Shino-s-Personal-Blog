# Frontend Testing

> 前端测试约定（现状 + 指引）。

## Test Framework

- **无测试框架配置**：`frontend/src/` 无 `.test.ts`/`.spec.ts` 文件，`package.json` 无 test 脚本
- 验证方式：`bun run typecheck`（编译期）+ 手动浏览器验证

## 当前风险

- Vanilla SPA 手动 DOM 操作模式对缺失元素特别敏感，UI bug 只能靠人工发现
- 无组件测试、无路由测试、无渲染测试、无行为测试

## 新增测试指引（如需引入）

- 优先级：admin 关键流冒烟测试（登录、文章保存/加载）→ 路由解析测试 → 纯函数测试（utils、指纹函数）
- 工具建议：Bun Test（与后端一致，无额外依赖）；DOM 层测试需引入 happy-dom/jsdom 场景
- utils/date.ts、utils/escape-html.ts、utils/search.ts 等纯函数最易测试

## 质量门

- 当前最低要求：`cd frontend && bun run typecheck && bun run build` 通过
- 手动回归：公开页面渲染、admin 登录/保存/发布流程、上传、搜索

## 约束

- 不引入重型 E2E 框架（Playwright/Cypress）——个人博客项目体量不符，除非明确需求
