import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 2,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3002",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER ? undefined : {
    // --webpack 与 tools/test-starsea-formal.mjs 同轨：本机 Turbopack 原生模块不稳
    // （偶发 dev 内部 JSON.parse 500，坑 9），webpack dev 全程稳定
    command: "npm run dev -- --webpack",
    url: "http://localhost:3002/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // tools/dev.mjs 缺省端口 7300，注入 PORT 让自动起服落在 config 期望的 3002（Task 3 测试债）
    env: { ...process.env, AUTH_IP_DAILY_LIMIT: "1000", PORT: "3002" },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
