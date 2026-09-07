#!/usr/bin/env bash
# 一键回滚到上一版产物（docs/16 P1-3，在服务器上执行）：.next.prev ↔ .next 互换 + PM2 重启
# 范围说明（保守策略）：只回滚前端/服务端构建产物，不回退 git 代码、不回滚数据库——
#   运行时逻辑在 .next 内自成一体；若需连数据回滚，另行用 data/backups 的备份库恢复（07 手册 §七）。
# 用法：bash deploy/rollback.sh          # 仅回滚产物
#       bash deploy/rollback.sh --list   # 列出可用的数据库备份（供人工决定是否恢复）
set -euo pipefail
cd /var/www/bian

if [ "${1:-}" = "--list" ]; then
  echo "=== 最近 5 个数据库备份 ==="
  ls -t data/backups/bian-*.db 2>/dev/null | head -5 || echo "（无备份）"
  echo "恢复方法：cp <选中的备份> data/bian.db && pm2 restart bian（07 手册 §七）"
  exit 0
fi

test -d .next.prev || { echo "❌ 无上一版产物（.next.prev 缺失）：apply-release.sh 自 2026-09-07 起才保留上一版"; exit 1; }

echo "=== [1/3] 互换产物 ==="
PREV_INFO=""
[ -f .next.prev/RELEASE_COMMIT ] && PREV_INFO=$(cat .next.prev/RELEASE_COMMIT)
mv .next .next.rolled
mv .next.prev .next
mv .next.rolled .next.prev
echo "  已回滚到上一版产物${PREV_INFO:+（构建自 commit ${PREV_INFO:0:7}）}"

echo "=== [2/3] 重启服务 ==="
pkill -f "next-server" 2>/dev/null || true
pm2 restart bian
sleep 5

echo "=== [3/3] 冒烟 ==="
npm run release:smoke

echo "✅ 回滚完成（当前为上一版产物；git 代码与数据库未动）"
echo "   如需再切回新版：再次执行 bash deploy/rollback.sh（.next.prev 即刚才换下的新版）"
