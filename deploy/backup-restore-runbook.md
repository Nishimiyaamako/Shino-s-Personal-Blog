# 数据与媒体备份/恢复 Runbook

> 目标：确保 SQLite 与 uploads 可周期备份并可演练恢复。

## 1) 备份对象

- 数据库：`/opt/shino-blog/data/blog.sqlite`
- 上传资源：`/opt/shino-blog/uploads/`

## 2) 备份建议频率

- SQLite：每天至少 1 次（业务高峰可每 6 小时）
- uploads：每天至少 1 次，或按新增量增量备份

## 3) 手动备份命令（服务器）

```bash
TS="$(date +%F-%H%M%S)"
mkdir -p /opt/shino-blog/backups

cp /opt/shino-blog/data/blog.sqlite \
  "/opt/shino-blog/backups/blog.sqlite.${TS}.bak"

tar -C /opt/shino-blog -czf \
  "/opt/shino-blog/backups/uploads.${TS}.tar.gz" \
  uploads
```

## 4) 恢复演练步骤

1. 停后端进程（避免写入）
2. 恢复数据库文件
3. 恢复 uploads 目录
4. 启动后端进程
5. 执行 smoke test 与后台抽检

示例：

```bash
# 1) stop
pm2 stop shino-blog-backend

# 2) restore db
cp /opt/shino-blog/backups/blog.sqlite.<timestamp>.bak \
   /opt/shino-blog/data/blog.sqlite

# 3) restore uploads
tar -C /opt/shino-blog -xzf /opt/shino-blog/backups/uploads.<timestamp>.tar.gz

# 4) start
pm2 start /opt/shino-blog/backend/ecosystem.config.js

# 5) smoke
curl -sS http://127.0.0.1:3001/api/health
```

## 5) 恢复后必检

- 后台可登录
- 最近一篇文章可打开
- 抽查上传图片可访问
- 友链/关于/名片数据正确
