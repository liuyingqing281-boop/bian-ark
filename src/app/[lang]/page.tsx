import { defaultLocale, hasLocale } from "./dictionaries";
import ConceptHome from "./ConceptHome";

/**
 * 项目首页：彼岸视觉概念稿（WebGL 折叠光绸）。
 * 概念源稿存于 docs/web/concept/index.html；原纪念堂列表首页已由 /[lang]/garden 承接。
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  return <ConceptHome lang={lang} />;
}
