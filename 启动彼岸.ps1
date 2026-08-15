# 彼岸 · 线上墓园 — 启动脚本
# 双击桌面快捷方式运行，或在 PowerShell 中执行本脚本
# 检测 3002 端口 → 未运行则启动 dev server → 轮询健康检查 → 打开浏览器

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath "E:\彼岸"

$listening = Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
    Write-Host "[启动] 未检测到 3002 端口，正在启动 dev server..." -ForegroundColor Yellow
    Start-Process -WindowStyle Hidden -FilePath "cmd.exe" -ArgumentList "/c npm run dev > server.log 2>&1" -WorkingDirectory "E:\彼岸"

    $ready = $false
    for ($i = 1; $i -le 60; $i++) {
        Start-Sleep -Seconds 1
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:3002/zh" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) { $ready = $true; break }
        } catch {}
    }
    if ($ready) {
        Write-Host "[启动] Dev server 已就绪 ($" + "{i}s)" -ForegroundColor Green
    } else {
        Write-Host "[启动] 警告: 60 秒内未就绪，仍尝试打开浏览器" -ForegroundColor Red
    }
} else {
    Write-Host "[启动] 端口 3002 已在运行，直接打开浏览器" -ForegroundColor Cyan
}
Start-Process "http://localhost:3002/zh"