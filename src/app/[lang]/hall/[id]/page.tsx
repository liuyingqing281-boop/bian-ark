import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { canViewMemorial, ownsMemorial } from "../../../../lib/permissions";
import { trackEvent } from "../../../../lib/events";
import HallChat from "../../../../components/hall/HallChat";
import PcChatButton from "../../../../components/pc/PcChatButton";
import RegisterPcChat from "../../../../components/pc/RegisterPcChat";
import HallOffer, { OfferItem } from "../../../../components/hall/HallOffer";
import FeedList from "../../../../components/hall/FeedList";
import Link from "next/link";

// 暗红熔岩风格纪念馆页：锚点 Tab / 混合纪念流 / 记忆·想念·祭奠三区
// 与既有 /[lang]/memorial/[id] 页面并存，不改旧页

interface Memorial {
  id: string; name: string; avatar_url: string; cover_url: string;
  birth_date: string; death_date: string; epitaph: string; biography: string;
  user_id: string; visibility: string;
}
interface LifeEvent { id: string; year: number; title: string; description: string }
interface Item { id: string; name: string; icon: string; is_premium: number; image_url: string; }

const EMBER = "#ff7a2f";
const EMBER_SOFT = "#ffb35c";

type Tab = "memorial" | "memory" | "miss";

export default async function HallPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;

  const db = getDb();
  const memorial = db.prepare("SELECT * FROM memorials WHERE id = ? AND is_published = 1").get(id) as Memorial | undefined;
  const user = await getSessionUser();
  if (!memorial || !canViewMemorial(memorial, user?.id ?? null)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#070302", color: "#fff6ec" }}>
        <p className="text-5xl">🕊️</p>
        <p className="text-sm" style={{ color: "rgba(255,246,236,.5)" }}>纪念馆不存在或未公开</p>
        <a href={`/${lang}`} className="text-sm underline underline-offset-4" style={{ color: EMBER_SOFT }}>返回首页</a>
      </div>
    );
  }

  const isOwner = ownsMemorial(memorial, user?.id ?? null);
  if (isOwner && user) trackEvent("memorial_owner_visit", { memorial_id: id, via: "hall" }, user.id);

  const events = db
    .prepare("SELECT id, year, title, description FROM life_events WHERE memorial_id = ? ORDER BY year ASC, sort_order ASC")
    .all(id) as LifeEvent[];
  const items = db
    .prepare("SELECT id, name, icon, is_premium, image_url FROM items WHERE owner_user_id = '' AND review_status = 'approved' ORDER BY is_premium ASC, sort_order ASC")
    .all() as Item[];
  const freeItems: OfferItem[] = items
    .filter((it) => !it.is_premium)
    .slice(0, 6)
    .map((it) => ({ id: it.id, label: it.name, icon: it.icon, imageUrl: it.image_url }));

  const candleLit = !!db
    .prepare("SELECT 1 FROM tributes WHERE memorial_id = ? AND is_burning = 1 LIMIT 1")
    .get(id);

  const born = (memorial.birth_date || "").slice(0, 4) || "????";
  const died = (memorial.death_date || "").slice(0, 4) || "????";

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
      {/* 顶部锚点 Tab（三等宽） */}
      <div
        className="sticky top-0 z-30"
        style={{ background: "rgba(7,3,2,.88)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,.07)" }}
      >
        <nav className="flex max-w-lg md:max-w-[880px] mx-auto">
          {([
            { key: "memorial", icon: "🏛️", label: "纪念馆" },
            { key: "memory",   icon: "📖", label: "记忆" },
            { key: "miss",     icon: "💭", label: "想念" },
          ] as { key: Tab; icon: string; label: string }[]).map((tab) => (
            <a
              key={tab.key}
              href={`#${tab.key}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[13px] transition-colors border-b-2 border-transparent text-[rgba(255,246,236,.45)] hover:text-[#fff6ec]"
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </a>
          ))}
        </nav>
      </div>

      <div className="hall-grid mx-auto max-w-6xl px-5 lg:px-8 py-8 lg:py-12 grid gap-10 lg:grid-cols-[1fr_380px]">

        {/* ============ 左：纪念馆主体（按 Tab 分区） ============ */}
        <div className="min-w-0">

          {/* ---- Tab: 纪念馆 ---- */}
          <section id="memorial">
            {/* Hero */}
            <div className="flex flex-col items-center text-center mb-10">
              <div className="relative">
                {memorial.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={memorial.avatar_url}
                    alt={memorial.name}
                    className="w-28 h-28 rounded-full object-cover"
                    style={{ boxShadow: "0 0 44px rgba(255,122,47,.55), 0 0 100px rgba(244,93,18,.3)" }}
                  />
                ) : (
                  <div
                    className="w-28 h-28 rounded-full flex items-center justify-center text-4xl"
                    style={{
                      background: "linear-gradient(135deg,#ff8a3d,#b43a0e)",
                      boxShadow: "0 0 44px rgba(255,122,47,.55)",
                      fontFamily: "'Noto Serif SC','Songti SC',serif",
                    }}
                  >
                    {memorial.name.slice(0, 1)}
                  </div>
                )}
                {candleLit && (
                  <span className="absolute -bottom-1 -right-1 text-lg" title="灯还亮着">🕯️</span>
                )}
              </div>
              <h1 className="mt-5 text-3xl tracking-[0.2em]" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
                {memorial.name}
              </h1>
              <p className="mt-1 text-sm tracking-[0.3em]" style={{ color: "rgba(255,246,236,.38)" }}>
                {born} — {died}
              </p>
              {memorial.epitaph && (
                <p className="mt-3 text-[13px]" style={{ color: "rgba(255,246,236,.6)" }}>“{memorial.epitaph}”</p>
              )}
              {candleLit && (
                <p className="mt-3 text-[11px] flex items-center gap-2" style={{ color: "rgba(255,246,236,.45)" }}>
                  <span className="inline-block w-2 h-3 rounded-t-full" style={{ background: EMBER }} />
                  灯还亮着
                </p>
              )}
            </div>

            {/* 供奉 */}
            <section className="mt-8">
              <h2 className="text-lg tracking-wider" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
                今天想为 TA 做什么？
              </h2>
              <HallOffer memorialId={id} lang={lang} items={freeItems} />

              {/* 特别礼物入口（次级：通栏描边卡片，视觉弱于宫格，无催促元素） */}
              <a
                href={`/${lang}/gift/${id}`}
                className="mt-4 h-12 rounded-2xl flex items-center justify-center gap-2 text-[14px] transition active:opacity-85"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,179,92,.3)",
                  color: EMBER_SOFT,
                }}
              >
                ✨ 为 TA 准备特别的礼物
              </a>

              {isOwner && (
                <a
                  href={`/${lang}/family/${id}`}
                  className="mt-3 h-12 rounded-2xl flex items-center justify-center gap-2 text-[14px] transition active:opacity-85"
                  style={{
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid rgba(255,255,255,.1)",
                    color: "rgba(255,246,236,.75)",
                  }}
                >
                  👪 亲友共同纪念
                </a>
              )}
            </section>

            {/* TA 的人生 */}
            {events.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg tracking-wider" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>TA 的人生</h2>
                <div
                  className="mt-4 rounded-3xl p-6"
                  style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)" }}
                >
                  <div className="space-y-4">
                    {events.map((ev) => (
                      <div key={ev.id} className="flex items-baseline gap-5">
                        <span
                          className="w-14 shrink-0 text-right text-[15px]"
                          style={{ color: EMBER_SOFT, fontFamily: "'Noto Serif SC','Songti SC',serif" }}
                        >
                          {ev.year}
                        </span>
                        <span className="w-2 h-2 rounded-full shrink-0 self-center" style={{ background: EMBER }} />
                        <div>
                          <p className="text-[15px]">{ev.title}</p>
                          {ev.description && (
                            <p className="text-[13px] mt-0.5" style={{ color: "rgba(255,246,236,.5)" }}>{ev.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* 生平 */}
            {memorial.biography && (
              <section className="mt-10">
                <h2 className="text-lg tracking-wider" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>生平</h2>
                <div
                  className="mt-4 rounded-3xl p-6 text-[15px] leading-8 whitespace-pre-line"
                  style={{
                    background: "rgba(255,255,255,.05)",
                    border: "1px solid rgba(255,255,255,.09)",
                    color: "rgba(255,246,236,.8)",
                  }}
                >
                  {memorial.biography}
                </div>
              </section>
            )}
          </section>

          {/* ---- Tab: 记忆 ---- */}
          <section id="memory" className="mt-14 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg tracking-wider" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
                TA 的记忆档案
              </h2>
              <a
                href={`/${lang}/memory/${id}?memorial_id=${id}&name=${encodeURIComponent(memorial.name)}`}
                className="text-[13px] rounded-full px-4 py-1.5 transition active:opacity-85"
                style={{
                  background: "rgba(255,122,47,.1)",
                  border: "1px solid rgba(255,179,92,.3)",
                  color: EMBER_SOFT,
                }}
              >
                查看全部 →
              </a>
            </div>
            {/* 记忆统计卡片（SSR 读取不了 memories 表，这里做引导） */}
            <div
              className="rounded-2xl p-5 text-center"
              style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)" }}
            >
              <p className="text-[14px]" style={{ color: "rgba(255,246,236,.5)" }}>
                记忆档案帮助 TA 记住更多关于 TA 的事
              </p>
              <a
                href={`/${lang}/memory/${id}?memorial_id=${id}&name=${encodeURIComponent(memorial.name)}`}
                className="inline-block mt-4 h-10 rounded-full px-6 text-[14px] flex items-center gap-2 text-white transition active:opacity-85"
                style={{
                  background: "rgba(255,255,255,.06)",
                  border: "1px solid rgba(255,255,255,.12)",
                }}
              >
                📖 打开记忆档案
              </a>
            </div>
          </section>

          {/* ---- Tab: 想念 ---- */}
          <section id="miss" className="mt-14 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg tracking-wider" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
                想念 TA
              </h2>
            </div>
            <div
              className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)" }}
            >
              <p className="text-[14px] mb-4" style={{ color: "rgba(255,246,236,.5)" }}>
                留下想对 TA 说的话，或开启一段对话
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={`/${lang}/miss?memorial_id=${id}&name=${encodeURIComponent(memorial.name)}&avatar=${encodeURIComponent(memorial.avatar_url || "")}`}
                  className="flex-1 h-11 rounded-full flex items-center justify-center gap-2 text-[14px] text-white transition active:opacity-85"
                  style={{
                    background: "linear-gradient(135deg,#ff8a3d 0%,#f45d12 55%,#d9480f 100%)",
                    boxShadow: "0 4px 16px rgba(244,93,18,.35)",
                  }}
                >
                  💬 留下想念
                </a>
                <a
                  href={`/${lang}/hall/${id}#memorial`}
                  className="flex-1 h-11 rounded-full flex items-center justify-center gap-2 text-[14px] transition active:opacity-85"
                  style={{
                    background: "rgba(255,255,255,.06)",
                    border: "1px solid rgba(255,255,255,.12)",
                    color: "#fff6ec",
                  }}
                >
                  🕯️ 去祭奠 TA
                </a>
                <PcChatButton />
              </div>
            </div>
          </section>

          {/* 最近的纪念（混合纪念流） */}
          <section className="mt-14 pt-4">
            <h2 className="text-lg tracking-wider mb-4" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
              最近的纪念
            </h2>
            <FeedList
              memorialId={id}
              lang={lang}
              showEmpty
              emptyAction={{
                href: `/${lang}/miss?memorial_id=${id}&name=${encodeURIComponent(memorial.name)}`,
                label: "留下第一句话",
              }}
            />
          </section>

        </div>

        {/* ============ 右：和 TA 说说话（Sticky） ============ */}
        <aside className="hall-inline-chat lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)]">
          <HallChat memorialId={id} memorialName={memorial.name} avatarUrl={memorial.avatar_url || ""} />
        </aside>
      </div>

      {/* 注册为 PC 对话侧板的对话对象（M2，移动端无影响） */}
      <RegisterPcChat memorialId={id} memorialName={memorial.name} avatarUrl={memorial.avatar_url || ""} />
    </div>
  );
}
