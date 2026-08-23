import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "彼岸 · 前端操作界面原型（ZCode 独立版）",
  description:
    "依据《前端具体设计流程与设计图纸》实现的 P0 核心页可交互原型；首页沉浸区采用低饱和折光渐变（fold-gradient）光效",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f5f0",
};

export default function ZcodeProtoLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
