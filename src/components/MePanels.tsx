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
    if (res.ok) {
      setInGarden(next);
      router.refresh();
    }
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
      <a href={`/${lang}/memorial/${memorial.id}`} className="text-amber-500 hover:text-amber-400 transition">
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
                <p className="mt-1 text-xs text-stone-600 break-all">
                  {labels.inviteLink}: {origin}/{lang}/join/{group.invite_code}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}