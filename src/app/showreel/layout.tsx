import type { Metadata, Viewport } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "彼岸 · 产品 Showreel",
  description: "思念有处安放 —— 彼岸纪念馆 30 秒产品 Showreel（帧驱动，可拖帧审计）",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050403",
};

export default function ShowreelLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, background: "#050403" }}>{children}</body>
    </html>
  );
}
