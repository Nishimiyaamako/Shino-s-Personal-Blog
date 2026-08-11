# Backend API Contract

> Shino's Bolg HTTP API 完整清单（Rust 后端版）。公开 API（`/api/*`）无需认证；管理 API（`/api/admin/*`）需 Bearer JWT。

## 公开 API

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/api/health` | 健康检查 | 无 |
| `GET` | `/api/posts` | 分页已发布文章列表 | `?page=1&pageSize=20&tag=` |
| `GET` | `/api/posts/:slug` | 文章详情 | slug 路径参数 |
| `GET` | `/api/friend-links` | 公开友链列表 | 无 |
| `GET` | `/api/about` | 关于页内容 | 无 |
| `GET` | `/api/profile-card` | 名片卡数据 | 无 |
| `GET` | `/api/site-config` | 站点配置（含 slogan） | 无 |
| `GET` | `/api/search` | 全文搜索 | `?q=关键词&limit=10` |

> 注：`/api/home/featured` 已废弃（精选功能整体移除），不在契约内。

## 管理 API（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/auth/login` | 管理员登录（无需认证） |
| `GET` | `/api/admin/posts` | 获取所有文章（含草稿，q/status/tag/page/pageSize 筛选） |
| `GET` | `/api/admin/posts/:id` | 单篇详情 |
| `POST` | `/api/admin/posts` | 创建文章 |
| `PATCH` | `/api/admin/posts/:id` | 更新文章 |
| `DELETE` | `/api/admin/posts/:id` | 删除文章 |
| `POST` | `/api/admin/posts/:id/publish` | 发布文章 |
| `POST` | `/api/admin/posts/:id/unpublish` | 取消发布 |
| `POST` | `/api/admin/posts/rebuild-search-index` | 重建搜索索引（仅 published 入镜像） |
| `POST` | `/api/admin/uploads/image` | 上传图片（multipart file） |
| `GET` | `/api/admin/media` | 媒体资源列表（page/pageSize/sort/order/filter） |
| `DELETE` | `/api/admin/media/:id` | 删除媒体资源 |
| `GET` | `/api/admin/friend-links` | 获取所有友链 |
| `POST` | `/api/admin/friend-links` | 创建友链 |
| `PATCH` | `/api/admin/friend-links/:id` | 更新友链 |
| `DELETE` | `/api/admin/friend-links/:id` | 删除友链 |
| `GET` | `/api/admin/about` | 获取关于页 |
| `PATCH` | `/api/admin/about` | 更新关于页 |
| `GET` | `/api/admin/profile-card` | 获取名片卡 |
| `PATCH` | `/api/admin/profile-card` | 更新名片卡 |
| `GET` | `/api/admin/site-config` | 获取站点配置 |
| `PATCH` | `/api/admin/site-config` | 更新站点配置（含 slogan） |

> 注：`PATCH /api/admin/posts/:id/featured` 已废弃（featured 移除）。

## 静态文件

| 路径 | 说明 |
|------|------|
| `GET /uploads/images/:fileName` | 上传图片（文件名正则校验 `/^[A-Za-z0-9._-]+$/`，非法 400 / 不存在 404） |

## 响应约定

- 成功：Axum 自动 JSON 序列化（`null` 字段省略键）
- 失败：`{ error: string }` + HTTP 状态码（400 校验失败 / 401 未认证 / 404 不存在 / 500 服务器内部错误）
- 认证头：`Authorization: Bearer <token>`，token 存 `localStorage['shino.admin.token']`
- 列表响应形状：`{ items, total, page, pageSize }`（page 从 1 起，pageSize 默认 20，0/负值按旧语义归一）

## 认证守卫模式

```rust
// src/auth.rs — AdminAuth FromRequestParts 提取器，自动应用到 /api/admin/* 路由
pub struct AdminAuth { pub id: i32, pub username: String }
```

每个管理路由 handler 签名接收 `AdminAuth`，提取器在 body 消费前完成鉴权；失败返回 401 `{ error: 'Unauthorized' }`。

## 上传约束

- MIME 白名单（image/* 子集，以 `src/services/media.rs` 为准）
- 大小上限 5MB
- 文件名安全正则 + 时间戳/uuid 命名防冲突
