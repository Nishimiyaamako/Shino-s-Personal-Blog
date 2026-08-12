# spec 全量刷新：对照真实代码库校正 .trellis/spec/

## Goal

审查 `.trellis/spec/` 全部 19 个文件与实际代码库的一致性，修正漂移（特别是 2026-08-12 main.ts 拆分、hljs、契约测试落地后），补真实示例、删模板残留，使 spec 描述的是"现在存在的项目"。

## Background

- 触发：08-12-tech-debt-architecture 已更新 architecture.md / frontend/{type-safety,directory-structure,testing}.md 四处，但其余 spec 文件未审查。
- 已知待查漂移点：frontend/{component-guidelines,state-management,quality-guidelines}.md 是否引用旧 main.ts 结构/旧组件清单；backend/*.md 是否与当前 modules（routes/public+admin、services/*、markdown.rs、error.rs）一致；tech-stack.md 版本信息；guides/ 是否有占位或过时示例。

## Requirements

1. 逐文件对照真实代码库审查（frontend 8 + backend 8 + guides 3 + architecture + tech-stack）。
2. 修正漂移：文件路径、模块职责、函数/组件清单、命令、测试现状（52 用例）、依赖（highlight.js）。
3. 每个重要建议指向真实文件或重复出现的本地模式；删模板残留/空标题/通用套话。
4. index.md 与实际文件集一致。

## Acceptance Criteria

- [ ] 所有 spec 文件无占位符（TBD/待补/xxx 示例）
- [ ] frontend spec 反映拆分后结构（main.ts bootstrap + shell + motion + features/* + __fixtures__）
- [ ] backend spec 与当前后端源码一致（模块清单、错误约定、测试现状）
- [ ] 无过时引用（如"main.ts 3400 行"、"Elysia"等遗留描述）
- [ ] index.md 文件集与实际一致
- [ ] 自检：grep 占位符/遗留词为零

## Notes

- 轻量-medium 任务：PRD-only 规划，实施按"每包一组审查→更新→验证"推进。
- 与 08-12-tech-debt-architecture 已更新的 4 个文件不重复劳动，只复核交叉引用。
