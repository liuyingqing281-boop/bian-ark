# 部署与恢复

> 工具包在 `deploy/` 目录：`setup-server.sh`（服务器初始化）｜`deploy.sh`（发布）｜`ecosystem.config.cjs`（PM2）｜`nginx.conf.template`（反向代理）｜`production.env.example`（生产变量模板）
> 已本地验证：production build + start + 健康检查/页面/admin fail-closed 冒烟通过（2026-08-18）

## 服务器首次部署（Ubuntu 22.04+）

```bash
# 1. 初始化（一次性）
git clone https://github.com/liuyingqing281-boop/bian-ark.git /var/www/bian
cd /var/www/bian && bash deploy/setup-server.sh

# 2. 配置生产变量（对照 production.env.example 填写密钥）
cp deploy/production.env.example .env.production && vi .env.production

# 3. 首次发布
bash deploy/deploy.sh
```

## 生产前置

- Node.js 22，持久化数据库卷和上传存储。
- 配置 `DATABASE_PATH`、`STORAGE_PROVIDER`、SMTP/SMS、Stripe、微信、内容审核和数字人供应商变量。
- **`ADMIN_EMAILS` 生产必配**（不配则管理后台全拒绝，fail-closed）。
- 当前仓库内置 `local` StorageAdapter；多实例上线前必须实现并启用 OSS Adapter，禁止多个实例共享本机目录。

## 发布

```bash
bash deploy/deploy.sh [git-ref]   # 备份→构建→迁移→pm2 重启→冒烟，一条命令
# 等价手动流程：
npm ci && npm run db:backup && npm run build && npm run db:migrate && npm run db:verify
pm2 restart ecosystem.config.cjs --env production && npm run release:smoke
```

## 回滚

1. 停止新版本进程，保留失败版本日志和数据库备份。
2. 恢复上一版本应用制品。
3. 数据库迁移默认只向前；涉及破坏性 schema 变更前必须另建反向迁移。
4. 使用 `node tools/restore-check.mjs <backup.db>` 验证备份，再切换 `DATABASE_PATH`。
5. 启动后执行 `npm run release:smoke`，确认健康检查和核心公开页面。

## 定时任务

```bash
# crontab -e 加入（路径按实际安装位置调整）：
0 4 * * * cd /var/www/bian && npm run backup          # 每日 04:00 备份
*/5 * * * * cd /var/www/bian && npm run dh:worker      # 数字人超时任务清理
```

- 备份文件与 `.sha256` 保存在独立持久化位置（`/data/bian-backups`，可挂独立盘）。
- 定期调用会话清理和会员到期降级任务；部署平台应保证单实例执行。
