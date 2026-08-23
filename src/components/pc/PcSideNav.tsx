"use client";

import { usePathname } from "next/navigation";

/**
 * PC 左导航（M1）：224px 固定，一级入口仅 3 个（纪念馆/发现/我的），底部用户卡。
 * ≤1024px 由 globals.css 媒体查询收起为 64px 图标栏（文字经 .nav-label 等隐藏）。
 * 视觉令牌引用全局 CSS 变量，与移动端熔火主题一致。
 */
export default function PcSideNav({
  lang,
  user,
}: {
  lang: string;
  user: boolean;
}) {
  const pathname = usePathname();
  const base = `/${lang}`;
  const zh = lang === "zh";

  const items = [
    { href: base, icon: "🏛", label: zh ? "纪念馆" : "Memorial", match: (p: string) => p === base || p.startsWith(`${base}/hall`) || p.startsWith(`${base}/memorial`) },
    { href: `${base}/garden`, icon: "🧭", label: zh ? "发现" : "Discover", match: (p: string) => p.startsWith(`${base}/garden`) },
    { href: user ? `${base}/me` : `${base}/login`, icon: "👤", label: zh ? "我的" : "Me", match: (p: string) => p.startsWith(`${base}/me`) || p.startsWith(`${base}/login`) },
  ];

  return (
    <aside className="pc-sidenav" aria-label={zh ? "PC 端主导航" : "Primary"}>
      {/* 品牌区 */}
      <a href={base} className="flex items-center gap-3 px-2 no-underline">
        <span
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg text-amber-50 shrink-0"
          style={{
            background: "linear-gradient(135deg,#f59e0b,#b45309)",
            boxShadow: "0 0 24px rgba(217,119,6,.35)",
            fontFamily: "var(--font-serif)",
          }}
        >
          彼
        </span>
        <span className="brand-text">
          <span className="block text-lg tracking-[0.25em] text-stone-100" style={{ fontFamily: "var(--font-serif)" }}>
            {zh ? "彼岸" : "Bian"}
          </span>
          <span className="block text-[10px] tracking-widest text-stone-500">
            {zh ? "想念从未离开" : "Always with you"}
          </span>
        </span>
      </a>

      {/* 一级导航：仅 3 个入口 */}
      <nav className="mt-8 space-y-1.5 flex-1 w-full">
        {items.map((it) => {
          const active = it.match(pathname);
          return (
            <a key={it.href} href={it.href} className={`side-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
              <span className="side-icon" aria-hidden>{it.icon}</span>
              <span className="nav-label">{it.label}</span>
            </a>
          );
        })}
      </nav>

      {/* 底部用户卡 */}
      <div className="user-card flex items-center gap-3 rounded-xl border border-stone-700/60 bg-stone-900/60 p-3">
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center text-amber-50 shrink-0"
          style={{ background: "linear-gradient(135deg,#f59e0b,#b45309)", fontFamily: "var(--font-serif)" }}
        >
          {user ? "我" : "·"}
        </span>
        <span className="user-card-text flex-1 min-w-0">
          <span className="block text-[13px] text-stone-200 truncate">
            {user ? (zh ? "我的纪念" : "My memorials") : (zh ? "未登录" : "Guest")}
          </span>
          <span className="block text-[10px] text-stone-500">
            {user ? (zh ? "查看我的页面" : "Open my page") : (zh ? "登录后同步纪念" : "Sign in")}
          </span>
        </span>
        <a href={user ? `${base}/me` : `${base}/login`} className="user-card-gear text-stone-500 hover:text-stone-300 text-xs" aria-label={zh ? "设置" : "Settings"}>
          ⚙
        </a>
      </div>
    </aside>
  );
}
