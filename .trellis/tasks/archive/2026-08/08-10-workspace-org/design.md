# Design: 新结构设计

## 目标目录形态

```
Shino-s-Personal-Blog/
├── AGENTS.md                  # Trellis 块（init 生成，保留）+ 工作区治理内容（追加在 TRELLIS:END 之后）
├── .trellis/                  # init 生成：config.yaml / workflow.md / agents/ / scripts/ / tasks/ / workspace/
│   └── spec/                  # 分层规范（真实内容填充）
│       ├── guides/            # index.md + thinking guides（模板保留，可补充项目特定触发）
│       ├── architecture.md    # 系统架构总览（合并 ARCHITECTURE.zh-CN + .planning/ARCHITECTURE）
│       ├── tech-stack.md      # 技术栈（STACK.md）
│       ├── backend/           # index.md + directory-structure + conventions + api + testing + database + error-handling
│       └── frontend/          # index.md + directory-structure + conventions + testing + 模板保留项
├── docs/
│   ├── conventions.md         # 约定总纲（参照 OpenCode_Setting/docs/conventions.md 裁剪）
│   └── kb/
│       ├── deploy-ops.md      # 归纳 deploy/*.md 手册（1Panel 部署/备份恢复/发布检查）
│       └── integrations.md    # INTEGRATIONS.md 内容
├── deploy/                    # 保留：scripts/ nginx/ artifacts/（运行时资产）
├── llms.txt                   # 自动生成
├── .githooks/pre-commit       # 复制自 OpenCode_Setting，调用 tools/gen-file-index.sh
├── tools/gen-file-index.sh    # 复制并适配（仓库名、简介、排除集一致）
├── .gitignore                 # 追加 .omo/ 等
└── frontend/ backend/ .vscode/ .gitattributes  # 不动
```

## 关键决策

1. **AGENTS.md 双块结构**：`<!-- TRELLIS:START -->` 块由 trellis update 管理；治理内容写在其后（与 OpenCode_Setting 不同，那里 AGENTS.md 全为治理内容，因为 init 生成被覆盖——本项目保留 Trellis 块 + 治理块并存）。
2. **spec 层级**：architecture.md / tech-stack.md 放 spec 根（跨层）；backend/ frontend/ 各放层内规范；guides/ 保留模板。spec 文档遵循 trellis-spec-bootstrap 的 frontmatter schema（type/updated/title）。
3. **api.md 归属 backend**：路由/API 契约是后端合同，CLAUDE.md 的 route/API 表并入 spec/backend/api.md。
4. **CONCERNS 处置**：Security→backend 安全约定、Architecture/Code Quality→quality-guidelines、Feature Gaps/Test Coverage→作为历史快照丢弃（不迁移）。
5. **索引排除集**：与 OpenCode_Setting 一致（AGENTS.md、llms.txt、.omo/、.opencode/、.trellis/），docs/** + README.md 入索引。本项目无 README，gen-file-index.sh 需把头注释改为本项目名（标题用仓库名）。
6. **deploy/ 文档 vs 资产分离**：手册归 docs/kb/deploy-ops.md（单一入口引用 deploy/ 脚本路径），scripts/nginx 模板保留 deploy/ 原位置。

## 兼容性 / 回滚

- 全部删除操作可用 `git restore` 回滚（浅克隆本地仓库，删除先 commit 前可完整恢复）。
- spec/ 模板文件被覆盖前为 git 未跟踪状态（.trellis/ 尚未提交），覆盖无回滚风险。
- 分两笔提交：① 新增结构（spec/docs/AGENTS/hooks/索引工具）② 删除旧文件——回滚粒度清晰。
