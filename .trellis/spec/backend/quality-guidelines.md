# Quality Guidelines

> 后端代码质量规范与质量门。

## Overview

无 ESLint/Prettier/Biome 配置，格式约定靠纪律。TypeScript `strict: true` 是主要静态防线。质量门为 `bun run typecheck && bun run test && bun run build`。

## Forbidden Patterns

- **路由层写业务逻辑**：路由只做解析/认证/响应格式化，业务在 services 层
- **服务层使用 Drizzle 查询构建器**：保持原始 SQL 策略一致性（除非明确重构任务）
- **位置参数传大量输入**：服务函数接收 typed 输入对象（`UpsertPostInput`）
- **引入前端框架**（React/Vue/Svelte）或后端中间件框架模式：保持 Vanilla + 内联守卫现状
- **在文档中重新引入 "backend placeholder/scaffold" 描述**（历史教训）

## Required Patterns

- **严格模式**：所有新代码必须通过 `tsc --noEmit`（strict）
- **服务层分层**：新增业务域 = services 新文件 + DatabaseContext 注入
- **中文校验消息**：`throw new Error('中文消息')`
- **路由 try/catch + toErrorPayload**：每个管理路由处理函数必须有错误格式化
- **requireAdmin 守卫**：每个管理路由开头调用
- **命名**：文件 kebab-case、函数 camelCase、类型 PascalCase
- **格式约定**：无分号、单引号、2 空格缩进
- **导入顺序**：node 内置 → 外部库 → config → db → auth → services → routes/helpers

## Testing Requirements

- 后端改动需通过 `bun run test`（`src/__tests__/api.test.ts` 集成测试）
- 新增端点/服务建议补充集成测试用例（覆盖公开/管理 API）
- 已知覆盖缺口：about、profile-card、site-config、media 生命周期、publish/unpublish 流程（见 testing spec）

## Code Review Checklist

- [ ] 无泄漏的默认凭据/密钥（env 默认值安全、未提交 .env）
- [ ] 原始 SQL 变更后全局搜索受影响列名
- [ ] 路由薄实现，服务层承载逻辑
- [ ] 错误路径有状态码 + `{ error }` 体
- [ ] 类型通过 strict 检查
- [ ] 不破坏 FTS5 索引同步与降级路径
