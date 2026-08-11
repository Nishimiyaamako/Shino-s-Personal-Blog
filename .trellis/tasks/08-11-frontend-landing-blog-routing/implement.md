# 前端：landing 页 + 博客路由迁移 — Implement

## 执行顺序（每个 [块] 完成后可独立提交）

### [块 1] 路由迁移 + landing 页（前端为主）
1. 核验 backend/.env 入库问题（父任务固定首步，凭据红线）。
2. `router/index.ts`：新路由表（/blog 系 + 移除 /admin/featured）、PRIMARY_NAV_LINKS 重排、resolveAdminModule 去 featured。
3. 新增 `pages/landing.ts`（Hero + 分区卡片 + 关于摘要 + 社交关注），删除 `pages/home.ts`。
4. `styles/pages/landing.css` 新增；`main.ts` 联动（shouldRenderProfileCard / scrollTop / PAGE_STAGGER_SELECTORS / POST_CARD_MOTION_SELECTORS）。
5. 硬编码链接扫描改 /blog 前缀（post-list.ts / post-detail.ts / archive.ts / tag-detail.ts / public-runtime.ts 搜索链接与路径判断）。
6. nginx 三份模板加 301 规则。
7. 验证：typecheck + build + local-verify + 手动冒烟。提交。

### [块 2] 精选功能废弃（前后端同步）
8. 后端：schema 删 is_featured/featured_order → 迁移；services/posts.ts 清理；routes/public.ts 删 /home/featured；routes/admin.ts 删 /posts/:id/featured；types/api.ts 清理。
9. 后端测试：api.test.ts 移除 featured 用例；`bun test` 通过。
10. 前端：data/posts.ts 删 loadHomeFeaturedPosts；types/content.ts、types/api.ts 清理；utils/search.ts 质量分去 featuredOrder；admin.ts / dashboard.ts / shared.ts / posts.ts / login.ts 去 featured 引用；router 清理已完成。
11. 验证：前后端 typecheck + 测试 + 冒烟。提交。

### [块 3] slogan 配置
12. 后端：schema site_config 加 slogan → 迁移；services/site-config.ts（默认值/查询/保存）；types/api.ts；routes/admin.ts PATCH 校验。
13. 前端：data/site-config.ts（默认+normalize）；config/site.ts 默认值；admin.ts settings 表单加输入项。
14. 前端 landing Hero 渲染 slogan（fallback ''）。
15. 验证：typecheck + 测试 + 后台保存 slogan 生效。提交。

## 验证命令

```bash
# 前端（frontend/）
npm run typecheck && npm run build
# 后端（backend/）
bun run typecheck && bun test
# 仓库根
./deploy/scripts/local-verify.sh
grep -rn '⚠ 待核验' . --include='*.md'
grep -rnE '(password|passwd|api[_-]?key|token|secret|private[_-]?key)[[:space:]]*[:=]' . --include='*.md'
```

## 关键文件（改动清单）

| 文件 | 改动 |
| --- | --- |
| frontend/src/router/index.ts | 路由表、导航、featured 移除 |
| frontend/src/pages/landing.ts（新）/ home.ts（删） | landing 渲染 |
| frontend/src/styles/pages/landing.css（新） | landing 样式 |
| frontend/src/main.ts | 联动函数更新 |
| frontend/src/components/post-list.ts | /blog 前缀 |
| frontend/src/pages/{post-detail,archive,tag-detail}.ts | /blog 前缀 |
| frontend/src/features/public-runtime.ts | 搜索链接 + 水合路径 |
| frontend/src/data/posts.ts | 删 featured |
| frontend/src/utils/search.ts | 质量分去 featured |
| frontend/src/types/{content,api}.ts | 类型清理 + slogan |
| frontend/src/data/site-config.ts | slogan 默认/normalize |
| frontend/src/config/site.ts | slogan 默认 |
| frontend/src/pages/admin.ts | 去 featured 面板 + settings 加 slogan |
| frontend/src/features/admin/*.ts | 去 featured 引用 |
| backend/src/db/schema.ts | 删 featured 列 + 加 slogan 列 + 迁移 |
| backend/src/services/{posts,site-config}.ts | 清理/加字段 |
| backend/src/routes/{public,admin}.ts | 删 featured API、slogan 保存 |
| backend/src/types/api.ts | 类型同步 |
| backend/src/__tests__/api.test.ts | 移除 featured 用例 |
| deploy/nginx/*.conf（3 份） | 301 规则 |

## 风险点与回滚

- **风险**：public-runtime.ts 水合路径漏改 → landing 错误加载文章列表（验证点：landing 无文章请求日志）。
- **风险**：motion 动画选择器与 landing 不匹配 → 首屏无动画（PAGE_STAGGER_SELECTORS 补充验证）。
- **回滚**：每块独立提交，git revert 单块即回退，互不耦合。
- **兼容**：slogan 后端未上线时前端 fallback ''，无 500。

## 提交前自检

- [ ] typecheck（前后端）通过
- [ ] bun test 通过（无 featured 用例）
- [ ] build 通过，local-verify 通过
- [ ] 自检三命令（grep 待核验 / 凭据 / hooksPath）
- [ ] 手动冒烟清单：landing、/blog 全家族、搜索跳转、friends/about、后台（无精选模块、slogan 可存）
