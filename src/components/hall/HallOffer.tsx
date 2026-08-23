"use client";

import { useState } from "react";

// 供奉面板：真实 POST /api/tribute（免费祭品），成功后前端即时追加纪念流
// 商业化红线：仅渲染免费项；无倒计时/库存/攀比元素

export interface OfferItem {
  id: string;
  label: string;
  icon: string;
  imageUrl: string;
}

const EMBER_SOFT = "#ffb35c";

export default function HallOffer({
  memorialId,
  lang,
  items,
}: {
  memorialId: string;
  lang: string;
  items: OfferItem[];
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [toast, setToast] = useState("");

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2000);
  };

  const offer = async (item: OfferItem) => {
    if (pending) return;
    setPending(item.id);
    try {
      const fd = new FormData();
      fd.set("memorial_id", memorialId);
      fd.set("item_id", item.id);
      fd.set("lang", lang);
      fd.set("is_burning", item.id.includes("candle") || item.id.includes("lamp") ? "1" : "0");
      const res = await fetch("/api/tribute", { method: "POST", body: fd, redirect: "follow" });
      if (res.ok) {
        setDone((d) => [...d, item.id]);
        say(`已为 TA ${item.label}`);
        // 追加到纪念流顶部（服务端渲染列表的前端即时补充）
        const feed = document.getElementById("hall-feed");
        if (feed) {
          const empty = feed.querySelector("p");
          if (empty) empty.remove();
          const row = document.createElement("div");
          row.className = "flex items-center gap-3 px-5 py-3.5";
          row.style.borderColor = "rgba(255,255,255,.06)";
          row.innerHTML = `<span class="text-lg">${item.icon || "🕯️"}</span><span class="flex-1 text-[14px]">${item.label} · 我</span><span class="text-[11px]" style="color:rgba(255,246,236,.38)">刚刚</span>`;
          feed.prepend(row);
        }
      } else {
        say("没有成功，请再试一次");
      }
    } catch {
      say("没有成功，请再试一次");
    }
    setPending(null);
  };

  return (
    <div className="relative">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => offer(item)}
            disabled={pending !== null}
            className="rounded-2xl p-3 flex flex-col items-center gap-2 relative transition active:opacity-85 disabled:opacity-50"
            style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)" }}
          >
            <span className="absolute top-2 right-2 text-[10px]" style={{ color: "#7fb069" }}>
              {done.includes(item.id) ? "已供奉" : "免费"}
            </span>
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={item.label} className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <span className="text-3xl leading-none py-1.5">{item.icon || "🕯️"}</span>
            )}
            <span className="text-[13px]" style={{ color: "rgba(255,246,236,.75)" }}>
              {pending === item.id ? "供奉中…" : item.label}
            </span>
          </button>
        ))}
      </div>
      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-10 px-4 py-1.5 rounded-full text-[12px] text-white"
             style={{ background: "rgba(43,43,43,.92)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
