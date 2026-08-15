import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { defaultLocale, getDictionary, hasLocale } from "../../dictionaries";
import JoinPanel from "../../../../components/JoinPanel";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ lang: string; code: string }>;
}) {
  const { lang: rawLang, code } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const dict = getDictionary(lang);

  const db = getDb();
  const group = db.prepare("SELECT id, name FROM groups WHERE invite_code = ?").get(code) as
    | { id: string; name: string }
    | undefined;
  const user = await getSessionUser();

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center space-y-6">
      <p className="text-4xl">🕯️</p>
      <h1 className="text-xl tracking-widest text-amber-300">{dict.join.title}</h1>
      {!group ? (
        <p className="text-stone-500 text-sm">{dict.join.invalid}</p>
      ) : !user ? (
        <div className="space-y-4">
          <p className="text-stone-400 text-sm">{dict.join.prompt.replace("{name}", group.name)}</p>
          <p className="text-stone-500 text-xs">{dict.join.needLogin}</p>
          <a
            href={`/${lang}/login?next=/${lang}/join/${code}`}
            className="inline-block px-6 py-2 bg-amber-800 hover:bg-amber-700 text-amber-100 rounded-lg transition text-sm"
          >
            {dict.join.goLogin}
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-stone-400 text-sm">{dict.join.prompt.replace("{name}", group.name)}</p>
          <JoinPanel lang={lang} inviteCode={code} labels={dict.join} />
        </div>
      )}
    </div>
  );
}