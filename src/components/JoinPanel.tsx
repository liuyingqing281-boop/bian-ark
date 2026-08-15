"use client";

import { useState } from "react";

type Labels = Record<string, string>;

export default function JoinPanel({
  lang,
  inviteCode,
  labels,
}: {
  lang: string;
  inviteCode: string;
  labels: Labels;
}) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function join() {
    setState("busy");
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: inviteCode }),
    });
    if (res.ok) {
      window.location.href = `/${lang}/me`;
    } else {
      setState("error");
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={join}
        disabled={state === "busy"}
        className="px-6 py-2 bg-amber-800 hover:bg-amber-700 disabled:opacity-40 text-amber-100 rounded-lg transition text-sm"
      >
        {labels.joinButton}
      </button>
      {state === "error" && <p className="text-xs text-red-400">{labels.failed}</p>}
    </div>
  );
}