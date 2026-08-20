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
  const [offerSent, setOfferSent] = useState(false);
  const filteredRows = useMemo(() => { const term = query.trim().toLocaleLowerCase(); return term ? allRows.filter((row) => [row.name, row.epitaph].filter(Boolean).join(" ").toLocaleLowerCase().includes(term)) : allRows; }, [allRows, query]);
  const selected = allRows.find((row) => row.id === selectedId) ?? null;

  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key !== "Escape") return; if (panel === "offer") setPanel("detail"); else if (panel === "detail") setPanel("list"); else setDrawer("collapsed"); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [panel]);
  function selectMemorial(id: string) { setSelectedId(id); setPanel("detail"); setDrawer("half"); }

  return <div className="garden-shell">
    <header className="garden-nav" aria-label="墓园导航"><div className="garden-nav-inner"><Link href={`/${lang}`} className="garden-nav-link">返回</Link><label className="garden-search"><span className="sr-only">搜索墓位</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchPlaceholder} aria-label={labels.searchPlaceholder} /><span className="garden-search-count">{filteredRows.length}</span></label><div className="garden-view-toggle" role="group" aria-label="场景视图"><button type="button" aria-pressed={mode === "2d"} onClick={() => setMode("2d")}>2.5D</button><button type="button" aria-pressed={mode === "3d"} onClick={() => setMode("3d")}>3D</button></div></div></header>
    <main className="garden-canvas"><div className="garden-title" aria-hidden={drawer !== "collapsed"}><h1>{labels.title}</h1><p>{labels.subtitle}</p></div>{mode === "2d" ? <GardenScene sections={[{ key: "filtered", label: "", rows: filteredRows }]} newTodayText={newTodayText} onSelect={selectMemorial} /> : <Garden3D sections={[{ key: "filtered", label: "", rows: filteredRows }]} lang={lang} hint={labels.hint3d} />}</main>
    <section className={`garden-drawer garden-drawer-${drawer}`} aria-label="墓位浏览抽屉"><button type="button" className="garden-drawer-handle" onClick={() => setDrawer(drawer === "collapsed" ? "half" : drawer === "half" ? "full" : "collapsed")} aria-label="展开或收起墓位浏览">墓位浏览 · {filteredRows.length}</button>{drawer !== "collapsed" && <div className="garden-drawer-content">{panel === "list" && <><div className="garden-drawer-heading"><span>{labels.title}</span><span>{filteredRows.length} 个墓位</span></div>{filteredRows.length === 0 ? <p className="garden-empty">{labels.noResult}</p> : <div className="garden-card-rail" role="list">{filteredRows.map((row) => <MemorialCard key={row.id} row={row} selected={row.id === selectedId} onSelect={selectMemorial} />)}</div>}</>}{panel === "detail" && selected && <DetailPanel row={selected} lang={lang} labels={labels} onBack={() => setPanel("list")} onOffer={() => { setOfferSent(false); setPanel("offer"); }} />}{panel === "offer" && selected && <div className="garden-offer-panel"><button type="button" className="garden-back" onClick={() => setPanel("detail")}>← {labels.back}</button><h2>供奉</h2><div className="garden-offer-rail"><button type="button" className="garden-offer-option is-selected">🕯 烛火</button><button type="button" className="garden-offer-option">🌼 白菊</button><button type="button" className="garden-offer-option">🪷 莲花</button></div><textarea className="garden-message" placeholder="留下简短的思念（可选）" rows={3} /><button type="button" className="garden-primary" onClick={() => { setOfferSent(true); setTimeout(() => setPanel("detail"), 900); }}>{offerSent ? "已献上" : labels.offer}</button></div>}</div>}</section>
  </div>;
}

function MemorialCard({ row, selected, onSelect }: { row: GardenRow; selected: boolean; onSelect: (id: string) => void }) { return <button type="button" role="listitem" className={`garden-card ${selected ? "is-selected" : ""}`} onClick={() => onSelect(row.id)}><span className="garden-card-avatar">{row.avatar_url?.startsWith("/uploads/") ? "◉" : row.avatar_url || "🕯"}</span><span className="garden-card-copy"><strong>{row.name}</strong><small>{row.birth_date || "?"} ~ {row.death_date || "?"}</small><em>{row.epitaph || "静默安息"}</em></span></button>; }

function DetailPanel({ row, lang, labels, onBack, onOffer }: { row: GardenRow; lang: string; labels: { detail: string; offer: string; back: string }; onBack: () => void; onOffer: () => void }) { return <div className="garden-detail"><button type="button" className="garden-back" onClick={onBack}>← {labels.back}</button><div className="garden-detail-identity"><span className="garden-card-avatar">{row.avatar_url || "🕯"}</span><div><h2>{row.name}</h2><p>{row.birth_date || "?"} ~ {row.death_date || "?"}</p></div></div><p className="garden-detail-epitaph">{row.epitaph || "愿记忆在烛光中安静延续。"}</p><div className="garden-detail-actions"><button type="button" className="garden-primary" onClick={onOffer}>{labels.offer}</button><Link className="garden-secondary" href={`/${lang}/memorial/${row.id}`}>{labels.detail}</Link></div></div>; }
