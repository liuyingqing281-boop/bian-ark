import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { defaultLocale, getDictionary, hasLocale, locales } from "./dictionaries";
import { getSessionUser } from "../../lib/auth";
import AppFrame from "../../components/immersive/AppFrame";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c0a09",
};

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(hasLocale(lang) ? lang : defaultLocale);
  return { title: dict.meta.title, description: dict.meta.description };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const user = await getSessionUser();

  return (
    <html lang={lang === "zh" ? "zh-CN" : "en"} dir="ltr">
      <body className="bg-page text-copy min-h-screen font-serif">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-amber-700 focus:text-amber-100 focus:rounded-lg focus:text-sm"
        >
          {lang === "zh" ? "跳转到主要内容" : "Skip to main content"}
        </a>
        {/* 应用壳分流（星海 Task 2）：/garden 与 /hall/* 走沉浸壳，其余走普通壳；
            skip link 留在 AppFrame 之外，沉浸页同样可跳转主内容 */}
        <AppFrame
          lang={lang}
          user={!!user}
          dict={{ nav: dict.nav, themes: dict.themes, footer: dict.footer }}
        >
          {children}
        </AppFrame>
      </body>
    </html>
  );
}
