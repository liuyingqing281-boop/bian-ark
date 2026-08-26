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

echo "=== [4.5/7 顺带] 修复 Turbopack 原生模块哈希别名（坑9，npm ci 会清掉它们）==="
# 同 apply-release.sh：按 .next 实际引用补 node_modules/<pkg>-<16位hex> 软链
for name in $(grep -rhoE '[a-zA-Z@/._][a-zA-Z0-9@/._-]*-[0-9a-f]{16}' .next/server/chunks/*.js 2>/dev/null | sort -u); do
  base="${name%-[0-9a-f]*}"
  if [ -d "node_modules/$base" ] && [ ! -e "node_modules/$name" ]; then
    ln -sfn "$base" "node_modules/$name"
    echo "  已补别名 node_modules/$name -> $base"
  fi
done

echo "=== [6/7] 重启服务 ==="
# 先清残留进程：游离的 next-server 会占住 3002，pm2 新进程起不来（2026-08-25 线上事故）
pkill -f "next-server" 2>/dev/null || true
pm2 restart ecosystem.config.cjs --env production 2>/dev/null || pm2 start deploy/ecosystem.config.cjs --env production
sleep 5

echo "=== [7/7] 发布冒烟 ==="
npm run release:smoke

echo "✅ 发布完成"
