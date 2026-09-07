#!/usr/bin/env bash
# 彼岸服务器运维一次性/幂等安装（docs/16 P0-3 + P2-2 + P2-3，在服务器上以 root 执行）：
#   1. logrotate 配置安装与语法自检
#   2. crontab：每日 04:00 数据库备份 + 04:05 清理 7 天前备份（P0-3）
#   3. pm2 startup 确认/安装（P2-3 重启自愈）
#   4. certbot.timer 状态确认（P2-3）
# 用法：cd /var/www/bian && bash deploy/setup-ops.sh
set -uo pipefail

cd /var/www/bian || { echo "❌ 目录 /var/www/bian 不存在"; exit 1; }

echo "=== [1/4] logrotate 配置 ==="
install -m 0644 deploy/logrotate-bian.conf /etc/logrotate.d/bian
if logrotate -d /etc/logrotate.d/bian >/dev/null 2>&1; then
  echo "  ✓ 语法自检通过：/etc/logrotate.d/bian（daily · rotate 14 · compress · copytruncate）"
else
  echo "  ❌ logrotate -d 失败，请检查 /etc/logrotate.d/bian"
  exit 1
fi

echo "=== [2/4] crontab（每日备份 + 7 天清理，P0-3）==="
mkdir -p /var/log/bian
CRON_MARK="# bian-ops"
( crontab -l 2>/dev/null | grep -v -F "$CRON_MARK" ; \
  echo "0 4 * * * cd /var/www/bian && npm run db:backup >> /var/log/bian/backup.log 2>&1 # bian-ops 每日备份" ; \
  echo "5 4 * * * find /var/www/bian/data/backups -name 'bian-*.db' -mtime +7 -delete # bian-ops 清理7天前备份" ; \
) | crontab -
echo "  当前 crontab："
crontab -l | grep -F "$CRON_MARK" || echo "  ⚠️ 未找到 bian-ops 标记行"

echo "=== [3/4] pm2 startup（重启自愈，P2-3）==="
if systemctl is-enabled pm2-root >/dev/null 2>&1; then
  echo "  ✓ pm2-root systemd 单元已启用"
else
  echo "  安装 pm2 startup（root）……"
  env PM2_HOME=/root/.pm2 pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
  systemctl enable pm2-root >/dev/null 2>&1 || true
  if systemctl is-enabled pm2-root >/dev/null 2>&1; then
    echo "  ✓ pm2-root 已启用"
  else
    echo "  ⚠️ pm2 startup 安装未生效（手工执行：pm2 startup systemd -u root --hp /root）"
  fi
fi
pm2 save >/dev/null 2>&1 && echo "  ✓ pm2 save 完成（进程清单已固化）"

echo "=== [4/4] certbot.timer 状态 ==="
if systemctl is-enabled certbot.timer >/dev/null 2>&1; then
  echo "  ✓ certbot.timer 已启用（证书自动续期）"
  systemctl is-active certbot.timer >/dev/null 2>&1 && echo "  ✓ certbot.timer 运行中" || echo "  ⚠️ certbot.timer 未运行（systemctl start certbot.timer）"
else
  echo "  ⚠️ certbot.timer 未启用"
fi

echo "=== 运维现状快照 ==="
echo "磁盘：$(df -h / | awk 'NR==2{print $3" / "$2" ("$5")"}')"
echo "最近备份："
ls -t data/backups/bian-*.db 2>/dev/null | head -3 || echo "  （暂无备份）"
echo "✅ setup-ops.sh 执行完毕"
