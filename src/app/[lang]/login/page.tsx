import { defaultLocale, getDictionary, hasLocale } from "../dictionaries";
import LoginForm from "../../../components/LoginForm";
import ConceptStage from "../../../components/concept/ConceptStage";

/**
 * 登录首页：彼岸概念视觉（WebGL 折叠光绸）+ 登录表单。
 * 视觉与 /[lang] 概念首页同源（components/concept/ConceptStage），
 * 概念源稿：docs/web/concept/index.html。
 */
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
  const zh = lang !== "en";

  return (
    <ConceptStage lang={lang} showPalette={false}>
      <style>{`
        .login-title {
          font-family: "Songti SC", "Noto Serif SC", "SimSun", serif;
          font-weight: 600;
          font-size: clamp(44px, 7vw, 72px);
          letter-spacing: 0.22em;
          margin-right: -0.22em;
          text-shadow: 0 2px 40px rgba(0, 0, 0, 0.45);
        }
        .login-tagline {
          font-size: clamp(14px, 1.8vw, 18px);
          letter-spacing: 0.5em;
          margin-right: -0.5em;
          color: rgba(232, 226, 214, 0.55);
        }
        .login-card {
          margin-top: 12px;
          width: min(100%, 26rem);
          padding: 28px 28px 24px;
          border-radius: 20px;
          border: 1px solid rgba(232, 226, 214, 0.14);
          background: rgba(16, 20, 28, 0.55);
          backdrop-filter: blur(14px);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
          text-align: left;
        }
        .login-card-title {
          text-align: center;
          font-size: 15px;
          letter-spacing: 0.2em;
          color: #d8a95c;
          margin-bottom: 18px;
        }
      `}</style>

      <h1 className="login-title">{zh ? "彼岸" : "The Other Shore"}</h1>
      <p className="login-tagline">{zh ? "思念有处安放" : "Where memories rest"}</p>

      <div className="login-card">
        <p className="login-card-title">{dict.auth.title}</p>
        <LoginForm lang={lang} next={safeNext} labels={dict.auth} />
      </div>
    </ConceptStage>
  );
}
