"use client";

import { useEffect, useRef, useState } from "react";
import "./zcode-proto.css";

/* 彼岸 · 前端操作界面原型（ZCode 独立版）
 * 依据《前端具体设计流程与设计图纸》实现 P0 页面；
 * 与 kimi 版（/prototype）完全隔离，路由 /proto-zcode
 * 视觉基调：宣纸白 + 黛蓝灰 + 烛火橙；首页沉浸区采用低饱和「折光渐变」光幕
 */

type Page = "home" | "miss" | "explain" | "chat" | "memory" | "offer" | "gift" | "mine";
type Msg = { who: "me" | "ta"; text: string; basis?: string; guess?: boolean; addMemory?: boolean; loading?: boolean };

const TA_NAME = "爷爷";
const QUICK_CHIPS = ["爷爷以前最喜欢什么？", "我想听听爷爷的故事。", "我今天有点想爷爷。"];

const MEM_SECTIONS: { icon: string; title: string; items: string[]; empty: string }[] = [
  { icon: "👤", title: "TA 是怎样的人", items: ["温和、幽默、喜欢喝茶"], empty: "还不知道怎么描述 TA？" },
  { icon: "❤️", title: "我和 TA ★关系记忆", items: ["我们第一次一起旅行去了杭州……"], empty: "你们的故事值得被记住" },
  { icon: "🎵", title: "TA 喜欢什么", items: ["京剧、茶、钓鱼"], empty: "TA 平时喜欢做什么？" },
  { icon: "💬", title: "TA 怎么说话", items: ["“慢慢来，不着急。”"], empty: "TA 常挂在嘴边的话是？" },
  { icon: "📄", title: "基础资料", items: ["姓名 / 1940 年出生 / 退休教师"], empty: "引导填写" },
];

const TIMELINE = [
  ["1940", "出生"],
  ["1965", "结婚"],
  ["1968", "开始教书"],
  ["2000", "退休，开始学钓鱼"],
];

const RECENT = [
  ["🌸", "献花", "李**", "2 小时前"],
  ["💬", "留言", "用户A", "昨天"],
  ["🕯", "点灯", "王**", "3 天前"],
];

export default function ZcodePrototypeApp() {
  const [page, setPage] = useState<Page>("home");
  const [tab, setTab] = useState<"mem" | "miss" | "off">("mem");
  const [toast, setToast] = useState<string | null>(null);
  const [confirmOffer, setConfirmOffer] = useState<{ icon: string; name: string; price: string } | null>(null);
  const [lit, setLit] = useState(false);
  const [explained, setExplained] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [missDraft, setMissDraft] = useState("");
  const [missType, setMissType] = useState<"留言" | "悄悄话" | "悼文">("留言");
  const [addMemoryOpen, setAddMemoryOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memCount, setMemCount] = useState(32);
  const [basisOpen, setBasis] = useState<string | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2000);
  };

  const goChat = () => {
    if (!explained) setPage("explain");
    else setPage("chat");
  };

  const startChat = () => {
    setExplained(true);
    setPage("chat");
  };

  const send = (text?: string) => {
    const t = (text ?? draft).trim();
    if (!t) return;
    setMsgs((m) => [...m, { who: "me", text: t }]);
    setDraft("");
    setMsgs((m) => [...m, { who: "ta", text: "", loading: true }]);
    setTimeout(() => {
      setMsgs((m) => {
        const arr = [...m];
        arr[arr.length - 1] = t.includes("喜欢")
          ? {
              who: "ta",
              text: "爷爷最喜欢钓鱼，还有喝茶。每年夏天他都带你去河边。",
              basis: "📖 你记录的故事：“爷爷每年夏天都带我去河边钓鱼……”（添加于 2026.08.12）",
            }
          : {
              who: "ta",
              text: "我还没有找到关于这件事的记录。如果你愿意，可以告诉我。",
              addMemory: true,
              guess: true,
            };
        return arr;
      });
    }, 1200);
  };

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const refreshRecent = () => {
    setLoadingRecent(true);
    setTimeout(() => setLoadingRecent(false), 800);
  };

  const navBtn = (p: Page, icon: string, label: string) => (
    <button className={page === p || (p === "home" && (page === "miss" || page === "chat" || page === "memory" || page === "offer" || page === "gift" || page === "explain")) ? "zp-on" : ""} onClick={() => setPage(p)}>
      <span className="zp-nav-emoji">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="zp-root">
      <div className="zp-phone">
        {/* ───── 纪念馆首页 ───── */}
        {page === "home" && (
          <>
            <div className="zp-fold">
              <div style={{ display: "flex", justifyContent: "space-between", color: "#fff", fontSize: 18, marginBottom: 16 }}>
                <span>←</span>
                <button
                  style={{ background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}
                  onClick={() => say("分享纪念馆 / 编辑资料 / 协作管理")}
                >
                  ⋯
                </button>
              </div>
              <div className="zp-avatar">👴</div>
              <div className="zp-serif" style={{ fontSize: 24 }}>爷爷</div>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>1940 — 2020</div>
              <div style={{ fontSize: 13, opacity: 0.85, margin: "8px 0 16px" }}>“想念从未离开”</div>
              <button className="zp-btn zp-btn-primary" onClick={goChat}>和 TA 说说话</button>
            </div>
            <div className="zp-tabs">
              {(["mem", "miss", "off"] as const).map((t) => (
                <button
                  key={t}
                  className={`zp-tab${tab === t ? " zp-on" : ""}`}
                  onClick={() => {
                    setTab(t);
                    if (t === "miss") setPage("miss");
                    if (t === "off") setPage("offer");
                  }}
                >
                  {t === "mem" ? "记忆" : t === "miss" ? "想念" : "祭奠"}
                </button>
              ))}
            </div>
            <div className="zp-body">
              <div className="zp-card">
                <h2 className="zp-h2 zp-serif">TA 的人生</h2>
                {TIMELINE.length === 0 ? (
                  <div className="zp-empty">
                    <span className="zp-empty-icon">🕊</span>
                    还没有记录 TA 的故事
                    <div style={{ marginTop: 12 }}>
                      <button className="zp-chip" onClick={() => setPage("memory")}>记录 TA 的第一个故事</button>
                    </div>
                  </div>
                ) : (
                  TIMELINE.map(([y, e]) => (
                    <div key={y} className="zp-cell">
                      <span className="zp-timeline-year">{y}</span>
                      <span>{e}</span>
                      <button className="zp-chip" style={{ marginLeft: "auto" }} onClick={() => say("打开生平事件编辑（馆主）")}>＋</button>
                    </div>
                  ))
                )}
              </div>
              <div className="zp-card">
                <h2 className="zp-h2 zp-serif">最近的纪念</h2>
                {loadingRecent ? (
                  <div className="zp-skel" style={{ height: 48 }} />
                ) : (
                  RECENT.map(([i, a, u, t]) => (
                    <div key={a + u} className="zp-cell">
                      <span style={{ width: 24 }}>{i}</span>
                      <span>{a}</span>
                      <span style={{ color: "var(--t3)", fontSize: 13 }}>{u}</span>
                      <span style={{ marginLeft: "auto", color: "var(--t3)", fontSize: 13 }}>{t}</span>
                    </div>
                  ))
                )}
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <button className="zp-chip" onClick={refreshRecent}>查看全部纪念</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ───── 想念页 ───── */}
        {page === "miss" && (
          <>
            <div className="zp-fold" style={{ padding: "48px 20px 24px" }}>
              <div style={{ fontSize: 17, marginBottom: 14 }}>今天想和 TA 说些什么？</div>
              <div className="zp-avatar" style={{ width: 72, height: 72, fontSize: 32 }}>👴</div>
              <div style={{ fontSize: 14, opacity: 0.85, margin: "8px 0 14px" }}>“想说的话，可以告诉我。”</div>
              <button className="zp-btn zp-btn-primary" onClick={goChat}>和 TA 说说话</button>
            </div>
            <div className="zp-body">
              <div className="zp-card">
                <h2 className="zp-h2 zp-serif">留下你的话</h2>
                <textarea
                  value={missDraft}
                  onChange={(e) => setMissDraft(e.target.value.slice(0, 500))}
                  placeholder="写下想对 TA 说的话……"
                  style={{ width: "100%", minHeight: 96, border: "1px solid #e8e4dc", borderRadius: 12, padding: 12, fontSize: 16, boxSizing: "border-box", background: "#fff" }}
                />
                <div style={{ textAlign: "right", fontSize: 12, color: "var(--t3)", margin: "4px 0 10px" }}>{missDraft.length} / 500</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {(["留言", "悄悄话", "悼文"] as const).map((t) => (
                    <button key={t} className="zp-chip" style={missType === t ? { borderColor: "var(--flame)", color: "var(--flame)" } : {}} onClick={() => setMissType(t)}>
                      {t === "悄悄话" ? "🔒 悄悄话" : t}
                    </button>
                  ))}
                </div>
                <button className="zp-btn zp-btn-primary" disabled={!missDraft.trim()} onClick={() => { say("已留下"); setMissDraft(""); }}>
                  提 交
                </button>
              </div>
            </div>
          </>
        )}

        {/* ───── 身份说明页（首次必经） ───── */}
        {page === "explain" && (
          <div className="zp-body" style={{ paddingTop: 56 }}>
            <div style={{ textAlign: "center", padding: "0 28px" }}>
              <h1 className="zp-serif" style={{ fontSize: 24, color: "var(--t1)" }}>和 TA 说说话</h1>
              <div className="zp-avatar" style={{ marginTop: 20 }}>👴</div>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--t2)", textAlign: "left", margin: "20px 0" }}>
                根据 TA 的文字、故事、照片等资料构建纪念性 AI。<br />
                它不是 TA 本人，也不能真正代表 TA。
              </p>
              <ul style={{ fontSize: 16, lineHeight: 1.8, color: "var(--t2)", textAlign: "left", paddingLeft: 20 }}>
                <li>帮你回忆 TA</li>
                <li>听你说说话</li>
                <li>根据已有记忆尝试回应</li>
              </ul>
            </div>
            <div style={{ padding: "0 20px" }}>
              <button className="zp-btn zp-btn-primary" onClick={startChat}>开始和 TA 说说话</button>
            </div>
          </div>
        )}

        {/* ───── AI 对话页 ───── */}
        {page === "chat" && (
          <>
            <div style={{ height: 52, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid #e8e4dc", background: "#fff" }}>
              <button style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }} onClick={() => setPage("home")}>←</button>
              <span className="zp-serif" style={{ flex: 1, textAlign: "center", fontSize: 17, color: "var(--t1)" }}>和{TA_NAME}说说话</span>
              <button style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }} onClick={() => say("清空对话 / 反馈问题")}>⋯</button>
            </div>
            <div className="zp-body" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px" }}>
              <div style={{ textAlign: "center", fontSize: 13, color: "var(--t3)" }}>── 今天 ──</div>
              {msgs.length === 0 &&
                QUICK_CHIPS.map((c) => (
                  <button key={c} className="zp-chip" style={{ alignSelf: "center" }} onClick={() => send(c)}>
                    “{c}”
                  </button>
                ))}
              {msgs.map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.who === "me" ? "flex-end" : "flex-start", gap: 4 }}>
                  <div className={`zp-bubble ${m.who === "me" ? "zp-bubble-me" : "zp-bubble-ta"}`}>
                    {m.loading ? (
                      <span className="zp-dots"><span /><span /><span /> 正在想你问的话…</span>
                    ) : (
                      m.text
                    )}
                  </div>
                  {m.basis && (
                    <button style={{ background: "none", border: "none", fontSize: 13, color: "var(--ink)", textDecoration: "underline", cursor: "pointer", padding: 0 }} onClick={() => setBasis(m.basis!)}>
                      查看这句话的依据
                    </button>
                  )}
                  {m.guess && <span style={{ fontSize: 12, color: "var(--t3)" }}>基于 TA 的资料推测</span>}
                  {m.addMemory && (
                    <button className="zp-chip" onClick={() => setAddMemoryOpen(true)}>＋ 添加一段关于 TA 的记忆</button>
                  )}
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
            <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, padding: "8px 12px", background: "rgba(255,255,255,0.97)", borderTop: "1px solid #e8e4dc", display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="想对 TA 说……"
                style={{ flex: 1, height: 40, borderRadius: 24, border: "1px solid #e8e4dc", padding: "0 14px", fontSize: 15, background: "#fff", outline: "none" }}
              />
              <span style={{ opacity: 0.4, cursor: "pointer" }} title="" onClick={() => say("语音功能正在准备中")}>🎙</span>
              <button className="zp-btn" style={{ width: 44, height: 44, borderRadius: 22, background: draft.trim() ? "var(--flame)" : "#d8d4cc", color: "#fff", fontSize: 17 }} disabled={!draft.trim()} onClick={() => send()}>
                ↑
              </button>
            </div>
          </>
        )}

        {/* ───── 记忆档案页 ───── */}
        {page === "memory" && (
          <>
            <div style={{ height: 52, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid #e8e4dc", background: "#fff" }}>
              <button style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }} onClick={() => setPage("home")}>←</button>
              <span className="zp-serif" style={{ flex: 1, textAlign: "center", fontSize: 17 }}>TA 的记忆档案</span>
              <span style={{ width: 18 }} />
            </div>
            <div className="zp-body">
              <div style={{ textAlign: "center", fontSize: 13, color: "var(--t2)", padding: "12px 0 0" }}>已建立 {memCount} 条记忆</div>
              {MEM_SECTIONS.map((s) => (
                <div key={s.title} className="zp-card" style={s.title.includes("关系") ? { border: "1px solid rgba(217,142,74,0.35)" } : {}}>
                  <h2 className="zp-h2 zp-serif">{s.icon} {s.title}</h2>
                  {s.items.length === 0 ? (
                    <div className="zp-empty">{s.empty}</div>
                  ) : (
                    s.items.map((it) => (
                      <div key={it} className="zp-cell" style={{ color: "var(--t2)" }}>
                        {it}
                        <button className="zp-chip" style={{ marginLeft: "auto" }} onClick={() => say("编辑 / 左滑删除（馆主与协作人）")}>⋯</button>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, padding: "10px 20px", background: "rgba(255,255,255,0.97)", borderTop: "1px solid #e8e4dc" }}>
              <button className="zp-btn zp-btn-primary" onClick={() => setAddMemoryOpen(true)}>＋ 添加记忆</button>
            </div>
          </>
        )}

        {/* ───── 祭奠页 ───── */}
        {page === "offer" && (
          <div className="zp-body" style={{ paddingTop: 48 }}>
            <h1 className="zp-serif" style={{ fontSize: 24, textAlign: "center" }}>祭奠</h1>
            <p style={{ textAlign: "center", color: "var(--t2)", margin: "8px 0 4px" }}>今天想为 TA 做什么？</p>
            {lit && <p style={{ textAlign: "center", fontSize: 13, color: "var(--flame)" }}><span className="zp-flame">🕯</span> 灯还亮着</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: 16 }}>
              {[
                { icon: "🌸", name: "献花", price: "免费" },
                { icon: "🕯", name: "点灯", price: "免费" },
                { icon: "🌿", name: "清香", price: "免费" },
                { icon: "🍎", name: "水果", price: "¥8" },
                { icon: "🍵", name: "茶", price: "¥6" },
                { icon: "🎁", name: "纪念物", price: "¥19" },
              ].map((o) => (
                <button
                  key={o.name}
                  className="zp-card"
                  style={{ margin: 0, textAlign: "center", cursor: "pointer" }}
                  onClick={() => {
                    if (o.price === "免费") {
                      if (o.name === "点灯") setLit(true);
                      say(`${o.name}已供奉`);
                    } else setConfirmOffer(o);
                  }}
                >
                  <div style={{ fontSize: 32 }}>{o.icon}</div>
                  <div style={{ fontSize: 13, color: "var(--t1)", marginTop: 6 }}>{o.name}</div>
                  <div style={{ fontSize: 12, color: o.price === "免费" ? "var(--ok)" : "var(--t2)" }}>{o.price}</div>
                </button>
              ))}
            </div>
            <div style={{ padding: "0 16px" }}>
              <button className="zp-card zp-btn-outline zp-btn" style={{ margin: 0 }} onClick={() => setPage("gift")}>
                ✨ 为 TA 准备特别的礼物
              </button>
            </div>
          </div>
        )}

        {/* ───── AI 生成纪念物（三步） ───── */}
        {page === "gift" && (
          <GiftFlow onToast={say} onBack={() => setPage("offer")} />
        )}

        {/* ───── 我的 ───── */}
        {page === "mine" && (
          <div className="zp-body" style={{ paddingTop: 48 }}>
            <div className="zp-card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div className="zp-avatar" style={{ width: 56, height: 56, fontSize: 24, margin: 0 }}>🙂</div>
              <span style={{ fontSize: 18 }}>李**</span>
            </div>
            <div className="zp-card">
              {["个人资料", "我的纪念", "订单记录", "设置"].map((r) => (
                <div key={r} className="zp-cell" style={{ cursor: "pointer" }} onClick={() => say(`${r}（占位）`)}>
                  {r}
                  <span style={{ marginLeft: "auto", color: "var(--t3)" }}>›</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ───── 底部导航（3 入口） ───── */}
        <div className="zp-nav">
          {navBtn("home", "🕊", "纪念馆")}
          {navBtn("mine", "🙂", "我的")}
        </div>

        {/* ───── Toast ───── */}
        {toast && <div className="zp-toast">{toast}</div>}

        {/* ───── 一口价确认弹窗 ───── */}
        {confirmOffer && (
          <div className="zp-mask" onClick={() => setConfirmOffer(null)}>
            <div className="zp-dialog" onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 36 }}>{confirmOffer.icon}</div>
              <h3 className="zp-serif" style={{ margin: "8px 0 4px" }}>敬一份{confirmOffer.name}</h3>
              <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 4 }}>一口价 {confirmOffer.price}</div>
              <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 18 }}>会出现在纪念馆的供桌上</div>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="zp-btn zp-btn-outline" onClick={() => setConfirmOffer(null)}>取消</button>
                <button
                  className="zp-btn zp-btn-primary"
                  onClick={() => {
                    setConfirmOffer(null);
                    say("已供奉");
                  }}
                >
                  供奉
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ───── 回答依据弹层 ───── */}
        {basisOpen && (
          <div className="zp-mask" onClick={() => setBasis(null)}>
            <div className="zp-dialog" onClick={(e) => e.stopPropagation()}>
              <h3 className="zp-serif" style={{ marginTop: 0 }}>这句话的依据</h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--t2)", textAlign: "left" }}>{basisOpen?.replace(/^📖 /, "").split("（")[0]}</p>
              <p style={{ fontSize: 13, color: "var(--t3)" }}>📅 添加于 2026.08.12</p>
              <button className="zp-btn zp-btn-outline" style={{ marginTop: 12 }} onClick={() => setBasis(null)}>关闭</button>
            </div>
          </div>
        )}

        {/* ───── 添加记忆弹层 ───── */}
        {addMemoryOpen && (
          <div className="zp-mask" onClick={() => setAddMemoryOpen(false)}>
            <div className="zp-dialog" onClick={(e) => e.stopPropagation()}>
              <h3 className="zp-serif" style={{ marginTop: 0 }}>添加记忆</h3>
              <p style={{ fontSize: 13, color: "var(--t3)", textAlign: "left" }}>分区自动匹配</p>
              <textarea
                value={memoryDraft}
                onChange={(e) => setMemoryDraft(e.target.value)}
                placeholder="他年轻的时候经常带我去河边……"
                style={{ width: "100%", minHeight: 80, border: "1px solid #e8e4dc", borderRadius: 12, padding: 12, fontSize: 15, boxSizing: "border-box", marginBottom: 16 }}
              />
              <button
                className="zp-btn zp-btn-primary"
                disabled={!memoryDraft.trim()}
                onClick={() => {
                  setAddMemoryOpen(false);
                  setMemCount((c) => c + 1);
                  setMemoryDraft("");
                  say("已保存到 TA 的记忆档案");
                }}
              >
                保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── AI 生成纪念物三步流 ── */
function GiftFlow({ onToast, onBack }: { onToast: (t: string) => void; onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [like, setLike] = useState("");
  const [wish, setWish] = useState("");
  const [generating, setGenerating] = useState(false);

  return (
    <div className="zp-body" style={{ paddingTop: 48, paddingInline: 20 }}>
      <button style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", alignSelf: "flex-start" }} onClick={onBack}>←</button>
      {step === 1 && (
        <>
          <h2 className="zp-serif" style={{ fontSize: 20 }}>TA 生前最喜欢什么？</h2>
          <input value={like} onChange={(e) => setLike(e.target.value)} placeholder="很喜欢喝茶" style={{ width: "100%", height: 48, borderRadius: 12, border: "1px solid #e8e4dc", padding: "0 14px", fontSize: 16, marginTop: 16, boxSizing: "border-box" }} />
          <button className="zp-btn zp-btn-primary" style={{ marginTop: 20 }} disabled={!like.trim()} onClick={() => setStep(2)}>下一步</button>
        </>
      )}
      {step === 2 && (
        <>
          <h2 className="zp-serif" style={{ fontSize: 20 }}>你想送 TA 什么？</h2>
          <textarea value={wish} onChange={(e) => setWish(e.target.value)} placeholder="一套特别的茶具" style={{ width: "100%", minHeight: 80, borderRadius: 12, border: "1px solid #e8e4dc", padding: 12, fontSize: 16, marginTop: 16, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button className="zp-btn zp-btn-outline" onClick={() => { setWish("一套用了会想起我们的茶具，纹样里有山水和茶香"); onToast("已帮你写好（每日限量）"); }}>帮我写</button>
            <button className="zp-btn zp-btn-primary" disabled={!wish.trim()} onClick={() => { setGenerating(true); setTimeout(() => { setGenerating(false); setStep(3); }, 1500); }}>帮我准备</button>
          </div>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 12 }}>一口价 ¥19，生成前明示</p>
        </>
      )}
      {step === 3 && (
        <>
          <div className="zp-card" style={{ textAlign: "center", fontSize: 56, padding: "40px 0" }}>🍵</div>
          <p className="zp-serif" style={{ textAlign: "center", color: "var(--t2)" }}>“这是我想送给你的。”</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
            <button className="zp-btn zp-btn-primary" onClick={() => onToast("已收藏到纪念馆")}>收藏到纪念馆</button>
            <button className="zp-btn zp-btn-outline" onClick={() => onToast("分享卡片已生成")}>分享给亲友</button>
            <button className="zp-btn zp-btn-outline" onClick={() => { setStep(1); setLike(""); setWish(""); }}>再准备一件</button>
          </div>
        </>
      )}
      {generating && (
        <div className="zp-mask">
          <div className="zp-dialog">
            <div className="zp-skel" style={{ width: 200, height: 140, margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: "var(--t2)" }}>正在为 TA 准备礼物…<br />生成中可以离开，完成后站内通知</p>
          </div>
        </div>
      )}
    </div>
  );
}
