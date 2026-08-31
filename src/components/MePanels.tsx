"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Labels = Record<string, string>;

export interface GroupInfo {
  id: string;
  name: string;
  invite_code: string;
  role: string;
  member_count: number;
}

export interface MemorialInfo {
  id: string;
  name: string;
  visibility: string;
  avatar_url: string;
  in_garden: number;
}

const inputCls =
  "bg-stone-800 border border-stone-700 rounded-lg px-4 py-2 text-sm text-stone-300 placeholder-stone-600 focus:outline-none focus:border-amber-700";
const btnCls =
  "px-4 py-2 bg-amber-800 hover:bg-amber-700 disabled:opacity-40 text-amber-100 rounded-lg transition text-sm";

export function LogoutButton({ labels }: { labels: Labels }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.refresh();
      }}
      className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg transition text-sm"
    >
      {labels.logout}
    </button>
  );
}

export function CreateMemorialForm({
  labels,
  types,
}: {
  labels: Labels;
  types: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    const res = await fetch("/api/memorials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (res.ok) {
      form.reset();
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnCls}>
        {labels.createMemorial}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="bg-stone-900/60 border border-stone-800 rounded-xl p-5 space-y-3">
      <div className="flex gap-2 flex-wrap">
        <input name="name" required placeholder={labels.nameRequired} className={`${inputCls} flex-1 min-w-40`} />
        <select name="type" className={inputCls}>
          {Object.entries(types).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input name="birth_date" placeholder={labels.birthPlaceholder} className={`${inputCls} flex-1 min-w-32`} />
        <input name="death_date" placeholder={labels.deathPlaceholder} className={`${inputCls} flex-1 min-w-32`} />
      </div>
      <input name="epitaph" placeholder={labels.epitaphPlaceholder} className={`${inputCls} w-full`} />
      <textarea name="biography" placeholder={labels.biographyPlaceholder} rows={3} className={`${inputCls} w-full`} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnCls}>
          {labels.create}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-400 rounded-lg transition text-sm"
        >
          ✕
        </button>
      </div>
    </form>
  );
}

export function MemorialSettings({
  lang,
  memorial,
  groups,
  granted,
  labels,
  gardenLabels,
}: {
  lang: string;
  memorial: MemorialInfo;
  groups: GroupInfo[];
  granted: string[];
  labels: Labels;
  gardenLabels: Labels;
}) {
  const router = useRouter();
  const [visibility, setVisibility] = useState(memorial.visibility || "private");
  const [selected, setSelected] = useState<string[]>(granted);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inGarden, setInGarden] = useState(memorial.in_garden === 1);

  async function toggleGarden() {
    const next = !inGarden;
    const res = await fetch(`/api/memorials/${memorial.id}/garden`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ in_garden: next }),
    });
    if (!res.ok) return;
    setInGarden(next);
    if (next) {
      // Task 6：公开馆入园统一走星海显式择位——旧 POST 成功（自动疏朗位）后
      // 带 placing 直达星海拖拽微调（墓园规格 §8.3 馆主亲手择位）；
      // 旧接口本身保留给历史客户端。
      const body = (await res.json().catch(() => null)) as { hallId?: string } | null;
      const hallId = body?.hallId || `hall_${memorial.id}`;
      router.push(`/${lang}/garden?placing=${encodeURIComponent(hallId)}`);
      return;
    }
    router.refresh();
  }

  async function save() {
    setBusy(true);
    await fetch(`/api/memorials/${memorial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility, group_ids: visibility === "group" ? selected : [] }),
    });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function uploadAvatar(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (data.url) {
      await fetch(`/api/memorials/${memorial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: data.url }),
      });
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <label className="flex items-center gap-1.5 cursor-pointer text-stone-500 hover:text-stone-300 transition">
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
        📷 {labels.uploadAvatar}
      </label>
      <span className="text-stone-700">|</span>
      <span className="text-stone-500">{labels.visibility}</span>
      <select
        value={visibility}
        onChange={(e) => setVisibility(e.target.value)}
        className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300"
      >
        <option value="private">{labels.visPrivate}</option>
        <option value="group">{labels.visGroup}</option>
        <option value="public">{labels.visPublic}</option>
      </select>
      {visibility === "group" && (
        <span className="flex items-center gap-2 flex-wrap">
          {groups.map((group) => (
            <label key={group.id} className="flex items-center gap-1 text-stone-400">
              <input
                type="checkbox"
                checked={selected.includes(group.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? [...selected, group.id] : selected.filter((id) => id !== group.id)
                  )
                }
                className="accent-amber-600"
              />
              {group.name}
            </label>
          ))}
        </span>
      )}
      <button type="button" onClick={save} disabled={busy} className="px-3 py-1 bg-amber-800 hover:bg-amber-700 text-amber-100 rounded transition">
        {saved ? labels.saved : labels.save}
      </button>
      {visibility === "public" && (
        <label className="flex items-center gap-1 text-stone-400 cursor-pointer">
          <input type="checkbox" checked={inGarden} onChange={toggleGarden} className="accent-amber-600" />
          {inGarden ? gardenLabels.remove : gardenLabels.place}
        </label>
      )}
      <a href={`/${lang}/hall/${memorial.id}`} className="text-amber-500 hover:text-amber-400 transition">
        {labels.view} →
      </a>
    </div>
  );
}

export function GroupsPanel({
  lang,
  groups,
  labels,
}: {
  lang: string;
  groups: GroupInfo[];
  labels: Labels;
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  async function createGroup() {
    if (!groupName.trim()) return;
    setBusy(true);
    await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName.trim() }),
    });
    setBusy(false);
    setGroupName("");
    router.refresh();
  }

  async function joinByCode() {
    if (!inviteCode.trim()) return;
    setBusy(true);
    await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: inviteCode.trim() }),
    });
    setBusy(false);
    setInviteCode("");
    router.refresh();
  }

  async function groupAction(group: GroupInfo, action: "rotate" | "leave" | "delete") {
    if (action === "delete" && !window.confirm(`确认解散群组“${group.name}”？`)) return;
    if (action === "leave" && !window.confirm(`确认退出群组“${group.name}”？`)) return;
    setBusy(true);
    const endpoint = action === "rotate"
      ? `/api/groups/${group.id}/rotate-invite`
      : action === "leave"
        ? `/api/groups/${group.id}/leave`
        : `/api/groups/${group.id}`;
    const response = await fetch(endpoint, { method: action === "delete" ? "DELETE" : "POST" });
    const data = await response.json().catch(() => ({}));
    if (action === "rotate" && data.invite_code) {
      await navigator.clipboard?.writeText(`${origin}/${lang}/join/${data.invite_code}`);
    }
    setBusy(false);
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder={labels.groupName}
          className={`${inputCls} flex-1 min-w-40`}
        />
        <button type="button" onClick={createGroup} disabled={busy} className={btnCls}>
          {labels.createGroup}
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder={labels.joinPlaceholder}
          className={`${inputCls} flex-1 min-w-40`}
        />
        <button
          type="button"
          onClick={joinByCode}
          disabled={busy}
          className="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-lg transition text-sm"
        >
          {labels.join}
        </button>
      </div>
      {groups.length > 0 && (
        <ul className="space-y-2">
          {groups.map((group) => (
            <li key={group.id} className="bg-stone-800/50 rounded-lg px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-stone-300">
                  {group.name}
                  <span className="ml-2 text-xs text-stone-600">
                    {labels.memberCount.replace("{count}", String(group.member_count))}
                    {group.role === "owner" ? " · owner" : ""}
                  </span>
                </span>
              </div>
              {group.role === "owner" && (
                <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-stone-600 break-all">{labels.inviteLink}: {origin}/{lang}/join/{group.invite_code}</span>
                  <button type="button" disabled={busy} onClick={() => navigator.clipboard?.writeText(`${origin}/${lang}/join/${group.invite_code}`)} className="text-amber-500 hover:text-amber-400">复制</button>
                  <button type="button" disabled={busy} onClick={() => groupAction(group, "rotate")} className="text-stone-400 hover:text-stone-200">轮换</button>
                  <button type="button" disabled={busy} onClick={() => groupAction(group, "delete")} className="text-red-500 hover:text-red-400">解散</button>
                </div>
              )}
              {group.role !== "owner" && (
                <button type="button" disabled={busy} onClick={() => groupAction(group, "leave")} className="mt-2 text-xs text-red-500 hover:text-red-400">退出群组</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
