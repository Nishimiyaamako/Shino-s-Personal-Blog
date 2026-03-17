# Personal Blog

一个基于 **Vite + TypeScript + Elysia.js** 构建的个人博客项目。

当前阶段的目标不是直接构建完整的全栈博客系统，而是先完成一个 **静态内容优先、结构清晰、可持续扩展** 的个人博客网站，并为未来的后端能力预留接口边界。

---

## 项目简介

本项目用于构建个人博客网站，第一阶段重点关注以下内容：

- 搭建一个可上线的个人博客前台
- 使用 Markdown 管理文章内容
- 建立清晰的前后端分层结构
- 为未来搜索、评论、统计、后台等功能预留 API 边界
- 通过实际项目训练现代 Web 工程化思维

项目的核心理念是：

> 先把博客本体做好，再逐步扩展动态能力。

---

## 技术栈

### Frontend
- Vite
- TypeScript

前端负责：

- 页面展示
- 页面路由
- Markdown 内容渲染
- 样式与视觉效果
- 与后端 API 对接

### Backend
- Elysia.js

后端负责：

- 提供 `/api/*` 接口
- 健康检查
- 统计接口占位
- 为未来搜索、评论、后台等功能扩展做准备

### Content
- Markdown
- 本地静态资源
- 站点配置文件

---

## 项目目标

### 第一阶段目标
- 完成博客基础页面结构
- 支持 Markdown 文章渲染
- 实现文章列表与文章详情页
- 支持标签页与归档页
- 提供关于页
- 建立后端 API 基础边界
- 完成基础部署准备

### 当前不包含
以下能力暂不在第一阶段范围内：

- 数据库
- Redis
- 登录系统
- 后台管理系统
- 评论系统
- 富文本编辑器
- 多用户能力
- 复杂搜索系统

---

## 页面结构

当前规划的页面包括：

- `/` 首页
- `/posts` 文章列表页
- `/posts/:slug` 文章详情页
- `/tags` 标签总览页
- `/tags/:tag` 标签详情页
- `/archive` 归档页
- `/friends` 友链页
- `/about` 关于页
- `/404` 未找到页面

---

## API 规划

第一阶段仅预留轻量接口：

- `/api/health`
- `/api/stats`
- `/api/friends`

后续可扩展：

- `/api/search`
- `/api/comment`
- `/api/admin/*`

---

## 项目结构

```text
blog-project/
├─ frontend/
│  ├─ public/
│  ├─ src/
│  │  ├─ assets/
│  │  ├─ components/
│  │  ├─ pages/
│  │  ├─ router/
│  │  ├─ styles/
│  │  ├─ content/
│  │  │  ├─ posts/
│  │  │  └─ pages/
│  │  ├─ data/
│  │  ├─ utils/
│  │  ├─ types/
│  │  ├─ config/
│  │  └─ main.ts
│  └─ package.json
│
├─ backend/
│  ├─ src/
│  │  ├─ routes/
│  │  ├─ services/
│  │  ├─ middleware/
│  │  ├─ types/
│  │  ├─ utils/
│  │  └─ index.ts
│  └─ package.json
│
├─ docs/
│  ├─ blueprint.md
│  └─ content-spec.md
│
└─ deploy/
   ├─ nginx/
   └─ scripts/
