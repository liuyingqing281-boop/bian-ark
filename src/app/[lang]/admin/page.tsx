"use client";
import Image from "next/image";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { defaultLocale, getDictionary, hasLocale } from "../dictionaries";

interface Memorial { id: string; name: string; type: string; epitaph: string; is_featured: number; }
interface Item { id: string; name: string; icon: string; category: string; is_premium: number; }
interface DhReviewTask {
  id: string; memorial_id: string; status: string; photo_url: string; script: string;
  result_video_url: string; error: string; created_at: string; memorial_name: string | null;
}

export default function AdminPage() {
  const { lang: rawLang } = useParams<{ lang: string }>();
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const dict = getDictionary(lang);
  const t = dict.admin;

  const [memorials, setMemorials] = useState<Memorial[]>([]);
  const [digitalHumans, setDigitalHumans] = useState<DhReviewTask[]>([]);
  const [stats, setStats] = useState<{ type: string; c: number }[]>([]);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", type: "person", birth_date: "", death_date: "", epitaph: "", biography: "", is_featured: false });

  const fetchData = async () => {
    const res = await fetch("/api/admin");
    if (res.status === 403) {
      setDenied(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setMemorials(data.memorials);
    setDigitalHumans(data.digitalHumans || []);
    setStats(data.stats || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  if (denied) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-stone-400">{t.forbidden}</p>
      </div>
    );
  }

  const create = async () => {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_memorial", ...form }),
    });
    setForm({ name: "", type: "person", birth_date: "", death_date: "", epitaph: "", biography: "", is_featured: false });
    fetchData();
  };

  const remove = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_memorial", id }),
    });
    fetchData();
  };

  const toggleFeatured = async (id: string) => {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_featured", id }),
    });
    fetchData();
  };

  const seedDemo = async () => {
    if (!confirm(t.confirmSeed)) return;
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed_demo" }),
    });
    fetchData();
  };

  const reviewDigitalHuman = async (id: string, decision: "approve" | "reject") => {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review_digital_human", id, decision }),
    });
    fetchData();
  };

  const typeLabel = (type: string) =>
    dict.types[type as keyof typeof dict.types] || dict.types.other;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl tracking-widest text-amber-300 mb-8">{t.title}</h1>

      {stats.length > 0 && (
        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-6 mb-10">
          <h2 className="text-sm tracking-widest text-amber-500 mb-4">{t.statsTitle}</h2>
          <div className="flex flex-wrap gap-2">
            {stats.map((s) => (
              <span key={s.type} className="text-xs px-3 py-1.5 bg-stone-800/60 rounded-lg text-stone-400">
                {s.type}: <span className="text-amber-400">{s.c}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Create Memorial */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-6 mb-10">
        <h2 className="text-sm tracking-widest text-amber-500 mb-4">{t.createTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <input placeholder={t.namePlaceholder} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-stone-800 border border-stone-700 rounded-lg px-4 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-700" />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="bg-stone-800 border border-stone-700 rounded-lg px-4 py-2 text-sm text-stone-200 focus:outline-none focus:border-amber-700">
            <option value="person">{dict.types.person}</option>
            <option value="pet">{dict.types.pet}</option>
            <option value="other">{dict.types.other}</option>
          </select>
          <input placeholder={t.birthPlaceholder} value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            className="bg-stone-800 border border-stone-700 rounded-lg px-4 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-700" />
          <input placeholder={t.deathPlaceholder} value={form.death_date} onChange={(e) => setForm({ ...form, death_date: e.target.value })}
            className="bg-stone-800 border border-stone-700 rounded-lg px-4 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-700" />
        </div>
        <input placeholder={t.epitaphPlaceholder} value={form.epitaph} onChange={(e) => setForm({ ...form, epitaph: e.target.value })}
          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-4 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-700 mb-4" />
        <textarea placeholder={t.biographyPlaceholder} value={form.biography} onChange={(e) => setForm({ ...form, biography: e.target.value })} rows={3}
          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-4 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-700 mb-4" />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-stone-400 cursor-pointer">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
              className="accent-amber-600" />
            {t.setFeatured}
          </label>
          <button onClick={create} disabled={!form.name}
            className="px-6 py-2 bg-amber-800 hover:bg-amber-700 disabled:bg-stone-700 disabled:text-stone-500 text-amber-100 rounded-lg transition text-sm">
            {t.createButton}
          </button>
        </div>
      </div>

      {/* Memorial List */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-6 mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm tracking-widest text-amber-500">{t.listTitle.replace("{count}", String(memorials.length))}</h2>
          <button onClick={seedDemo}
            className="px-4 py-1.5 border border-amber-800 text-amber-500 hover:bg-amber-950/50 rounded-lg transition text-xs">
            {t.seedButton}
          </button>
        </div>
        {loading ? (
          <p className="text-stone-500 text-sm">{t.loading}</p>
        ) : memorials.length === 0 ? (
          <p className="text-stone-600 text-sm">{t.emptyList}</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {memorials.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-stone-800/40 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <a href={`/${lang}/memorial/${m.id}`} className="text-sm text-stone-300 hover:text-amber-400 transition truncate">
                    {m.name}
                  </a>
                  <span className="text-xs text-stone-600">{typeLabel(m.type)}</span>
                  <span className="text-xs text-stone-600 truncate hidden sm:inline">- {m.epitaph || t.noEpitaph}</span>
                  {m.is_featured === 1 && <span className="text-xs text-amber-600">{t.featuredBadge}</span>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => toggleFeatured(m.id)}
                    className="text-xs px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 transition">
                    {m.is_featured ? t.unfeature : t.feature}
                  </button>
                  <button onClick={() => remove(m.id)}
                    className="text-xs px-2 py-1 rounded bg-red-950 hover:bg-red-900 text-red-400 transition">
                    {t.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Digital Human Review */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-6 mb-10">
        <h2 className="text-sm tracking-widest text-amber-500 mb-4">
          {t.reviewTitle.replace("{count}", String(digitalHumans.filter((d) => d.status === "reviewing").length))}
        </h2>
        {digitalHumans.length === 0 ? (
          <p className="text-stone-600 text-sm">{t.noReviewTasks}</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {digitalHumans.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-3 bg-stone-800/40 rounded-lg">
                {d.photo_url && <Image src={d.photo_url} alt="" width={40} height={40} className="rounded object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <a href={`/${lang}/memorial/${d.memorial_id}`} className="text-sm text-stone-300 hover:text-amber-400 transition">
                    {d.memorial_name || d.memorial_id}
                  </a>
                  <p className="text-xs text-stone-600 truncate">{d.script}</p>
                  <p className="text-xs text-stone-600">
                    {d.created_at} · {dict.digitalHuman[("status_" + d.status) as keyof typeof dict.digitalHuman] || d.status}
                  </p>
                </div>
                {d.result_video_url && (
                  <a href={d.result_video_url} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:text-sky-300 shrink-0">
                    {t.viewResult}
                  </a>
                )}
                {d.status === "reviewing" && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => reviewDigitalHuman(d.id, "approve")}
                      className="text-xs px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-400 transition">
                      {t.approve}
                    </button>
                    <button onClick={() => reviewDigitalHuman(d.id, "reject")}
                      className="text-xs px-2 py-1 rounded bg-red-950 hover:bg-red-900 text-red-400 transition">
                      {t.reject}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
