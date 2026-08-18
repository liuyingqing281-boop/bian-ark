#!/usr/bin/env bash
# 服务器一次性初始化（Ubuntu 22.04/24.04，以 root 或 sudo 用户执行）
# 用法：bash deploy/setup-server.sh
set -euo pipefail

echo "=== [1/6] 系统更新与基础工具 ==="
apt-get update -y
apt-get install -y curl git nginx sqlite3 cron

echo "=== [2/6] Node.js 22 LTS ==="
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "=== [3/6] 目录结构 ==="
mkdir -p /var/www/bian
mkdir -p /var/log/bian
mkdir -p /data/bian-backups   # 备份独立目录（换机时可挂载独立盘）

echo "=== [4/6] PM2 进程守护 ==="
npm install -g pm2
# pm2 startup 输出一条需要执行的命令（新版无 -y 选项），root 下直接执行它
STARTUP_CMD=$(pm2 startup systemd | tail -1)
eval "$STARTUP_CMD" >/dev/null 2>&1 || echo "!! pm2 startup 配置失败，可稍后手动执行: $STARTUP_CMD"

echo "=== [5/6] Nginx 站点 ==="
cp /var/www/bian/deploy/nginx.conf.template /etc/nginx/sites-available/bian || {
  echo "!! 仓库代码尚未拉取，稍后部署时再执行 sudo cp deploy/nginx.conf.template /etc/nginx/sites-available/bian"
}
ln -sf /etc/nginx/sites-available/bian /etc/nginx/sites-enabled/bian
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx

echo "=== [6/6] 防火墙 ==="
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "初始化完成。接下来："
echo "  1. 把代码部署到 /var/www/bian（deploy/deploy.sh 或手动 git clone）"
echo "  2. 配置生产环境变量 cp deploy/production.env.example /var/www/bian/.env.production 并填写"
echo "  3. pm2 start deploy/ecosystem.config.cjs --env production"
