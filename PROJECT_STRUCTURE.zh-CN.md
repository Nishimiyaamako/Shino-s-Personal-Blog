# Personal Blog 项目结构说明（中文注释版）

本文档用于集中说明当前 v0 框架下每个目录和文件的用途。

## 1) 注释版目录树

```text
.
├─ # Personal Blog.md                         # 原始项目蓝图文档（保留）
├─ PROJECT_STRUCTURE.zh-CN.md                 # 本文件：项目结构中文注释总览
├─ frontend/                                  # 前端工程根目录
│  ├─ package.json                            # 前端包信息占位（依赖与脚本后续补充）
│  ├─ public/                                 # 前端静态资源目录（无需构建直接提供）
│  │  └─ .gitkeep                             # 空目录占位，确保 Git 跟踪目录
│  └─ src/                                    # 前端源码目录
│     ├─ main.ts                              # 前端应用入口占位文件
│     ├─ assets/                              # 图片、字体、图标等素材目录
│     │  └─ .gitkeep                          # 空目录占位
│     ├─ components/                          # 可复用 UI 组件目录
│     │  └─ .gitkeep                          # 空目录占位
│     ├─ pages/                               # 页面级组件目录（路由页面）
│     │  └─ .gitkeep                          # 空目录占位
│     ├─ router/                              # 前端路由配置目录
│     │  └─ .gitkeep                          # 空目录占位
│     ├─ styles/                              # 全局样式与主题样式目录
│     │  └─ .gitkeep                          # 空目录占位
│     ├─ content/                             # 前端侧内容组织目录（Markdown）
│     │  ├─ posts/                            # 博客文章 Markdown 内容目录
│     │  │  └─ .gitkeep                       # 空目录占位
│     │  └─ pages/                            # 关于页等静态页面 Markdown 目录
│     │     └─ .gitkeep                       # 空目录占位
│     ├─ data/                                # 本地数据缓存/映射等目录
│     │  └─ .gitkeep                          # 空目录占位
│     ├─ utils/                               # 前端工具函数目录
│     │  └─ .gitkeep                          # 空目录占位
│     ├─ types/                               # 前端类型定义目录
│     │  └─ .gitkeep                          # 空目录占位
│     └─ config/                              # 前端站点配置目录
│        └─ .gitkeep                          # 空目录占位
├─ backend/                                   # 后端工程根目录
│  ├─ package.json                            # 后端包信息占位（依赖与脚本后续补充）
│  └─ src/                                    # 后端源码目录
│     ├─ index.ts                             # 后端入口占位文件
│     ├─ routes/                              # API 路由定义目录
│     │  └─ .gitkeep                          # 空目录占位
│     ├─ services/                            # 业务服务层目录
│     │  └─ .gitkeep                          # 空目录占位
│     ├─ middleware/                          # 中间件目录
│     │  └─ .gitkeep                          # 空目录占位
│     ├─ types/                               # 后端类型定义目录
│     │  └─ .gitkeep                          # 空目录占位
│     └─ utils/                               # 后端工具函数目录
│        └─ .gitkeep                          # 空目录占位
├─ docs/                                      # 项目文档目录
│  ├─ blueprint.md                            # 项目蓝图副本（复制自 # Personal Blog.md）
│  └─ content-spec.md                         # 内容规范文档占位
└─ deploy/                                    # 部署相关目录
   ├─ nginx/                                  # Nginx 配置目录
   │  └─ .gitkeep                             # 空目录占位
   └─ scripts/                                # 部署脚本目录
      └─ .gitkeep                             # 空目录占位
```

## 2) 前端路由边界（文档级契约）

当前预留路由：

- `/` 首页
- `/posts` 文章列表页
- `/posts/:slug` 文章详情页
- `/tags` 标签总览页
- `/tags/:tag` 标签详情页
- `/archive` 归档页
- `/about` 关于页
- `/404` 未找到页面

## 3) 后端 API 边界（文档级契约）

第一阶段预留基础接口：

- `/api/health`
- `/api/stats`

后续扩展接口（暂不实现）：

- `/api/search`
- `/api/comment`
- `/api/admin/*`
