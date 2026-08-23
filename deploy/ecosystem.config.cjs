// PM2 进程守护配置 —— 生产部署用
// 启动：pm2 start deploy/ecosystem.config.cjs --env production
// 常用：pm2 logs bian | pm2 restart bian | pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: "bian",
      cwd: "/var/www/bian",
      script: "npm",
      args: "run start -- -p 3003",
      env: {
        NODE_ENV: "production",
      },
      // 内存超 400MB 自动重启（2G 机器的安全线）
      max_memory_restart: "400M",
      // 崩溃自动拉起
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
      // 日志
      out_file: "/var/log/bian/out.log",
      error_file: "/var/log/bian/error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      time: true,
    },
  ],
};
