import type { Metadata } from "next";
import { defaultLocale, hasLocale } from "./dictionaries";
import ConceptHome from "./ConceptHome";

/**
 * 项目首页（docs/16 P3-1，2026-09 拍板：保留概念首页、强化产品入口）：
 * /[lang] = 彼岸品牌/概念首页，主 CTA 直进 /[lang]/garden 星海产品区。
 * 概念源稿存于 docs/web/concept/index.html；原纪念堂列表首页已由 /[lang]/garden 承接。
 */

const SEO: Record<"zh" | "en", Metadata> = {
  zh: {
    title: "彼岸 · 线上纪念馆 | 星海长明灯",
    description:
      "彼岸线上纪念馆：在星海为逝去的亲人点亮一盏长明灯——多人合馆长明灯阵、家书留言、供奉心意与 TA 的声音复刻，让思念有处安放。",
  },
  en: {
    title: "Bian — Online Memorial in a Star Sea",
    description:
      "Bian is an online memorial. Light an eternal lamp in the star sea for someone you love: family halls, letters, tributes, and their voice, so memories have a place to rest.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  return SEO[lang as "zh" | "en"] ?? SEO.zh;
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  return <ConceptHome lang={lang} />;
}
