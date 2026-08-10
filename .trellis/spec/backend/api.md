# Backend API Contract

> Shino's Bolg HTTP API 完整清单。公开 API（`/api/*`）无需认证；管理 API（`/api/admin/*`）需 Bearer JWT。

## 公开 API

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/api/health` | 健康检查 | 无 |
| `GET` | `/api/posts` | 分页已发布文章列表 | `?page=1&pageSize=20&tag=` |
| `GET` | `/api/posts/:slug` | 文章详情 | slug 路径参数 |
| `GET` | `/api/home/featured` | 精选文章 | `?limit=5` |
| `GET` | `/api/friend-links` | 公开友链列表 | 无 |
| `GET` | `/api/about` | 关于页内容 | 无 |
| `GET` | `/api/profile-card` | 名片卡数据 | 无 |
| `GET` | `/api/site-config` | 站点配置 | 无 |
| `GET` | `/api/search` | 全文搜索 | `?q=关键词&limit=10` |

## 管理 API（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/auth/login` | 管理员登录（无需认证） |
| `GET` | `/api/admin/posts` | 获取所有文章（含草稿） |
| `POST` | `/api/admin/posts` | 创建文章 |
| `PATCH` | `/api/admin/posts/:id` | 更新文章 |
| `DELETE` | `/api/admin/posts/:id` | 删除文章 |
| `POST` | `/api/admin/posts/:id/publish` | 发布文章 |
| `POST` | `/api/admin/posts/:id/unpublish` | 取消发布 |
| `PATCH` | `/api/admin/posts/:id/featured` | 切换精选状态 |
| `POST` | `/api/admin/uploads/image` | 上传图片 |
| `GET` | `/api/admin/uploads` | 媒体资源列表 |
| `DELETE` | `/api/admin/uploads` | 删除媒体资源（`?url=`） |
| `GET` | `/api/admin/friend-links` | 获取所有友链 |
| `POST` | `/api/admin/friend-links` | 创建友链 |
| `PATCH` | `/api/admin/friend-links/:id` | 更新友链 |
| `DELETE` | `/api/admin/friend-links/:id` | 删除友链 |
| `GET` | `/api/admin/about` | 获取关于页 |
| `PATCH` | `/api/admin/about` | 更新关于页 |
| `GET` | `/api/admin/profile-card` | 获取名片卡 |
| `PATCH` | `/api/admin/profile-card` | 更新名片卡 |
| `GET` | `/api/admin/site-config` | 获取站点配置 |
| `PATCH` | `/api/admin/site-config` | 更新站点配置 |
| `POST` | `/api/admin/search/rebuild` | 重建搜索索引 |

## 静态文件

| 路径 | 说明 |
|------|------|
| `GET /uploads/images/:fileName` | 上传图片（文件名正则校验 `/^[A-Za-z0-9._-]+$/`） |

## 响应约定

- 成功：Elysia 自动 JSON 序列化对象
- 失败：`{ error: string }` + HTTP 状态码（400 校验失败 / 401 未认证 / 404 不存在）
- 认证头：`Authorization: Bearer <token>`，token 存 `localStorage['shino.admin.token']`

## 认证守卫模式

```ts
const admin = await requireAdmin(request, set);
if (!admin) return { error: 'Unauthorized' };
```

每个管理路由处理函数开头调用，非 Elysia 中间件。
