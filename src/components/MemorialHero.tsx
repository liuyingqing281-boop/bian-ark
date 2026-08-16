"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MemorialHero({
  memorial,
  isOwner,
  lang,
  labels,
}: {
  memorial: {
    id: string;
    name: string;
    type: string;
    avatar_url: string;
    cover_url: string;
    birth_date: string;
    death_date: string;
    epitaph: string;
  };
  isOwner: boolean;
  lang: string;
  labels: {
    epitaphFormat: string;
    uploadAvatar: string;
    uploadCover: string;
    uploading: string;
  };
}) {
  const router = useRouter();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const avatarIsImage = memorial.avatar_url?.startsWith("/uploads/");

  async function uploadFile(file: File, target: "avatar_url" | "cover_url") {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (data.url) {
      await fetch(`/api/memorials/${memorial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [target]: data.url }),
      });
      router.refresh();
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    await uploadFile(file, "avatar_url");
    setAvatarUploading(false);
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    await uploadFile(file, "cover_url");
    setCoverUploading(false);
  }

  const hasCover = memorial.cover_url?.startsWith("/uploads/");

  return (
    <>
      {/* Hero background — cover image or scene-visible gradient */}
      <div className="relative mb-8 h-52 overflow-hidden rounded-xl bg-stone-800 sm:h-64 md:h-72">
        {hasCover ? (
          <Image src={memorial.cover_url} alt="" fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-stone-700/70 to-stone-900/80 flex items-center justify-center">
            <span className="text-6xl opacity-20">🕊️</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/20 to-stone-950/10" />

        {/* Cover upload (owner only) */}
        {isOwner && (
          <label className="absolute top-3 right-3 z-10 cursor-pointer px-2 py-1 rounded bg-stone-900/70 text-xs text-stone-400 hover:text-amber-300 hover:bg-stone-900/90 transition border border-stone-700/50">
            {coverUploading ? labels.uploading : labels.uploadCover}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleCoverUpload}
              disabled={coverUploading}
            />
          </label>
        )}
      </div>

      {/* Avatar + name */}
      <div className="relative -mt-20 mb-10 px-4 text-center sm:-mt-24">
        <div className="relative mb-4 inline-flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-stone-950 bg-stone-800 text-4xl sm:h-28 sm:w-28">
          {avatarIsImage ? (
            <Image src={memorial.avatar_url} alt={memorial.name} fill className="object-cover" />
          ) : (
            <span className="select-none">
              {memorial.avatar_url || (memorial.type === "pet" ? "🐾" : "🕊️")}
            </span>
          )}

          {/* Avatar upload overlay (owner only) */}
          {isOwner && (
            <label className="group absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 transition hover:bg-black/50 focus-within:bg-black/50">
              <span className="opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 text-xs text-amber-200">
                {avatarUploading ? labels.uploading : labels.uploadAvatar}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={avatarUploading}
              />
            </label>
          )}
        </div>

        <h1 className="break-words text-3xl font-semibold leading-tight text-amber-300 mb-1">{memorial.name}</h1>
        <p className="text-stone-500 text-sm">
          {memorial.birth_date || "?"} ~ {memorial.death_date || "?"}
        </p>
        {memorial.epitaph && (
          <p className="mx-auto mt-4 max-w-prose text-stone-400 italic leading-relaxed">
            {labels.epitaphFormat.replace("{text}", memorial.epitaph)}
          </p>
        )}
      </div>
    </>
  );
}
