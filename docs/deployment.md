# 部署与恢复

> ⚠️ **历史参考（2026-09-07 起，docs/16 P3-4 归一）**：本文档描述的早期发布流程已被取代，**现行唯一真相源 = [07-服务器部署运维手册](07-服务器部署运维手册.md)**，本文件不再维护、仅作演进记录。
> 仍有效并已并入 07 手册的要点：首次装机用 `deploy/setup-server.sh`；生产变量参考 `deploy/production.env.example`；**`ADMIN_EMAILS` 生产必配**（不配则管理后台全拒绝，fail-closed）；多实例上线前必须实现并启用 OSS Adapter（禁止多实例共享本机 uploads 目录）。`deploy/deploy.sh` 已于 2026-09-07 删除；发布请走本地 `npm run release`（07 §二），回滚用 `deploy/rollback.sh`。

> 工具包在 `deploy/` 目录：`setup-server.sh`（服务器初始化）｜`ecosystem.config.cjs`（PM2）｜`nginx.conf.template`（反向代理）｜`production.env.example`（生产变量模板）｜`apply-release.sh`（发布应用）｜`rollback.sh`（一键回滚）｜`logrotate-bian.conf`（日志轮转）｜`setup-ops.sh`（cron/logrotate/pm2 startup 幂等安装）
> 已本地验证：production build + start + 健康检查/页面/admin fail-closed 冒烟通过（2026-08-18）

## 服务器首次部署（Ubuntu 22.04+）

```bash
# 1. 初始化（一次性）
git clone https://github.com/liuyingqing281-boop/bian-ark.git /var/www/bian
cd /var/www/bian && bash deploy/setup-server.sh

# 2. 配置生产变量（对照 production.env.example 填写密钥）
cp deploy/production.env.example .env.production && vi .env.production

# 3. 首次发布（历史为 bash deploy/deploy.sh，已删；现在走 07 §二 的 npm run release）
```

## 生产前置

- Node.js 22，持久化数据库卷和上传存储。
- 配置 `DATABASE_PATH`、`STORAGE_PROVIDER`、SMTP/SMS、Stripe、微信、内容审核和数字人供应商变量。
- **`ADMIN_EMAILS` 生产必配**（不配则管理后台全拒绝，fail-closed）。
- 当前仓库内置 `local` StorageAdapter；多实例上线前必须实现并启用 OSS Adapter，禁止多个实例共享本机目录。

## 发布

（历史：`bash deploy/deploy.sh [git-ref]` 服务器自构建一条龙——已删除，2G 机易 OOM。现行流程见 07 §二：本地 `npm run release` 全自动 6 步 + `deploy-reports/` 报告。）

```bash
# 历史等价手动流程（仅存档）：
npm ci && npm run db:backup && npm run build && npm run db:migrate && npm run db:verify
pm2 restart ecosystem.config.cjs --env production && npm run release:smoke
```

## 发布（小内存服务器推荐：本地构建产物上传，2026-08-23 起）

2C2G 机器上 `next build` 易 OOM/拖垮整机。**改为本地（开发机）构建、服务器只运行不编译**：

```bash
# 本地（Windows PowerShell，E:\彼岸）：
git worktree add --detach ../bian-build master          # 干净副本
cd ../bian-build && npm ci --ignore-scripts && npm run build
tar czf ../bian-release-next.tar.gz .next               # 产物包约 90MB
scp ../bian-release-next.tar.gz root@47.238.100.165:/var/www/bian/

# 服务器：
cd /var/www/bian && bash deploy/apply-release.sh        # 备份→解包→迁移→重启→冒烟
```

注意：原生模块（better-sqlite3）仍在服务器侧 `npm ci` 安装，产物只含平台无关的 `.next`；本地装依赖用 `--ignore-scripts` 跳过原生编译即可（构建不执行它）。

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
