import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { canViewMemorial, ownsMemorial } from "../../../../lib/permissions";
import FamilyPanel, { BoundGroup } from "../../../../components/hall/FamilyPanel";

// 亲友共同纪念页（2.10）：馆主生成分享链接 / 邀请协作人；亲友经链接加入
// 打码规则「李**」在展示层做，库内存原文
function maskName(name: string): string {
  const n = (name || "").trim();
  return n ? n.slice(0, 1) + "**" : "访客";
}

interface Memorial { id: string; name: string; user_id: string; visibility: string }

export default async function FamilyPage({
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

  const isOwner = ownsMemorial(memorial, user?.id ?? null);

  const boundGroups: BoundGroup[] = (
    db.prepare(
      `SELECT g.id, g.name, g.invite_code FROM memorial_groups mg JOIN groups g ON g.id = mg.group_id WHERE mg.memorial_id = ?`
    ).all(id) as { id: string; name: string; invite_code: string }[]
  ).map((g) => ({
    id: g.id,
    name: g.name,
    inviteCode: g.invite_code,
    members: (
      db.prepare(
        `SELECT u.name, gm.role, gm.joined_at FROM group_members gm JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ? ORDER BY gm.role DESC, gm.joined_at`
      ).all(g.id) as { name: string; role: string; joined_at: string }[]
    ).map((m) => ({ nameMasked: maskName(m.name), role: m.role, joinedAt: m.joined_at })),
  }));

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
      <div className="mx-auto max-w-lg px-5 py-10">
        <a href={`/${lang}/hall/${id}`} className="text-[13px]" style={{ color: "rgba(255,246,236,.45)" }}>← 返回纪念馆</a>
        <h1 className="mt-4 text-2xl tracking-[0.15em]" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
          亲友共同纪念
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "rgba(255,246,236,.5)" }}>
          邀请亲友一起记住 {memorial.name}：留言、献花、补充记忆
        </p>

        <div className="mt-8">
          {isOwner || boundGroups.length ? (
            <FamilyPanel
              memorialId={id}
              lang={lang}
              memorialName={memorial.name}
              isOwner={isOwner}
              boundGroups={boundGroups}
            />
          ) : (
            <FamilyPanel memorialId={id} lang={lang} memorialName={memorial.name} isOwner={false} boundGroups={[]} />
          )}
        </div>
      </div>
    </div>
  );
}
