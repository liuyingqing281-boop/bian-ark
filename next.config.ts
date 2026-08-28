import type { NextConfig } from "next";

const scriptPolicy = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const nextConfig: NextConfig = {
  distDir: process.env.BIAN_NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["better-sqlite3"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["three", "zustand", "uuid"],
  },
  async rewrites() {
    return [
      // 概念落地页：/concept 保持干净 URL，实际取静态文件
      { source: "/concept", destination: "/concept/index.html" },
    ];
  },
  async headers() {
    return [
      {
        // 静态原型托管（/proto/*）：允许被自身 iframe 平铺，允许 Tailwind/FontAwesome CDN
        source: "/proto/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: `default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data: blob: https:; connect-src 'self'; frame-ancestors 'self'` },
        ],
      },
      {
        source: "/((?!proto/).*)",
        headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        { key: "Content-Security-Policy", value: `default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; ${scriptPolicy}; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.stripe.com https://dashscope.aliyuncs.com; frame-src https://js.stripe.com https://open.weixin.qq.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'` },
        ],
      },
    ];
  },
};

export default nextConfig;
