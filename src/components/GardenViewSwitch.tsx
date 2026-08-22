"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import GardenScene from "./GardenScene";
import type { GardenRow, GardenSectionData } from "./GardenScene";

const Garden3D = dynamic(() => import("./Garden3D"), { ssr: false, loading: () => <div className="garden-loading">正在加载 3D 场景…</div> });
type DrawerState = "collapsed" | "half" | "full";
type PanelState = "list" | "detail" | "offer";

export default function GardenViewSwitch({ sections, newTodayText, lang, initialQuery = "", labels }: { sections: GardenSectionData[]; newTodayText: string; lang: string; initialQuery?: string; labels: { view3d: string; view2d: string; hint3d: string; search: string; searchPlaceholder: string; subtitle: string; title: string; randomWalk: string; detail: string; offer: string; back: string; noResult: string } }) {
  const allRows = useMemo(() => sections.flatMap((section) => section.rows), [sections]);
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [drawer, setDrawer] = useState<DrawerState>("collapsed");
  const [panel, setPanel] = useState<PanelState>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const filteredRows = useMemo(() => { const term = query.trim().toLocaleLowerCase(); return term ? allRows.filter((row) => [row.name, row.epitaph].filter(Boolean).join(" ").toLocaleLowerCase().includes(term)) : allRows; }, [allRows, query]);
  const selected = allRows.find((row) => row.id === selectedId) ?? null;

  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key !== "Escape") return; if (panel === "offer") setPanel("detail"); else if (panel === "detail") setPanel("list"); else setDrawer("collapsed"); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [panel]);
  function selectMemorial(id: string) { setSelectedId(id); setPanel("detail"); setDrawer("half"); }

  return <div className="garden-shell">
    <header className="garden-nav" aria-label="墓园导航"><div className="garden-nav-inner"><Link href={`/${lang}`} className="garden-nav-link">返回</Link><label className="garden-search"><span className="sr-only">搜索墓位</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchPlaceholder} aria-label={labels.searchPlaceholder} /><span className="garden-search-count">{filteredRows.length}</span></label><div className="garden-view-toggle" role="group" aria-label="场景视图"><button type="button" aria-pressed={mode === "2d"} onClick={() => setMode("2d")}>2.5D</button><button type="button" aria-pressed={mode === "3d"} onClick={() => setMode("3d")}>3D</button></div></div></header>
    <main className="garden-canvas"><div className="garden-title" aria-hidden={drawer !== "collapsed"}><h1>{labels.title}</h1><p>{labels.subtitle}</p></div>{mode === "2d" ? <GardenScene sections={[{ key: "filtered", label: "", rows: filteredRows }]} newTodayText={newTodayText} onSelect={selectMemorial} /> : <Garden3D sections={[{ key: "filtered", label: "", rows: filteredRows }]} lang={lang} hint={labels.hint3d} />}</main>
    <section className={`garden-drawer garden-drawer-${drawer}`} aria-label="墓位浏览抽屉"><button type="button" className="garden-drawer-handle" onClick={() => setDrawer(drawer === "collapsed" ? "half" : drawer === "half" ? "full" : "collapsed")} aria-label="展开或收起墓位浏览">墓位浏览 · {filteredRows.length}</button>{drawer !== "collapsed" && <div className="garden-drawer-content">{panel === "list" && <><div className="garden-drawer-heading"><span>{labels.title}</span><span>{filteredRows.length} 个墓位</span></div>{filteredRows.length === 0 ? <p className="garden-empty">{labels.noResult}</p> : <div className="garden-card-rail" role="list">{filteredRows.map((row) => <MemorialCard key={row.id} row={row} selected={row.id === selectedId} onSelect={selectMemorial} />)}</div>}</>}{panel === "detail" && selected && <DetailPanel row={selected} lang={lang} labels={labels} onBack={() => setPanel("list")} onOffer={() => { setPanel("offer"); }} />}{panel === "offer" && selected && <OfferPanel row={selected} lang={lang} back={labels.back} offer={labels.offer} onBack={() => setPanel("detail")} />}</div>}</section>
  </div>;
}

function MemorialCard({ row, selected, onSelect }: { row: GardenRow; selected: boolean; onSelect: (id: string) => void }) { return <button type="button" role="listitem" className={`garden-card ${selected ? "is-selected" : ""}`} onClick={() => onSelect(row.id)}><span className="garden-card-avatar">{row.avatar_url?.startsWith("/uploads/") ? "◉" : row.avatar_url || "🕯"}</span><span className="garden-card-copy"><strong>{row.name}</strong><small>{row.birth_date || "?"} ~ {row.death_date || "?"}</small><em>{row.epitaph || "静默安息"}</em></span></button>; }

function DetailPanel({ row, lang, labels, onBack, onOffer }: { row: GardenRow; lang: string; labels: { detail: string; offer: string; back: string }; onBack: () => void; onOffer: () => void }) { return <div className="garden-detail"><button type="button" className="garden-back" onClick={onBack}>← {labels.back}</button><div className="garden-detail-identity"><span className="garden-card-avatar">{row.avatar_url || "🕯"}</span><div><h2>{row.name}</h2><p>{row.birth_date || "?"} ~ {row.death_date || "?"}</p></div></div><p className="garden-detail-epitaph">{row.epitaph || "愿记忆在烛光中安静延续。"}</p><div className="garden-detail-actions"><button type="button" className="garden-primary" onClick={onOffer}>{labels.offer}</button><Link className="garden-secondary" href={`/${lang}/hall/${row.id}`}>{labels.detail}</Link></div></div>; }

// 园内供奉：接真实 /api/tribute（免费项，fetch 提交不跳转，停留当前场景）
const GARDEN_OFFER_ITEMS = [
  { id: 'candle', icon: '🕯', label: '烛火', burning: true },
  { id: 'flower_white', icon: '🌼', label: '白菊', burning: false },
  { id: 'flower_lily', icon: '🪷', label: '百合', burning: false },
];
function OfferPanel({ row, lang, back, offer, onBack }: { row: GardenRow; lang: string; back: string; offer: string; onBack: () => void }) {
  const [itemId, setItemId] = useState('candle');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const submit = async () => {
    if (state === 'sending' || state === 'done') return;
    setState('sending');
    try {
      const item = GARDEN_OFFER_ITEMS.find((x) => x.id === itemId)!;
      const fd = new FormData();
      fd.set('memorial_id', row.id);
      fd.set('item_id', item.id);
      fd.set('lang', lang);
      if (message.trim()) fd.set('message', message.trim().slice(0, 500));
      if (item.burning) fd.set('is_burning', '1');
      await fetch('/api/tribute', { method: 'POST', body: fd, redirect: 'manual' });
      setState('done');
      setTimeout(onBack, 900);
    } catch {
      setState('error');
    }
  };
  return <div className="garden-offer-panel"><button type="button" className="garden-back" onClick={onBack}>← {back}</button><h2>{offer}</h2><div className="garden-offer-rail">{GARDEN_OFFER_ITEMS.map((item) => <button key={item.id} type="button" className={"garden-offer-option" + (itemId === item.id ? ' is-selected' : '')} onClick={() => setItemId(item.id)}>{item.icon} {item.label}</button>)}</div><textarea className="garden-message" placeholder="留下简短的思念（可选）" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /><button type="button" className="garden-primary" disabled={state === 'sending' || state === 'done'} onClick={submit}>{state === 'done' ? '已献上' : state === 'sending' ? '献上中…' : state === 'error' ? '没献上，再试一次' : offer}</button></div>;
}
