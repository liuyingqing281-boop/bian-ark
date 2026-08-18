#!/usr/bin/env bash
# 发布脚本（在服务器上执行）：拉代码 → 装依赖 → 备份 → 构建 → 迁移 → 重启 → 冒烟
# 用法：bash deploy/deploy.sh [git-ref]   （默认 origin/master）
set -euo pipefail
cd /var/www/bian

REF="${1:-origin/master}"
echo "=== [1/7] 拉取代码（$REF）==="
git fetch origin
git reset --hard "$REF"

echo "=== [2/7] 安装依赖 ==="
npm ci

echo "=== [3/7] 部署前备份 ==="
npm run backup

echo "=== [4/7] 构建 ==="
npm run build

echo "=== [5/7] 数据库迁移与校验 ==="
npm run db:migrate
npm run db:verify

echo "=== [6/7] 重启服务 ==="
pm2 restart ecosystem.config.cjs --env production 2>/dev/null || pm2 start deploy/ecosystem.config.cjs --env production
sleep 5

echo "=== [7/7] 发布冒烟 ==="
npm run release:smoke

echo "✅ 发布完成"
