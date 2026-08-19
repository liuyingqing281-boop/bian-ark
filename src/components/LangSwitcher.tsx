"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LangSwitcher({ lang }: { lang: string }) {
  const pathname = usePathname();
  const target = lang === "zh" ? "en" : "zh";
  const href = pathname.replace(/^\/(zh|en)(\/|$)/, `/${target}$2`);

  return (
    <Link
      href={href}
      onClick={() => {
        document.cookie = `NEXT_LOCALE=${target};path=/;max-age=31536000`;
      }}
      className="px-3 py-2.5 rounded border sm:px-2 sm:py-1.5 border-stone-700 text-stone-400 hover:text-amber-300 hover:border-amber-700 transition text-xs"
    >
      {lang === "zh" ? "EN" : "中文"}
    </Link>
  );
}
