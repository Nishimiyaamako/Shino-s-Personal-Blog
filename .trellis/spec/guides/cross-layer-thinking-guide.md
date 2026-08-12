# 跨层思考指南（Shino's Bolg）

> **目的**：动手前想清楚数据跨层流动的每一处边界。

---

## 本项目的层与边界

```
浏览器导航 → main.ts bootstrap → shell.renderApp → pages/* 纯渲染 → features/* hydration
                        ↓                                      ↑
                  data/api.ts (fetchJson<T>)             data/*.ts 指纹检测
                        ↓
               Rust routes → services → sqlx → Postgres
```

| 边界 | 常见坑（本项目实例） |
|------|---------------------|
| 后端 `models.rs` ↔ 前端 `types/*.ts` | camelCase 序列化、`skip_serializing_if` 省略可选键（theme/coverImageUrl/publishedAt 缺失时键不存在）；公开响应含前端未声明的多余键（id/publishedAt/displayOrder，前端 as 断言容忍，见契约测试 allowlist） |
| 服务层 ↔ DB | snake_case 列名 → camelCase 字段（SQL 别名/FromRow 映射）；TEXT ISO8601 时间戳（勿改 timestamptz） |
| 数据层 → 渲染层 | `data/` 模块先 normalize（applyRemote*）再缓存，渲染函数只消费 typed 数据；指纹变化才触发重渲染 |
| 渲染 → 交互 | 页面纯函数输出 HTML + `data-role` 定位，`features/` hydration 绑定事件并返回 teardown |
| Markdown 管线 | pulldown-cmark → ammonia 白名单 → 转义输出 `<pre data-language><code class="hljs language-x">`；前端 hljs 消费该标记（`features/post-detail.ts`），**不得**再让后端产出未经转义 HTML |

## 动手前必答

1. 数据从哪来、到哪去：`Source → API → normalize → 缓存/渲染 → hydration`，每个箭头处格式是什么？
2. 谁负责校验/转换？校验只在一处（服务层中文消息 400；前端类型靠 tsc）。
3. 改字段时改了几处？镜像类型（models.rs + types/*.ts + `__fixtures__/*.json` + api_compat 契约）必须四件套同步，跑两端测试验证。

## 检查清单

- [ ] 改后端字段后：`models.rs` → `tests/api_compat.rs` 契约 → `__fixtures__/*.json` → `types/*.ts` 全部同步，`cargo test` + `bun run test` 全绿
- [ ] 新增 API：`data/api.ts` 加 typed 包装（`fetchJson<T>`），页面不得直接 fetch
- [ ] 新页面：`pages/*.ts` 纯渲染 + `router/index.ts` ROUTE_RECORDS 注册 + `features/*.ts` hydration
- [ ] 动效/时序常量：定义在 `features/motion.ts`，消费方 import，不得在各文件重定义
- [ ] 时间戳：一律 ISO8601 毫秒（`now_iso()` / JS `toISOString()`），不得混用秒级
- [ ] cleanup 对称：setup 注册的监听/observer/timer 全部在 teardown 释放，页面切换不留泄漏
