import Link from "next/link";
import ConceptStage from "../../components/concept/ConceptStage";

/**
 * 彼岸 · 概念首页（/[lang]）
 * 视觉实现已抽取至 components/concept/ConceptStage（与登录页共用）；
 * 概念源稿：docs/web/concept/index.html。
 */

export default function ConceptHome({ lang }: { lang: string }) {
  const zh = lang !== "en";

  return (
    <ConceptStage lang={lang} cornerNote={zh ? "概念稿 · 视觉探索" : "Concept · Visual exploration"}>
      <style>{`
        .concept-title {
          font-family: "Songti SC", "Noto Serif SC", "SimSun", serif;
          font-weight: 600;
          font-size: clamp(72px, 14vw, 160px);
          letter-spacing: 0.22em;
          margin-right: -0.22em;
          text-shadow: 0 2px 40px rgba(0, 0, 0, 0.45);
        }
        .concept-tagline {
          font-size: clamp(16px, 2.4vw, 22px);
          letter-spacing: 0.5em;
          margin-right: -0.5em;
          color: rgba(232, 226, 214, 0.55);
        }
        .concept-cta {
          margin-top: 20px;
          display: inline-block;
          padding: 14px 52px;
          border: 1px solid rgba(216, 169, 92, 0.65);
          border-radius: 999px;
          color: #d8a95c;
          font-size: 16px;
          letter-spacing: 0.3em;
          margin-right: -0.3em;
          text-decoration: none;
          backdrop-filter: blur(6px);
          background: rgba(16, 20, 28, 0.25);
          transition: background 0.4s ease, box-shadow 0.4s ease;
        }
        .concept-cta:hover {
          background: rgba(216, 169, 92, 0.14);
          box-shadow: 0 0 32px rgba(216, 169, 92, 0.25);
        }
      `}</style>

      <h1 className="concept-title">{zh ? "彼岸" : "The Other Shore"}</h1>
      <p className="concept-tagline">{zh ? "思念有处安放" : "Where memories rest"}</p>
      <Link className="concept-cta" href={`/${lang}/garden`}>
        {zh ? "进入彼岸" : "Enter"}
      </Link>
    </ConceptStage>
  );
}
