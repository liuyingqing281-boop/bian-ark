import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { canViewMemorial } from "../../../../lib/permissions";
import GiftFlow from "../../../../components/hall/GiftFlow";

// 为 TA 准备一份礼物（2.8）：三步流页面，能力走 /api/items/prompt|generate|claim
interface Memorial { id: string; name: string; user_id: string; visibility: string }

export default async function GiftPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const db = getDb();
  const memorial = db.prepare("SELECT id, name, user_id, visibility FROM memorials WHERE id = ? AND is_published = 1").get(id) as Memorial | undefined;
  const user = await getSessionUser();

  if (!memorial || !canViewMemorial(memorial, user?.id ?? null)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#070302", color: "#fff6ec" }}>
        <p className="text-5xl">🕊️</p>
        <p className="text-sm" style={{ color: "rgba(255,246,236,.5)" }}>纪念馆不存在或未公开</p>
        <a href={`/${lang}`} className="text-sm underline underline-offset-4" style={{ color: "#ffb35c" }}>返回首页</a>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(120% 55% at 50% -8%, rgba(255,106,32,.26), transparent 60%), radial-gradient(90% 40% at 50% 115%, rgba(180,58,14,.2), transparent 65%), #070302",
        color: "#fff6ec",
        fontFamily: "'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif",
      }}
    >
      <div className="mx-auto max-w-lg md:max-w-[640px] px-5 py-10">
        <a href={`/${lang}/hall/${id}`} className="text-[13px]" style={{ color: "rgba(255,246,236,.45)" }}>← 返回纪念馆</a>
        <h1 className="mt-4 text-2xl tracking-[0.15em]" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
          为 TA 准备一份礼物
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "rgba(255,246,236,.5)" }}>
          说说心愿，帮 {memorial.name} 准备一件特别的纪念物
        </p>

        <div className="mt-8">
          <GiftFlow memorialId={id} lang={lang} memorialName={memorial.name} />
        </div>
      </div>
    </div>
  );
}
