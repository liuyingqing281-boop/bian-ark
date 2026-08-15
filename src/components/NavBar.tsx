"use client";

import { usePathname } from "next/navigation";
import LangSwitcher from "./LangSwitcher";

// NavBar v2
      export default function NavBar({
  lang,
  user,
  t,
}: {
  lang: string;
  user: boolean;
  t: {
    brand: string;
    garden: string;
    gardenPublic: string;
    membership: string;
    admin: string;
    me: string;
    login: string;
  };
}) {
  const pathname = usePathname();
  const base = `/${lang}`;

  const otherRoutes = ["garden", "membership", "admin", "me", "login"];
  const isActive = (href: string) => {
    if (href === base) {
      const firstSegment = pathname.slice(base.length + 1).split("/")[0] || "";
      return pathname === base || pathname === `${base}/` || !otherRoutes.includes(firstSegment);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const meHref = user ? `${base}/me` : `${base}/login`;

  const linkCls = (active: boolean, accent = false) =>
    `px-1 py-1 rounded transition ${
      accent
        ? active
          ? "text-amber-300"
          : "text-amber-500/90 hover:text-amber-300"
        : active
          ? "text-stone-100 bg-stone-800/70"
          : "text-stone-400 hover:text-stone-200"
    }`;

  return (
    <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between" aria-label="Main navigation">
      <a href={base} className="text-xl tracking-widest text-amber-400 hover:text-amber-300 transition">
        {t.brand}
      </a>
      <div className="flex items-center gap-1.5 text-sm text-stone-400">
        <a href={base} data-active={isActive(base)} className={linkCls(isActive(base))}>
          {t.garden}
        </a>
        <a href={`${base}/garden`} className={linkCls(isActive(`${base}/garden`))}>
          {t.gardenPublic}
        </a>
        <a href={`${base}/membership`} className={linkCls(isActive(`${base}/membership`))}>
          {t.membership}
        </a>
        <a href={`${base}/admin`} className={linkCls(isActive(`${base}/admin`))}>
          {t.admin}
        </a>
        <a href={meHref} className={linkCls(isActive(meHref), true)}>
          {user ? t.me : t.login}
        </a>
        <LangSwitcher lang={lang} />
      </div>
    </nav>
  );
}
