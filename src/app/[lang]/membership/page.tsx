"use client";

import { useParams } from "next/navigation";
import { defaultLocale, getDictionary, hasLocale } from "../dictionaries";

export default function MembershipPage() {
  const { lang: rawLang } = useParams<{ lang: string }>();
  const dict = getDictionary(hasLocale(rawLang) ? rawLang : defaultLocale);
  const t = dict.membership;

  const subscribe = async (kind: string, provider = "stripe") => {
    try {
      const res = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      alert(t.demoNote);
    } catch {
      alert(t.demoNote);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl tracking-widest text-amber-300 mb-8 text-center">{t.title}</h1>
      <p className="text-stone-500 text-sm text-center mb-12">{t.subtitle}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Free */}
        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-8">
          <h2 className="text-lg tracking-wide text-stone-300 mb-1">{t.freeName}</h2>
          <p className="text-3xl font-bold text-stone-400 mb-6">{t.freePrice}<span className="text-sm text-stone-600">{t.freePeriod}</span></p>
          <ul className="space-y-3 text-sm text-stone-500 mb-8">
            {t.freeFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2">✅ {f}</li>
            ))}
            {t.freeMissing.map((f) => (
              <li key={f} className="flex items-center gap-2 text-stone-700">❌ {f}</li>
            ))}
          </ul>
          <button disabled className="w-full py-3 rounded-lg bg-stone-800 text-stone-600 text-sm cursor-not-allowed">
            {t.currentPlan}
          </button>
        </div>

        {/* Premium */}
        <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-amber-700 text-amber-100 text-xs px-4 py-1 rounded-bl-lg">{t.recommended}</div>
          <h2 className="text-lg tracking-wide text-amber-300 mb-1">{t.premiumName}</h2>
          <p className="text-3xl font-bold text-amber-400 mb-2">{t.premiumPrice}<span className="text-sm text-amber-700">{t.premiumPeriod}</span></p>
          <p className="text-xs text-amber-700 mb-6">{t.premiumYearly}</p>
          <ul className="space-y-3 text-sm text-stone-400 mb-8">
            {t.premiumFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2">✅ {f}</li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button onClick={() => subscribe("premium_monthly", "stripe")}
              className="flex-1 py-3 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-100 text-sm transition">
              {t.monthlyButton}
            </button>
            <button onClick={() => subscribe("premium_yearly", "stripe")}
              className="flex-1 py-3 rounded-lg bg-amber-800 hover:bg-amber-700 text-amber-200 text-sm transition">
              {t.yearlyButton}
            </button>
          </div>
          <div className="flex gap-3 mt-3">
            <button onClick={() => subscribe("premium_monthly", "wechat")} className="flex-1 py-2 rounded-lg border border-green-800 text-green-300 text-xs">微信支付</button>
            <button onClick={() => subscribe("premium_monthly", "alipay")} className="flex-1 py-2 rounded-lg border border-blue-800 text-blue-300 text-xs">支付宝</button>
          </div>
          <p className="text-xs text-stone-600 mt-4 text-center">{t.demoNote}</p>
        </div>
      </div>

      {/* Premium features preview */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-6">
        <h2 className="text-sm tracking-widest text-amber-500 mb-4">{t.previewTitle}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {t.previewItems.map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-2 p-4 bg-stone-800/40 rounded-lg">
              <span className="text-3xl">{f.icon}</span>
              <span className="text-xs text-stone-500">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
