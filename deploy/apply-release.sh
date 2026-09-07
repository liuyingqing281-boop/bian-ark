#!/usr/bin/env bash
# 应用本地上传的构建产物（在服务器上执行）：杀掉残留构建 → 备份 → 解压 .next → 迁移 → 重启 → 冒烟
# 前置：本地已 scp 上传 bian-release-next.tar.gz 到 /var/www/bian/
# 用法：bash deploy/apply-release.sh
set -euo pipefail
# 防自改写竞态：步骤 [2/6] 的 git reset 会更新本脚本文件，bash 增量读取会读到错位内容。
# 先把自身快照到 /tmp 再执行，全程读快照。
if [ -z "${BIAN_APPLY_RELEASE_REEXEC:-}" ]; then
  SNAP=$(mktemp /tmp/apply-release.XXXXXX.sh)
  cp "$0" "$SNAP"
  BIAN_APPLY_RELEASE_REEXEC=1 bash "$SNAP"
  rc=$?
  rm -f "$SNAP"
  exit $rc
fi
cd /var/www/bian

echo "=== [1/6] 清理残留的本地构建进程 ==="
pkill -f "next build" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true

echo "=== [2/6] 同步最新代码（source 与产物对齐）==="
git config --global --add safe.directory /var/www/bian || true
git fetch origin && git reset --hard origin/master

echo "=== [3/6] 部署前备份 ==="
npm run db:backup || npm run backup

echo "=== [4/6] 解包本地上传的构建产物（保留上一版到 .next.prev 以便回滚，docs/16 P1-3）==="
test -f bian-release-next.tar.gz || { echo "缺少 bian-release-next.tar.gz，请先在本地 scp 上传"; exit 1; }
if [ -d .next ]; then
  rm -rf .next.prev
  mv .next .next.prev
fi
tar xzf bian-release-next.tar.gz
rm -f bian-release-next.tar.gz

echo "=== [4.1/6] 产物-代码一致性校验（docs/16 P1-2）==="
# 包内 RELEASE_COMMIT（release.mjs 打包时写入）须与服务器 git HEAD 一致；
# 旧包/手工包无此文件时仅告警不阻断（向后兼容）
if [ -f .next/RELEASE_COMMIT ]; then
  PKG_COMMIT=$(cat .next/RELEASE_COMMIT)
  GIT_COMMIT=$(git rev-parse HEAD)
  if [ "$PKG_COMMIT" != "$GIT_COMMIT" ]; then
    echo "❌ 产物与代码不一致：包=$PKG_COMMIT 库=$GIT_COMMIT — 回滚解包并中止"
    rm -rf .next
    mv .next.prev .next
    exit 1
  fi
  echo "  一致：$PKG_COMMIT"
else
  echo "  ⚠️ 包内无 RELEASE_COMMIT（旧式打包），跳过校验"
fi

echo "=== [4.5/6] 修复 Turbopack 原生模块哈希别名（坑9）==="
# npm ci 会清掉 Turbopack 构建期望的 node_modules/<pkg>-<16位hex> 别名（如 better-sqlite3-90e2652d1716b047），
# 缺失则所有引用该模块的 chunk 运行时 500（2026-08-26 线上事故）。按 .next 实际引用动态补链：
for name in $(grep -rhoE '[a-zA-Z@/._][a-zA-Z0-9@/._-]*-[0-9a-f]{16}' .next/server/chunks/*.js 2>/dev/null | sort -u); do
  base="${name%-[0-9a-f]*}"
  if [ -d "node_modules/$base" ] && [ ! -e "node_modules/$name" ]; then
    ln -sfn "$base" "node_modules/$name"
    echo "  已补别名 node_modules/$name -> $base"
  fi
done

echo "=== [5/6] 数据库迁移与校验 ==="
npm run db:migrate
npm run db:verify

echo "=== [6/6] 重启服务并冒烟 ==="
pm2 restart bian 2>/dev/null || pm2 start deploy/ecosystem.config.cjs --env production
sleep 5
npm run release:smoke

echo "✅ 发布完成（本地构建产物模式）"
