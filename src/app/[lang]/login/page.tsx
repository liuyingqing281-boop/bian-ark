import { defaultLocale, getDictionary, hasLocale } from "../dictionaries";
import LoginForm from "../../../components/LoginForm";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const dict = getDictionary(lang);
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "";

  return (
    <div className="ui-page max-w-md py-16 sm:py-20">
      <div className="text-center mb-10">
        <p className="text-4xl mb-4">🕯️</p>
        <h1 className="mb-2 text-2xl font-semibold leading-tight text-amber-300">{dict.auth.title}</h1>
        <p className="text-sm leading-6 text-stone-500">{dict.auth.subtitle}</p>
      </div>
      <LoginForm lang={lang} next={safeNext} labels={dict.auth} />
    </div>
  );
}
