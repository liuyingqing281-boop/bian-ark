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
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <p className="text-4xl mb-4">🕯️</p>
        <h1 className="text-2xl tracking-widest text-amber-300 mb-2">{dict.auth.title}</h1>
        <p className="text-stone-500 text-sm">{dict.auth.subtitle}</p>
      </div>
      <LoginForm lang={lang} next={safeNext} labels={dict.auth} />
    </div>
  );
}