"use client";

import { usePathname } from "next/navigation";
import { locales } from "../../app/[lang]/dictionaries";
import type { getDictionary } from "../../app/[lang]/dictionaries";
import NavBar from "../NavBar";
import ThemeBackground from "../ThemeBackground";
import PcShell from "../pc/PcShell";

type Dictionary = ReturnType<typeof getDictionary>;

/** 沉浸路径：/${lang}/garden 精确匹配，或任意 /${lang}/hall/ 前缀（星海园与馆） */
export function isImmersivePath(pathname: string): boolean {
  return locales.some((lang) => {
    const base = `/${lang}`;
    if (pathname === `${base}/garden`) return true;
    return pathname.startsWith(`${base}/hall/`);
  });
}

/**
 * 应用壳（星海 Task 2）：按路径分流普通壳 / 星海沉浸壳，不在各页面复制导航。
 * 普通路径渲染 ThemeBackground + pc-topbar(NavBar) + PcShell + main + footer（与旧根布局一致）；
 * 沉浸路径只渲染 main（保留 id="main-content" 供 skip link 跳转），
 * 全屏视口壳由页面内容侧的 .starsea-shell/.starsea-scene 承担（见 globals.css）。
 * 服务端仅传入 user: boolean 与可序列化字典切片，Cookie/用户对象不下发客户端。
 */
export default function AppFrame({
  lang,
  user,
  dict,
  children,
}: {
  lang: string;
  user: boolean;
  dict: Pick<Dictionary, "nav" | "themes" | "footer">;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname && isImmersivePath(pathname)) {
    return (
      <div data-immersive="true">
        <main id="main-content">{children}</main>
      </div>
    );
  }

  return (
    <>
      <ThemeBackground labels={dict.themes} />
      <header className="pc-topbar sticky top-0 z-50 border-b border-stone-800/80 bg-stone-950/75 backdrop-blur-xl">
        <NavBar lang={lang} user={user} t={dict.nav} />
      </header>
      <PcShell lang={lang} user={user} />
      <main id="main-content" className="min-h-[calc(100vh-4rem)]">{children}</main>
      <footer className="border-t border-stone-800 py-8 text-center text-stone-600 text-xs space-y-2" role="contentinfo">
        <p>{dict.footer}</p>
        <p className="space-x-4">
          <a href={`/${lang}/legal/terms`} className="py-2 hover:text-stone-400 transition">{lang === "en" ? "Terms" : "用户协议"}</a>
          <a href={`/${lang}/legal/privacy`} className="py-2 hover:text-stone-400 transition">{lang === "en" ? "Privacy" : "隐私政策"}</a>
        </p>
      </footer>
    </>
  );
}
