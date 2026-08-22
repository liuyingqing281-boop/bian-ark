import type { Metadata, Viewport } from "next";
import "./prototype.css";

export const metadata: Metadata = {
  title: "彼岸 · 高保真原型（P0 核心页）",
  description: "依据《前端具体设计流程》§1.3 视觉规范实现的 4 个 P0 核心页可交互原型",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f5f0",
};

export default function PrototypeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
