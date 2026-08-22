"use client";

import { useState } from "react";

// 亲友共同纪念面板（暗红熔岩）：馆主生成/管理邀请链接与成员，亲友经 /join/[code] 加入
export interface BoundGroup {
  id: string;
  name: string;
  inviteCode: string;
  members: { nameMasked: string; role: string; joinedAt: string }[];
}

const EMBER_SOFT = "#ffb35c";

export default function FamilyPanel({
  memorialId,
  lang,
  memorialName,
  isOwner,
  boundGroups,
}: {
  memorialId: string;
  lang: string;
  memorialName: string;
  isOwner: boolean;
  boundGroups: BoundGroup[];
}) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const showToast = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2000);
  };

  const createInvite = async () => {
    setBusy(true);
    setError("");
    try {
      const g = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${memorialName} 的亲友` }),
      }).then((r) => r.json());
      if (!g.id) throw new Error(g.error === "unauthorized" ? "unauthorized" : "create_failed");
      const m = await fetch(`/api/memorials/${memorialId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_ids: [...boundGroups.map((x) => x.id), g.id] }),
      }).then((r) => r.json());
      if (!m.ok) throw new Error("bind_failed");
      showToast("邀请链接已生成");
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      setError(e instanceof Error && e.message === "unauthorized" ? "请先登录后再操作" : "操作没成功，请再试一次");
    } finally {
      setBusy(false);
    }
  };

  const rotate = async (groupId: string) => {
    if (!confirm("更换邀请链接后，旧链接将失效。确定更换吗？")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/groups/${groupId}/rotate-invite`, { method: "POST" }).then((x) => x.json());
      if (!r.ok && !r.invite_code) throw new Error("rotate_failed");
      showToast("已更换邀请链接");
      setTimeout(() => location.reload(), 600);
    } catch {
      setError("操作没成功，请再试一次");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("已复制");
    } catch {
      showToast("复制失败，请手动选择复制");
    }
  };

  return (
    <div className="space-y-6">
      {boundGroups.map((g) => {
        const link = typeof window !== "undefined" ? `${location.origin}/${lang}/join/${g.inviteCode}` : `/${lang}/join/${g.inviteCode}`;
        return (
          <div
            key={g.id}
            className="rounded-3xl p-6"
            style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px]" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>{g.name}</h3>
              <span className="text-[12px]" style={{ color: "rgba(255,246,236,.45)" }}>{g.members.length} 位亲友</span>
            </div>

            <div className="mt-4 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)" }}>
              <span className="flex-1 truncate text-[13px]" style={{ color: EMBER_SOFT }}>{link}</span>
              <button
                onClick={() => copy(link)}
                className="shrink-0 text-[13px] rounded-full px-4 py-1.5 transition active:opacity-85"
                style={{ background: "rgba(255,122,47,.12)", border: "1px solid rgba(255,179,92,.3)", color: EMBER_SOFT }}
              >
                复制
              </button>
            </div>
            <p className="mt-2 text-[12px]" style={{ color: "rgba(255,246,236,.4)" }}>
              把链接发给亲友，对方打开后即可留言、献花、一起看公开内容
            </p>

            <div className="mt-4 space-y-2">
              {g.members.map((m, i) => (
                <div key={i} className="flex items-center gap-3 text-[14px]">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px]" style={{ background: "rgba(255,255,255,.08)" }}>
                    {m.role === "owner" ? "馆主" : "亲友"}
                  </span>
                  <span>{m.nameMasked}</span>
                  <span className="text-[12px]" style={{ color: "rgba(255,246,236,.35)" }}>{m.joinedAt?.slice(0, 10)}</span>
                </div>
              ))}
            </div>

            {isOwner && (
              <button
                onClick={() => rotate(g.id)}
                disabled={busy}
                className="mt-4 text-[12px] underline underline-offset-4 transition active:opacity-85"
                style={{ color: "rgba(255,246,236,.45)" }}
              >
                更换邀请链接
              </button>
            )}
          </div>
        );
      })}

      {isOwner && (
        <button
          onClick={createInvite}
          disabled={busy}
          className="w-full h-[52px] rounded-full text-[15px] text-white transition active:opacity-85 disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg,#ff8a3d 0%,#f45d12 55%,#d9480f 100%)",
            boxShadow: "0 4px 16px rgba(244,93,18,.35)",
          }}
        >
          {boundGroups.length ? "再生成一个邀请链接" : "生成亲友邀请链接"}
        </button>
      )}

      {!isOwner && (
        <div
          className="rounded-3xl p-6 text-center text-[14px]"
          style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", color: "rgba(255,246,236,.55)" }}
        >
          如果你是 TA 的亲友，可以通过馆主分享的邀请链接加入共同纪念
        </div>
      )}

      {error && <p className="text-center text-[13px]" style={{ color: "#e08070" }}>{error}</p>}
      {toast && (
        <div
          className="fixed left-1/2 bottom-8 -translate-x-1/2 rounded-full px-5 py-2.5 text-[14px] z-50"
          style={{ background: "rgba(43,43,43,.88)", color: "#fff", transform: "translate(-50%,-16px)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
