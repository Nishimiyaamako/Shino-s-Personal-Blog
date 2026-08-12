# 思考指南索引

> **目的**：动手前展开思考，覆盖容易漏掉的边界与复用点。

## 可用指南

| 指南 | 用途 | 何时读 |
|------|------|--------|
| [跨层思考指南](./cross-layer-thinking-guide.md) | 数据流经 routes→services→DB→data→pages→features 各层边界的格式/校验/同步 | 新 API、新页面、改字段、跨层功能 |
| [代码复用思考指南](./code-reuse-thinking-guide.md) | 复用 utils/components/data 既有实现，识别重复模式 | 写新函数/组件/常量之前 |

## 快速触发清单

### 跨层场景（读跨层指南）
- [ ] 新增/修改 API 端点或响应字段
- [ ] 改动后端 `models.rs`（连带前端类型 + 契约测试四件套）
- [ ] 新增页面或 feature（pages + router + features + data 四步）
- [ ] 时间戳/可选字段/序列化形状相关改动

### 复用场景（读复用指南）
- [ ] 要写新工具函数（先搜 `utils/`）
- [ ] 要写新 fetch 调用（先看 `data/api.ts`）
- [ ] 重复的 DOM 交互/常量出现第 2 次
- [ ] 新 UI 片段（先看 `components/`）

## 本仓库的教训沉淀

- main.ts 3400 行单体是"没分层"的代价（2026-08-12 已拆分）：新增代码按 pages/features/data/components 归属落位，不往入口文件堆。
- 前后端类型漂移靠契约测试兜底：改字段不跑两端测试 = 必然漂移。
- 动效常量散落是"没先搜"的典型：一律从 `features/motion.ts` import。
