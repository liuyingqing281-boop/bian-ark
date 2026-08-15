# 部署与恢复

## 生产前置

- Node.js 22，持久化数据库卷和上传存储。
- 配置 `DATABASE_PATH`、`STORAGE_PROVIDER`、SMTP/SMS、Stripe、微信、内容审核和数字人供应商变量。
- 当前仓库内置 `local` StorageAdapter；多实例上线前必须实现并启用 OSS Adapter，禁止多个实例共享本机目录。

## 发布

```powershell
npm ci
npm run db:backup
npm run db:migrate
npm run db:verify
npm run build
npm run start -- -p 3002
npm run release:smoke
```

## 回滚

1. 停止新版本进程，保留失败版本日志和数据库备份。
2. 恢复上一版本应用制品。
3. 数据库迁移默认只向前；涉及破坏性 schema 变更前必须另建反向迁移。
4. 使用 `node tools/restore-check.mjs <backup.db>` 验证备份，再切换 `DATABASE_PATH`。
5. 启动后执行 `npm run release:smoke`，确认健康检查和核心公开页面。

## 定时任务

- 每日执行 `npm run backup`，备份文件与 `.sha256` 保存在独立持久化位置。
- 每 5 分钟执行 `npm run dh:worker`，处理超时数字人任务。
- 定期调用会话清理和会员到期降级任务；部署平台应保证单实例执行。
