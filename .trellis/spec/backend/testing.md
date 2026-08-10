# Backend Testing

> 后端测试约定（Bun Test 集成测试）。

## Test Framework

- **Runner**：Bun 内置测试运行器（`bun test`），import 自 `bun:test`：`describe`、`test`、`expect`、`beforeAll`、`afterAll`
- **断言**：Bun 内置 `expect`（Jest 兼容 API）
- **配置**：无独立测试配置，`bun test` 自动发现 `*.test.ts`

```bash
cd backend && bun run test
```

## Test File Organization

- 位置：`backend/src/__tests__/api.test.ts`（全部 API 集成测试集中在一个文件）
- 命名：套件 `'admin auth'`、`'post publish and search'`、`'uploads'`；用例 `'login success with default admin'`

## Test Structure

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createApp } from '../app';

const testDatabasePath = resolve('/tmp', `shino-blog-api-test-${Date.now()}.sqlite`);
let appInstance: Awaited<ReturnType<typeof createApp>>;

beforeAll(async () => {
  appInstance = await createApp({ databasePath: testDatabasePath });
});

afterAll(() => {
  appInstance.dbContext.sqlite.close();
  rmSync(testDatabasePath, { force: true });
});
```

- `beforeAll` 用临时 SQLite 路径创建完整 Elysia app（触发迁移 + 播种默认管理员）
- `afterAll` 关闭连接并清理临时库文件及 WAL/SHM 兄弟文件

## Mocking

**无 mocking 库**。全部为集成测试：
1. 创建 app（临时数据库路径）
2. `appInstance.app.handle(new Request(...))` 发 HTTP 请求
3. 断言状态码与 JSON 体

**不 mock**：数据库（真实 SQLite）、服务（无服务级 mock）、认证（login helper 获取真实 JWT）。

## Fixtures and Factories

- 测试内自包含 helper：`requestJson()`（包装 handle + JSON body + Bearer token）、`requestForm()`、`login()`（完整登录流返回 JWT）
- 无独立 fixture 文件，测试数据为用例内联 typed 对象字面量

## Coverage

- 无覆盖率阈值强制
- **已覆盖**：公开端点（列表/详情/精选/搜索含中文）、admin 认证（登录/拒绝）、文章 CRUD + 过滤 + 分页 + slug 重复拒绝 + 发布生命周期、友链 CRUD、上传（MIME/大小拒绝、成功返回 URL）
- **未覆盖**：about API、profile-card API、site-config API、媒体列表/删除、前端（无测试框架）

## Common Patterns

```typescript
// 认证流
test('reject admin endpoint without token', async () => {
  const response = await requestJson('/api/admin/posts');
  expect(response.status).toBe(401);
});

// 错误路径
test('reject duplicated slug when creating posts', async () => {
  await requestJson('/api/admin/posts', { method: 'POST', token, body: { slug: 'xxx' } });
  const response = await requestJson('/api/admin/posts', { method: 'POST', token, body: { slug: 'xxx' } });
  expect(response.status).toBe(400);
});
```

## 新增测试指引

- 新端点测试先看 `api.test.ts` 的既有 helper 是否复用，不要另起 fixture
- 管理端点用例 = 无 token 401 + 有效 token 主流程 + 边界（重复 slug、非法 MIME）
