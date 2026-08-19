import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { defaultLocale, getDictionary, hasLocale, locales } from "./dictionaries";
import { getSessionUser } from "../../lib/auth";
import NavBar from "../../components/NavBar";
import ThemeBackground from "../../components/ThemeBackground";

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
        <ThemeBackground labels={dict.themes} />
        <header className="sticky top-0 z-50 border-b border-stone-800/80 bg-stone-950/75 backdrop-blur-xl">
          <NavBar lang={lang} user={!!user} t={dict.nav} />
        </header>
        <main id="main-content" className="min-h-[calc(100vh-4rem)]">{children}</main>
        <footer className="border-t border-stone-800 py-8 text-center text-stone-600 text-xs space-y-2" role="contentinfo">
          <p>{dict.footer}</p>
          <p className="space-x-4">
            <a href={`/${lang}/legal/terms`} className="py-2 hover:text-stone-400 transition">{lang === "en" ? "Terms" : "用户协议"}</a>
            <a href={`/${lang}/legal/privacy`} className="py-2 hover:text-stone-400 transition">{lang === "en" ? "Privacy" : "隐私政策"}</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
