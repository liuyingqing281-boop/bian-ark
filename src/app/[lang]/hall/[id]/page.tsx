import { permanentRedirect } from "next/navigation";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { ownsMemorial } from "../../../../lib/permissions";
import { trackEvent } from "../../../../lib/events";
import { defaultLocale, getDictionary, hasLocale } from "../../dictionaries";
import HallChat from "../../../../components/hall/HallChat";
import HallOffer, { OfferItem } from "../../../../components/hall/HallOffer";
import FeedList from "../../../../components/hall/FeedList";
import MediaManager, { MediaItem } from "../../../../components/MediaManager";
import HallSceneClient, { HallSceneMember } from "../../../../components/hall/HallSceneClient";

// 馆级页（Task 5）：/[lang]/hall/[hallId] 为规范地址，参数先按 halls.id 解析；
// 旧 /[lang]/hall/[memorialId] 链接解析出所属馆后 permanentRedirect 到
// /[lang]/hall/[hallId]?p=[memorialId]（落地即聚焦该人物）。解析顺序保证用户
// 提供的 memorial id 永远不会被当作 hall id 参与成员查询（先 halls 后 memorials）。
// 人物层沿用暗红熔岩风格（锚点 Tab / 混合纪念流 / 记忆·想念·祭奠三区）；
// 馆级公共层（多人馆默认态）= 群像名单（1–6 盏灯）。

type HallRouteResolution =
  | { kind: "hall"; hallId: string }
  | { kind: "legacyMemorial"; memorialId: string; hallId: string }
  | { kind: "notFound" };

interface HallRow {
  id: string; name: string; motto: string; skin: string; visibility: string; owner_user_id: string;
}
interface MemberRow {
  id: string; name: string; avatar_url: string; birth_date: string; death_date: string; epitaph: string;
}
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

// 访客侧姓名脱敏（与 /api/halls/[id] nameMasked、星海 FR-04 同规则：首字 + **）
function maskDisplayName(name: string): string {
  return name.length <= 1 ? "*" : name[0] + "**";
}

function yearOf(date: string): string {
  return (date || "").slice(0, 4) || "????";
}

// 路由解析：halls.id 优先；查不到再按 memorials.id 找所属馆
// （hall_id 为空时回落 hall_ + memorial.id，须确认该馆存在）
function resolveHallRoute(id: string): HallRouteResolution {
  const db = getDb();
  const hall = db.prepare("SELECT id FROM halls WHERE id = ?").get(id) as { id: string } | undefined;
  if (hall) return { kind: "hall", hallId: id };
  const memorial = db
    .prepare("SELECT id, hall_id FROM memorials WHERE id = ? AND is_published = 1")
    .get(id) as { id: string; hall_id: string | null } | undefined;
  if (memorial) {
    let hallId = memorial.hall_id || "";
    if (!hallId) {
      const fallback = `hall_${memorial.id}`;
      const exists = db.prepare("SELECT 1 AS ok FROM halls WHERE id = ?").get(fallback);
      if (exists) hallId = fallback;
    }
    if (hallId) return { kind: "legacyMemorial", memorialId: memorial.id, hallId };
  }
  return { kind: "notFound" };
}

// 馆级可见性（与 /api/halls/[id] canViewHall 同口径）：public 皆可；private 仅馆主；
// group 馆内任一人物关联群的成员。route.ts 不允许导出非 HTTP 符号，此处就近复制。
function canViewHallFor(hall: HallRow, userId: string | null): boolean {
  if (hall.visibility === "public") return true;
  if (!userId) return false;
  if (hall.owner_user_id === userId) return true;
  if (hall.visibility === "group") {
    const row = getDb()
      .prepare(
        `SELECT 1 AS ok FROM memorials m
         JOIN memorial_groups mg ON mg.memorial_id = m.id
         JOIN group_members gm ON gm.group_id = mg.group_id
         WHERE m.hall_id = ? AND gm.user_id = ? LIMIT 1`
      )
      .get(hall.id, userId);
    return !!row;
  }
  return false;
}

function NotFoundHall({ lang }: { lang: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#070302", color: "#fff6ec" }}>
      <p className="text-5xl">🕊️</p>
      <p className="text-sm" style={{ color: "rgba(255,246,236,.5)" }}>纪念馆不存在或未公开</p>
      <a href={`/${lang}`} className="text-sm underline underline-offset-4" style={{ color: EMBER_SOFT }}>返回首页</a>
    </div>
  );
}

export default async function HallPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ p?: string; from?: string }>;
}) {
  const { lang, id } = await params;
  const { p, from } = await searchParams;

  const db = getDb();
  const resolution = resolveHallRoute(id);
  if (resolution.kind === "notFound") return <NotFoundHall lang={lang} />;

  const hall = db
    .prepare("SELECT id, name, motto, skin, visibility, owner_user_id FROM halls WHERE id = ?")
    .get(resolution.hallId) as HallRow | undefined;
  const user = await getSessionUser();
  const userId = user?.id ?? null;
  // 权限先于重定向：私密/群组馆对无权视角一律 404，旧人物 id 不构成绕过
  if (!hall || !canViewHallFor(hall, userId)) return <NotFoundHall lang={lang} />;

  if (resolution.kind === "legacyMemorial") {
    const target = new URLSearchParams();
    target.set("p", resolution.memorialId);
    if (from === "garden") target.set("from", "garden"); // 仅状态恢复用途，非权限输入
    permanentRedirect(`/${lang}/hall/${encodeURIComponent(resolution.hallId)}?${target.toString()}`);
  }

  const isHallOwner = !!userId && hall.owner_user_id === userId;

  // 成员（灯）：本馆 1–6 位人物；访客姓名脱敏，馆主原文
  const memberRows = db
    .prepare(
      `SELECT id, name, avatar_url, birth_date, death_date, epitaph
       FROM memorials WHERE hall_id = ? AND is_published = 1 ORDER BY created_at ASC LIMIT 6`
    )
    .all(hall.id) as MemberRow[];
  const litRows = db
    .prepare(
      `SELECT memorial_id FROM tributes
       WHERE memorial_id IN (${memberRows.map(() => "?").join(",") || "''"})
         AND created_at >= datetime('now', '-24 hours')
       GROUP BY memorial_id`
    )
    .all(...memberRows.map((m) => m.id)) as Array<{ memorial_id: string }>;
  const lit = new Set(litRows.map((row) => row.memorial_id));

  const members: HallSceneMember[] = memberRows.map((m) => ({
    id: m.id,
    name: isHallOwner ? m.name : maskDisplayName(m.name),
    avatarUrl: m.avatar_url || "",
    birthYear: yearOf(m.birth_date),
    deathYear: yearOf(m.death_date),
    epitaph: m.epitaph || "",
    candleLit: lit.has(m.id),
  }));

  // 聚焦：?p 只在命中本馆成员时生效；多人馆默认馆级公共层，
  // 单人馆「行为不变」（13 号方案 §3.2）默认直接渲染该人物层
  const wanted = typeof p === "string" ? p : "";
  const focusedMember = memberRows.find((m) => m.id === wanted) || (memberRows.length === 1 ? memberRows[0] : null);

  const dict = getDictionary(hasLocale(lang) ? lang : defaultLocale);
  const zh = lang !== "en";

  let personLayer: React.ReactNode = null;
  let chatBody: React.ReactNode = null;

  if (focusedMember) {
    const memorial = db
      .prepare(
        `SELECT id, name, avatar_url, cover_url, birth_date, death_date, epitaph, biography, user_id, visibility
         FROM memorials WHERE id = ? AND is_published = 1`
      )
      .get(focusedMember.id) as Memorial | undefined;
    if (memorial) {
      const isPersonOwner = ownsMemorial(memorial, userId);
      if (isPersonOwner && user) {
        trackEvent("memorial_owner_visit", { memorial_id: memorial.id, via: "hall" }, user.id);
      }
      const displayName = isHallOwner ? memorial.name : maskDisplayName(memorial.name);

      const events = db
        .prepare("SELECT id, year, title, description FROM life_events WHERE memorial_id = ? ORDER BY year ASC, sort_order ASC")
        .all(memorial.id) as LifeEvent[];
      const items = db
        .prepare("SELECT id, name, icon, is_premium, image_url FROM items WHERE owner_user_id = '' AND review_status = 'approved' ORDER BY is_premium ASC, sort_order ASC")
        .all() as Item[];
      const freeItems: OfferItem[] = items
        .filter((it) => !it.is_premium)
        .slice(0, 6)
        .map((it) => ({ id: it.id, label: it.name, icon: it.icon, imageUrl: it.image_url }));
      const candleLit = !!db
        .prepare("SELECT 1 FROM tributes WHERE memorial_id = ? AND is_burning = 1 LIMIT 1")
        .get(memorial.id);
      const media = db
        .prepare(
          `SELECT id, kind, url, thumb_url, caption, sort_order, is_cover, review_status
           FROM media WHERE memorial_id = ? ${isPersonOwner ? "" : "AND review_status = 'approved'"}
           ORDER BY is_cover DESC, sort_order ASC, created_at ASC`
        )
        .all(memorial.id) as MediaItem[];

      const born = yearOf(memorial.birth_date);
      const died = yearOf(memorial.death_date);

      personLayer = (
        <>
          {/* 顶部锚点 Tab（三等宽） */}
          <div
            className="sticky top-[53px] z-20 md:top-[61px]"
            style={{ background: "rgba(7,3,2,.88)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,.07)" }}
          >
            <nav className="flex max-w-lg mx-auto">
              {([
                { key: "memorial", icon: "🏛️", label: zh ? "纪念馆" : "Memorial" },
                { key: "memory",   icon: "📖", label: zh ? "记忆" : "Memory" },
                { key: "miss",     icon: "💭", label: zh ? "想念" : "Miss" },
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

          {/* ---- Tab: 纪念馆 ---- */}
          <section id="memorial">
            {/* Hero */}
            <div className="flex flex-col items-center text-center mb-10">
              <div className="relative">
                {memorial.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={memorial.avatar_url}
                    alt={displayName}
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
                    {displayName.slice(0, 1)}
                  </div>
                )}
                {candleLit && (
                  <span className="absolute -bottom-1 -right-1 text-lg" title="灯还亮着">🕯️</span>
                )}
              </div>
              <h1 className="mt-5 text-3xl tracking-[0.2em]" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
                {displayName}
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
                {zh ? "今天想为 TA 做什么？" : "What would you like to do for them today?"}
              </h2>
              <HallOffer memorialId={memorial.id} lang={lang} items={freeItems} />

              {/* 特别礼物入口（次级：通栏描边卡片，视觉弱于宫格，无催促元素） */}
              <a
                href={`/${lang}/gift/${memorial.id}`}
                className="mt-4 h-12 rounded-2xl flex items-center justify-center gap-2 text-[14px] transition active:opacity-85"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,179,92,.3)",
                  color: EMBER_SOFT,
                }}
              >
                ✨ {zh ? "为 TA 准备特别的礼物" : "Prepare a special gift"}
              </a>

              {isPersonOwner && (
                <a
                  href={`/${lang}/family/${memorial.id}`}
                  className="mt-3 h-12 rounded-2xl flex items-center justify-center gap-2 text-[14px] transition active:opacity-85"
                  style={{
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid rgba(255,255,255,.1)",
                    color: "rgba(255,246,236,.75)",
                  }}
                >
                  👪 {zh ? "亲友共同纪念" : "Share with family"}
                </a>
              )}
            </section>

            {/* TA 的人生 */}
            {events.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg tracking-wider" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
                  {zh ? "TA 的人生" : "Their life"}
                </h2>
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
                <h2 className="text-lg tracking-wider" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
                  {zh ? "生平" : "Biography"}
                </h2>
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
                {zh ? "TA 的记忆档案" : "Memory archive"}
              </h2>
              <a
                href={`/${lang}/memory/${memorial.id}?memorial_id=${memorial.id}&name=${encodeURIComponent(displayName)}`}
                className="text-[13px] rounded-full px-4 py-1.5 transition active:opacity-85"
                style={{
                  background: "rgba(255,122,47,.1)",
                  border: "1px solid rgba(255,179,92,.3)",
                  color: EMBER_SOFT,
                }}
              >
                {zh ? "查看全部 →" : "View all →"}
              </a>
            </div>
            {isPersonOwner ? (
              // 馆主：MediaManager 直接上传/管理影像记忆（owner-journey 上传链路）
              <MediaManager memorialId={memorial.id} media={media} labels={dict.memorial} />
            ) : media.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {media.map((item) =>
                  item.kind === "video" ? (
                    <video key={item.id} src={item.url} controls className="w-full aspect-square object-cover rounded-lg bg-stone-800" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={item.id}
                      src={item.thumb_url || item.url}
                      alt={item.caption}
                      className="w-full aspect-square object-cover rounded-lg bg-stone-800"
                    />
                  )
                )}
              </div>
            ) : (
              <div
                className="rounded-2xl p-5 text-center"
                style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)" }}
              >
                <p className="text-[14px]" style={{ color: "rgba(255,246,236,.5)" }}>
                  {zh ? "记忆档案帮助 TA 记住更多关于 TA 的事" : "The memory archive keeps their story alive"}
                </p>
              </div>
            )}
          </section>

          {/* ---- Tab: 想念 ---- */}
          <section id="miss" className="mt-14 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg tracking-wider" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
                {zh ? "想念 TA" : "Missing them"}
              </h2>
            </div>
            <div
              className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)" }}
            >
              <p className="text-[14px] mb-4" style={{ color: "rgba(255,246,236,.5)" }}>
                {zh ? "留下想对 TA 说的话，或开启一段对话" : "Leave a message, or start a conversation"}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={`/${lang}/miss?memorial_id=${memorial.id}&name=${encodeURIComponent(displayName)}&avatar=${encodeURIComponent(memorial.avatar_url || "")}`}
                  className="flex-1 h-11 rounded-full flex items-center justify-center gap-2 text-[14px] text-white transition active:opacity-85"
                  style={{
                    background: "linear-gradient(135deg,#ff8a3d 0%,#f45d12 55%,#d9480f 100%)",
                    boxShadow: "0 4px 16px rgba(244,93,18,.35)",
                  }}
                >
                  💬 {zh ? "留下想念" : "Leave a message"}
                </a>
                <a
                  href="#memorial"
                  className="flex-1 h-11 rounded-full flex items-center justify-center gap-2 text-[14px] transition active:opacity-85"
                  style={{
                    background: "rgba(255,255,255,.06)",
                    border: "1px solid rgba(255,255,255,.12)",
                    color: "#fff6ec",
                  }}
                >
                  🕯️ {zh ? "去祭奠 TA" : "Pay a tribute"}
                </a>
              </div>
            </div>
          </section>

          {/* 最近的纪念（混合纪念流） */}
          <section className="mt-14 pt-4">
            <h2 className="text-lg tracking-wider mb-4" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
              {zh ? "最近的纪念" : "Recent tributes"}
            </h2>
            <FeedList
              memorialId={memorial.id}
              lang={lang}
              showEmpty
              emptyAction={{
                href: `/${lang}/miss?memorial_id=${memorial.id}&name=${encodeURIComponent(displayName)}`,
                label: zh ? "留下第一句话" : "Leave the first message",
              }}
            />
          </section>
        </>
      );

      chatBody = (
        <HallChat memorialId={memorial.id} memorialName={displayName} avatarUrl={memorial.avatar_url || ""} />
      );
    }
  }

  return (
    <HallSceneClient
      lang={lang}
      hallId={hall.id}
      hallName={isHallOwner ? hall.name : maskDisplayName(hall.name)}
      motto={hall.motto || ""}
      members={members}
      pActive={!!focusedMember && !!wanted && focusedMember.id === wanted}
      personActive={!!personLayer}
      personLayer={personLayer}
      chatBody={chatBody}
    />
  );
}
