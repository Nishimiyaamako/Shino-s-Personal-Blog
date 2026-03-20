# 1Panel 快速上线（静态站点 + 公安联网验证）

> 目标：最快让站点公网可访问、HTTPS 正常、SPA 刷新不 404，并能核验备案信息。

## 1) 本地构建并打包前端

```bash
./deploy/scripts/build-frontend-dist.sh
```

执行后会生成：

- `deploy/artifacts/frontend-dist-YYYYMMDD-HHMMSS.tar.gz`
- `deploy/artifacts/frontend-dist-latest.tar.gz`（推荐上传这个，始终指向最新构建）

## 2) 1Panel 创建静态站点

1. 进入 **网站** -> **创建网站** -> 选择 **静态网站**。
2. 绑定已备案域名（例如 `example.com`）。
3. 网站目录保持默认或自定义一个明确路径（后续上传文件到该目录）。

## 3) 上传构建产物

1. 把 `deploy/artifacts/*.tar.gz` 上传到 1Panel 网站根目录。
2. 在 1Panel 文件管理中解压归档。
3. 确认网站根目录直接包含 `index.html` 与 `assets/`（不要多一层 `dist/`）。

## 4) 配置 Nginx SPA 回退

1. 进入 1Panel 该网站的配置文件页。
2. 在对应 `server {}` 中加入 `deploy/nginx/1panel-static-spa-snippet.conf` 内容：
   - `try_files $uri $uri/ /index.html;`
3. 保存并重载 Nginx。

## 5) 配置 HTTPS

1. 进入 1Panel 该网站 -> SSL。
2. 上传你现有证书（`fullchain.pem` + `privkey.pem` 或等价文件）。
3. 开启 **强制 HTTPS**（HTTP 自动跳转 HTTPS）。

## 6) 备案信息核对（当前仅工信部备案）

备案信息集中在：

- `frontend/src/config/site.ts`

需要核对：

- `icpRecordText / icpRecordUrl`
- `publicSecurityRecordText / publicSecurityRecordUrl`（如果还没有公安联网备案号，保持空字符串即可）

如需修改，改完后重新执行第 1 步并覆盖上传。

## 7) 验收命令（替换为你的域名）

```bash
curl -I http://your-domain.com
curl -I https://your-domain.com
curl -I https://your-domain.com/posts
curl -I https://your-domain.com/tags
```

期望：

- HTTP 返回 301/308 跳转到 HTTPS。
- HTTPS 页面返回 200。
- 二级路由（`/posts`、`/tags`）刷新不 404。
