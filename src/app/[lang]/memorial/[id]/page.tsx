import Image from "next/image";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { canViewMemorial, ownsMemorial } from "../../../../lib/permissions";
import { renderLimitedMarkdown } from "../../../../lib/markdown";
import { defaultLocale, getDictionary, hasLocale } from "../../dictionaries";
import MediaManager, { MediaItem } from "../../../../components/MediaManager";
import OfferPanel, { PanelItem } from "../../../../components/OfferPanel";
import DigitalHumanPanel from "../../../../components/DigitalHumanPanel";
import MemorialHero from "../../../../components/MemorialHero";
import Flame from "../../../../components/Flame";
import type { DhTask } from "../../../../components/DigitalHumanPanel";
import { activeProvider } from "../../../../lib/digitalhuman";
import { trackEvent } from "../../../../lib/events";
import TimelineManager from "../../../../components/TimelineManager";
import type { LifeEvent } from "../../../../components/TimelineManager";
import ItemAsset from "../../../../components/ItemAsset";

interface Memorial {
  id: string; name: string; type: string; avatar_url: string; cover_url: string;
  birth_date: string; death_date: string; epitaph: string; biography: string;
  created_at: string; user_id: string; visibility: string;
}
interface Tribute {
  id: string; item_id: string; message: string; sender_name: string; is_burning: number; created_at: string;
}
interface Item {
  id: string; name: string; icon: string; category: string; is_premium: number; image_url: string;
}

function getMemorial(id: string): Memorial | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM memorials WHERE id = ? AND is_published = 1").get(id) as Memorial) || null;
}
function getTributes(memorialId: string, owner: boolean, limit = 50): Tribute[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM tributes WHERE memorial_id = ? ${owner ? "" : "AND review_status = 'approved'"} ORDER BY created_at DESC LIMIT ?`).all(memorialId, limit) as Tribute[];
}
function getItem(itemId: string): Item | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM items WHERE id = ?").get(itemId) as Item) || null;
}
function getOfficialItems(): Item[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM items WHERE owner_user_id = '' AND review_status = 'approved' ORDER BY is_premium ASC, sort_order ASC")
    .all() as Item[];
}
function getMyItems(userId: string): Item[] {
  const db = getDb();
  return db.prepare("SELECT * FROM items WHERE owner_user_id = ? ORDER BY rowid DESC").all(userId) as Item[];
}
function getMedia(memorialId: string, owner: boolean): MediaItem[] {
  const db = getDb();
  return db
    .prepare(`SELECT id, kind, url, thumb_url, caption, sort_order, is_cover, review_status
              FROM media WHERE memorial_id = ? ${owner ? "" : "AND review_status = 'approved'"}
              ORDER BY is_cover DESC, sort_order ASC, created_at ASC`)
    .all(memorialId) as MediaItem[];
}
function getLifeEvents(memorialId: string): LifeEvent[] {
  const db = getDb();
  return db
    .prepare("SELECT id, year, title, description FROM life_events WHERE memorial_id = ? ORDER BY year ASC, sort_order ASC")
    .all(memorialId) as LifeEvent[];
}
function getDigitalHumans(memorialId: string, owner: boolean): DhTask[] {
  const db = getDb();
  if (owner) {
    return db
      .prepare("SELECT id, status, script, result_video_url, error, created_at FROM digital_humans WHERE memorial_id = ? ORDER BY created_at DESC")
      .all(memorialId) as DhTask[];
  }
  return db
    .prepare("SELECT id, status, script, result_video_url, error, created_at FROM digital_humans WHERE memorial_id = ? AND status = 'done' ORDER BY created_at DESC")
    .all(memorialId) as DhTask[];
}

export default async function MemorialPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const dict = getDictionary(lang);
  const itemLabel = (item: Item | null | undefined) =>
    (item && dict.items[item.id as keyof typeof dict.items]) || item?.name || dict.memorial.defaultItem;
  const toPanelItem = (item: Item): PanelItem => ({
    id: item.id,
    label: itemLabel(item),
    icon: item.icon,
    image_url: item.image_url,
    premium: item.is_premium,
  });

  const user = await getSessionUser();
  const memorial = getMemorial(id);
  const denied = !memorial || !canViewMemorial(memorial, user?.id ?? null);
  if (denied) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-5xl mb-6">🕊️</p>
        <h2 className="text-xl text-stone-400 mb-2">{dict.memorial.notFoundTitle}</h2>
        <p className="text-stone-600 text-sm mb-8">{dict.memorial.notFoundDesc}</p>
        <a href={`/${lang}`} className="text-amber-500 hover:text-amber-400 transition text-sm">{dict.memorial.backHome}</a>
      </div>
    );
  }

  const isOwner = ownsMemorial(memorial, user?.id ?? null);
  if (isOwner && user) {
    // 30 日回访率数据源：仅记录馆主本人的到访
    trackEvent("memorial_owner_visit", { memorial_id: id }, user.id);
  }
  const tributes = getTributes(id, isOwner);
  const media = getMedia(id, isOwner);
  const officialItems = getOfficialItems();
  const myItems = user ? getMyItems(user.id) : [];
    const lifeEvents = getLifeEvents(id);
  const dhTasks = getDigitalHumans(id, isOwner);
  const publicDhTasks = isOwner ? [] : dhTasks;

  return (
    <div className="ui-page max-w-4xl pb-16 pt-8 sm:pb-24 sm:pt-12">
      <MemorialHero memorial={memorial} isOwner={isOwner} lang={lang} labels={dict.memorial} />
      <section id="biography" className="ui-panel mb-10 p-6 sm:p-8">
        <h2 className="ui-section-ornate mb-6">{dict.memorial.biography}</h2>
        {memorial.biography ? (
          <div className="prose prose-invert max-w-prose text-sm leading-7 text-stone-400" dangerouslySetInnerHTML={{ __html: renderLimitedMarkdown(memorial.biography) }} />
        ) : (
          <p className="text-sm italic text-stone-600">{dict.memorial.biographyEmpty}</p>
        )}
      </section>

      {(isOwner || publicDhTasks.length > 0) && (
        <section id="digital-human" className="ui-panel mb-10 p-6 sm:p-8">
          <h2 className="ui-section-title mb-2">{dict.digitalHuman.title}</h2>
          {isOwner && user ? (
            <>
              <p className="mb-4 text-xs text-stone-500">{dict.digitalHuman.intro}</p>
              <DigitalHumanPanel memorialId={memorial.id} initialTasks={dhTasks} isPremium={user.membership_tier === "premium"} isMock={activeProvider() === "mock"} upgradeHref={`/${lang}/membership`} labels={dict.digitalHuman} />
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {publicDhTasks.map((task) => <div key={task.id} className="relative overflow-hidden rounded-lg bg-stone-800"><div className="relative aspect-square">{/\.(mp4|webm)(\?|$)/i.test(task.result_video_url) ? <video src={task.result_video_url} controls className="h-full w-full object-cover" /> : <Image src={task.result_video_url} alt={dict.digitalHuman.title} fill className="object-cover" />}</div><span className="absolute right-2 top-2 rounded border border-amber-900/50 bg-stone-950/85 px-2 py-0.5 text-xs text-amber-500">{dict.digitalHuman.aiBadge}</span></div>)}
            </div>
          )}
        </section>
      )}

      {(lifeEvents.length > 0 || isOwner) && (
        <section id="timeline" className="ui-panel mb-10 p-6 sm:p-8">
          <h2 className="ui-section-ornate mb-6">{dict.memorial.timelineTitle}</h2>
          {lifeEvents.length > 0 && (
            <div className="relative pl-6 border-l border-stone-700 space-y-5 mb-5">
              {lifeEvents.map((ev) => (
                <div key={ev.id} className="relative">
                  <span className="absolute -left-[1.65rem] top-1 w-2.5 h-2.5 rounded-full bg-amber-700 ring-4 ring-stone-900" />
                  <p className="text-xs text-amber-500 tracking-wider">{ev.year}</p>
                  <p className="text-sm text-stone-300 mt-0.5">{ev.title}</p>
                  {ev.description && <p className="text-xs text-stone-500 mt-1 leading-relaxed">{ev.description}</p>}
                </div>
              ))}
            </div>
          )}
          {isOwner && <TimelineManager memorialId={memorial.id} events={lifeEvents} labels={dict.memorial} />}
        </section>
      )}

      {(media.length > 0 || isOwner) && (
        <section id="media" className="ui-panel mb-10 p-6 sm:p-8">
          <h2 className="ui-section-ornate mb-6">{dict.memorial.gallery}</h2>
          {isOwner ? (
            <MediaManager memorialId={memorial.id} media={media} labels={dict.memorial} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {media.map((item) =>
                item.kind === "video" ? (
                  <video key={item.id} src={item.url} controls className="w-full aspect-square object-cover rounded-lg bg-stone-800" />
                ) : (
                  <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block w-full aspect-square relative rounded-lg bg-stone-800 overflow-hidden">
                    <Image
                      src={item.thumb_url || item.url}
                      alt={item.caption}
                      fill
                      className="object-cover"
                    />
                  </a>
                )
              )}
            </div>
          )}
        </section>
      )}

      <section id="offerings" className="ui-panel mb-10 p-6 sm:p-8">
        <h2 className="ui-section-ornate mb-6">{dict.memorial.offeringTitle}</h2>
        <OfferPanel
          lang={lang}
          memorialId={memorial.id}
          officialItems={officialItems.map(toPanelItem)}
          myItems={myItems.map(toPanelItem)}
          loggedIn={!!user}
          labels={dict.memorial}
          promptLabels={dict.prompt}
        />
      </section>
      <section id="tributes" className="ui-panel p-6 sm:p-8">
        <h2 className="ui-section-ornate mb-7">
          {dict.memorial.wallTitle.replace("{count}", String(tributes.length))}
        </h2>
        {tributes.length === 0 ? (
          <p className="text-stone-600 text-sm text-center py-8">{dict.memorial.wallEmpty}</p>
        ) : (
          <div className="wall-scroll space-y-3 max-h-[38rem] overflow-y-auto pr-1">
            {tributes.map((t) => {
              const item = getItem(t.item_id);
              return (
                <div key={t.id} className={`flex items-start gap-3 p-3.5 rounded-lg ${t.is_burning ? "bg-amber-950/20 border border-amber-900/30" : "bg-stone-800/40"}`}>
                  {item?.image_url ? (
                    <div className="relative mt-0.5">
                      <ItemAsset src={item.image_url} alt={itemLabel(item)} fallback={item.icon} size={32} />
                      {t.is_burning === 1 && <div className="absolute -top-4 -left-2 pointer-events-none"><Flame width={28} height={40} /></div>}
                    </div>
                  ) : (
                    <div className="relative mt-0.5">
                      <span className="text-xl">{item?.icon || "馃拹"}</span>
                      {t.is_burning === 1 && <div className="absolute -top-4 -left-2 pointer-events-none"><Flame width={28} height={40} /></div>}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-amber-200/90 font-medium">{t.sender_name || dict.memorial.anonymous}</span>
                      <span className="text-xs text-stone-600">{dict.memorial.offered.replace("{item}", itemLabel(item))}</span>
                      {t.is_burning === 1 && <span className="text-xs text-amber-600 bg-amber-950/50 px-1.5 py-0.5 rounded">{dict.memorial.burned}</span>}
                      {t.created_at && <span className="ml-auto text-xs text-stone-600 tabular-nums">{t.created_at.slice(0, 16)}</span>}
                    </div>
                    {t.message && <p className="text-sm text-stone-400 mt-1">{t.message}</p>}
                    <p className="text-xs text-stone-600 mt-1">{t.created_at}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}






