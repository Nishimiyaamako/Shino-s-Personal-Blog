# Error Handling

> 后端错误处理约定。

## Overview

后端无集中错误中间件（无 Elysia `onError` hook）。校验失败抛出 `Error` 实例，路由 handler 内 try/catch 捕获并格式化为 `{ error: string }` JSON 响应。

## Error Types

- 无自定义错误类。全部为普通 `Error` 实例
- 校验失败消息为**中文**（如 `new Error('title 不能为空')`），直接透传给前端显示

## Error Handling Patterns

```ts
// 服务层：抛中文 Error
assertPostInput(input);  // throws new Error('title 不能为空')

// 路由层：try/catch + toErrorPayload
try {
  const post = await updatePost(dbContext, id, body);
  return post;
} catch (error) {
  set.status = 400;
  return toErrorPayload(error);
}
```

- `toErrorPayload(error: unknown): { error: string }`（`routes/helpers.ts`）规范化 Error 实例为 `{ error: error.message }`
- 认证失败：`requireAdmin()` 置 `set.status = 401` 返回 null，调用方返回 `{ error: 'Unauthorized' }`
- 未捕获异常无全局兜底，会返回未格式化 500（已知债务，见 architecture.md）

## API Error Responses

| 场景 | HTTP 状态 | 响应体 |
|------|-----------|--------|
| 校验失败 | 400 | `{ error: '中文消息' }` |
| 未认证/无效 token | 401 | `{ error: 'Unauthorized' }` |
| 资源不存在 | 404 | `{ error: ... }` |
| 未捕获异常 | 500 | 未格式化 |

## Common Mistakes

- **路由层混入业务逻辑**：路由只做解析 + 调用 + 格式化，业务校验在服务层
- **忘记设置 `set.status`**：返回错误体但不置状态码会让前端误判成功
- **新增路由不包 try/catch**：会导致未格式化 500
