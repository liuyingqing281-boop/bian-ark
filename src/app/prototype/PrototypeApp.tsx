"use client";

import { useRef, useState } from "react";

/* ============ 类型与初始数据（演示数据，昵称已按规范打码） ============ */

type Screen = "home" | "miss" | "chat" | "memory";

interface FeedItem {
  icon: string;
  action: string;
  who: string;
  when: string;
  private_?: boolean;
}

interface MemoryItem {
  id: number;
  section: string;
  text: string;
}

interface ChatMsg {
  from: "me" | "ta";
  text: string;
  evidence?: { quote: string; date: string };
  inferred?: boolean;
  askMemory?: boolean;
}

const SECTIONS = [
  { icon: "👤", name: "TA 是怎样的人", hint: "还不知道怎么描述 TA？" },
  { icon: "❤️", name: "我和 TA", hint: "你们的故事值得被记住", star: true },
  { icon: "🎵", name: "TA 喜欢什么", hint: "TA 平时喜欢做什么？" },
  { icon: "💬", name: "TA 怎么说话", hint: "TA 常挂在嘴边的话是？" },
  { icon: "📄", name: "基础资料", hint: "引导填写" },
] as const;

const INITIAL_FEED: FeedItem[] = [
  { icon: "🌸", action: "献花", who: "李**", when: "2 小时前" },
  { icon: "💬", action: "留言", who: "用户A", when: "昨天" },
  { icon: "🕯", action: "点灯", who: "王**", when: "3 天前" },
];

const INITIAL_MEMORIES: MemoryItem[] = [
  { id: 1, section: "TA 是怎样的人", text: "温和、幽默、喜欢喝茶" },
  { id: 2, section: "我和 TA", text: "我们第一次一起旅行，是去了青岛看海。" },
  { id: 3, section: "TA 喜欢什么", text: "京剧、茶、钓鱼" },
  { id: 4, section: "TA 喜欢什么", text: "年轻时经常带我去河边钓鱼，一坐就是一下午。" },
  { id: 5, section: "TA 怎么说话", text: "“慢慢来，不着急。”" },
  { id: 6, section: "基础资料", text: "姓名：林守拙 / 1940 年生 / 退休教师" },
];

const TIMELINE = [
  { year: "1940", event: "出生" },
  { year: "1965", event: "结婚" },
  { year: "1970", event: "长子出生" },
  { year: "1998", event: "退休" },
];

const QUICK_CHIPS = ["TA 以前最喜欢什么？", "我想听听 TA 的故事。", "我今天有点想 TA。"];

/* ============ 主组件 ============ */

export default function PrototypeApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [seenIntro, setSeenIntro] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>(INITIAL_FEED);
  const [candleLit, setCandleLit] = useState(false);

  // 对话页状态
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [evidence, setEvidence] = useState<ChatMsg["evidence"] | null>(null);

  // 记忆档案状态
  const [memories, setMemories] = useState<MemoryItem[]>(INITIAL_MEMORIES);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSection, setDrawerSection] = useState<string>(SECTIONS[0].name);
  const [drawerText, setDrawerText] = useState("");

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };

  /* ---------- 行为 ---------- */

  const openChat = () => {
    if (!seenIntro) setShowIntro(true);
    else setScreen("chat");
  };

  const sendChat = (text: string) => {
    const content = text.trim();
    if (!content || typing) return;
    setMsgs((m) => [...m, { from: "me", text: content }]);
    setDraft("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, replyFor(content)]);
    }, 1400);
  };

  const replyFor = (q: string): ChatMsg => {
    if (q.includes("钓鱼") || q.includes("喜欢")) {
      return {
        from: "ta",
        text: "如果是以前，爷爷大概会先笑一笑，然后说：“钓鱼啊，急不得，慢慢来。”",
        evidence: { quote: "年轻时经常带我去河边钓鱼，一坐就是一下午。", date: "2026.08.12" },
        inferred: true,
      };
    }
    if (q.includes("故事") || q.includes("讲讲")) {
      return {
        from: "ta",
        text: "爷爷可能会说起我们第一次去青岛看海的事。那天的风很大，他一路都在念叨“慢慢来，不着急”。",
        evidence: { quote: "我们第一次一起旅行，是去了青岛看海。", date: "2026.08.02" },
        inferred: true,
      };
    }
    if (q.includes("想")) {
      return {
        from: "ta",
        text: "爷爷可能不知道该怎么劝你，但他大概会安静听着，然后问一句：“吃饭了吗？”",
        inferred: true,
      };
    }
    return {
      from: "ta",
      text: "我还没有找到关于这件事的记录。如果你愿意，可以告诉我，让更多的人记住 TA 的这一面。",
      askMemory: true,
    };
  };

  const saveMemory = () => {
    const text = drawerText.trim();
    if (!text) return;
    setMemories((list) => [...list, { id: Date.now(), section: drawerSection, text }]);
    setDrawerOpen(false);
    setDrawerText("");
    say("已保存到 TA 的记忆档案");
  };

  /* ---------- 通用小组件 ---------- */

  const TopBar = ({ title, back, more }: { title: string; back?: () => void; more?: boolean }) => (
    <div className="flex items-center justify-between px-4 h-12 shrink-0">
      <button
        onClick={back}
        className="w-11 h-11 -ml-2 flex items-center justify-center text-dai text-xl"
        aria-label="返回"
      >
        {back ? "←" : ""}
      </button>
      <span className="font-song text-[17px] text-ink">{title}</span>
      <button
        className="w-11 h-11 -mr-2 flex items-center justify-center text-dai text-xl tracking-widest"
        aria-label="更多"
        onClick={() => more && say("演示：分享 / 编辑资料 / 协作管理")}
      >
        {more ? "⋯" : ""}
      </button>
    </div>
  );

  const Avatar = ({ size = 24 }: { size?: number }) => (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-song text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: "linear-gradient(135deg, #3e4c59 0%, #6b7c8c 100%)",
      }}
    >
      守
    </div>
  );

  const Toast = () =>
    toast ? (
      <div className="absolute inset-x-0 bottom-24 z-50 flex justify-center pointer-events-none animate-fade-in">
        <div
          className="px-4 py-2 rounded-full text-sm text-white"
          style={{ background: "rgba(43,43,43,0.88)" }}
        >
          {toast}
        </div>
      </div>
    ) : null;

  /* ---------- 页面 1：纪念馆首页（§2.1） ---------- */

  const scrollRef = useRef<HTMLDivElement>(null);
  const anchor = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const HomeScreen = () => (
    <div className="flex flex-col h-full">
      <TopBar title="" back={undefined} more />
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4">
        {/* 顶部沉浸区：约占首屏 60% */}
        <section className="relative px-6 pt-2 pb-8 flex flex-col items-center text-center">
          <button
            className="w-28 h-28 rounded-full shadow-soft flex items-center justify-center font-song text-5xl text-white"
            style={{ background: "linear-gradient(150deg, #3e4c59 0%, #7d8fa0 100%)" }}
            onClick={() => say("演示：全屏查看照片")}
          >
            守
          </button>
          <h1 className="mt-4 font-song text-2xl text-ink">林守拙</h1>
          <p className="mt-1 text-[13px] text-ink-2 tracking-widest">1940 — 2023</p>
          <p className="mt-2 text-[13px] text-ink-3">“想念从未离开”</p>
          <button
            onClick={openChat}
            className="mt-5 w-full h-[52px] rounded-full bg-flame text-white text-[17px] active:opacity-85 transition"
          >
            和 TA 说说话
          </button>
          {candleLit && (
            <div className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-2 animate-fade-in">
              <span className="inline-block w-2 h-3 rounded-t-full bg-flame origin-bottom animate-flame" />
              灯还亮着
            </div>
          )}
        </section>

        {/* 三等宽 Tab（页内锚点） */}
        <nav className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-y border-bone">
          <div className="grid grid-cols-3">
            {[
              ["记忆", "sec-memory"],
              ["想念", "sec-miss"],
              ["祭奠", "sec-offer"],
            ].map(([label, id]) => (
              <button
                key={id}
                onClick={() => anchor(id)}
                className="h-11 text-[15px] text-ink relative after:absolute after:inset-x-10 after:bottom-1.5 after:h-0.5 after:bg-flame after:opacity-0 hover:after:opacity-100"
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* 记忆 · TA 的人生 */}
        <section id="sec-memory" className="px-5 pt-6 scroll-mt-12">
          <h2 className="font-song text-[17px] text-ink">TA 的人生</h2>
          <div className="mt-3 space-y-3">
            {TIMELINE.map((t) => (
              <div key={t.year} className="flex items-baseline gap-4">
                <span className="font-song text-[15px] text-dai w-12">{t.year}</span>
                <span className="text-[15px] text-ink">{t.event}</span>
              </div>
            ))}
          </div>
          <button
            className="mt-3 text-[13px] text-dai underline underline-offset-4"
            onClick={() => say("演示：添加生平事件（馆主）")}
          >
            ＋ 添加
          </button>
        </section>

        {/* 想念 · 最近的纪念 */}
        <section id="sec-miss" className="px-5 pt-8 scroll-mt-12">
          <h2 className="font-song text-[17px] text-ink">最近的纪念</h2>
          <div className="mt-3 bg-white rounded-xl shadow-soft divide-y divide-bone">
            {feed.slice(0, 5).map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg">{f.icon}</span>
                <span className="text-[14px] text-ink flex-1">
                  {f.action} · {f.who}
                  {f.private_ && <span className="ml-1 text-ink-3">🔒</span>}
                </span>
                <span className="text-[13px] text-ink-3">{f.when}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 祭奠 · 基础三项（免费） */}
        <section id="sec-offer" className="px-5 pt-8 scroll-mt-12">
          <h2 className="font-song text-[17px] text-ink">今天想为 TA 做什么？</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              { icon: "🌸", name: "献花" },
              { icon: "🕯", name: "点灯" },
              { icon: "🌿", name: "清香" },
            ].map((o) => (
              <button
                key={o.name}
                onClick={() => {
                  if (o.name === "点灯") {
                    setCandleLit(true);
                    say("灯还亮着");
                  } else {
                    say(`已为 TA ${o.name}`);
                  }
                  setFeed((f) => [{ icon: o.icon, action: o.name, who: "我", when: "刚刚" }, ...f]);
                }}
                className="relative bg-white rounded-xl shadow-soft py-4 flex flex-col items-center gap-1 active:opacity-85 transition"
              >
                <span className="absolute top-1.5 right-1.5 text-[12px] text-leaf">免费</span>
                <span className="text-[32px]">{o.icon}</span>
                <span className="text-[13px] text-ink-2">{o.name}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* 产品底部导航（发现为后续阶段，置灰） */}
      <nav className="shrink-0 border-t border-bone bg-paper grid grid-cols-3 pb-[env(safe-area-inset-bottom)]">
        {[
          ["🏛", "纪念馆", true],
          ["🧭", "发现", false],
          ["👤", "我的", false],
        ].map(([icon, label, active]) => (
          <button
            key={label as string}
            className={`h-14 flex flex-col items-center justify-center gap-0.5 text-[12px] ${
              active ? "text-dai" : "text-ink-3"
            }`}
            onClick={() => !active && say("演示：「发现」为后续阶段")}
          >
            <span className="text-lg">{icon as string}</span>
            {label as string}
          </button>
        ))}
      </nav>
    </div>
  );

  /* ---------- 页面 2：想念页（§2.2） ---------- */

  const MissScreen = () => {
    const [text, setText] = useState("");
    const [kind, setKind] = useState<"留言" | "悄悄话" | "悼文">("留言");
    return (
      <div className="flex flex-col h-full">
        <TopBar title="想念" back={() => setScreen("home")} />
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <section className="flex flex-col items-center text-center pt-2">
            <p className="font-song text-[17px] text-ink">今天想和 TA 说些什么？</p>
            <div className="mt-4"><Avatar size={64} /></div>
            <p className="mt-3 text-[13px] text-ink-3">“想说的话，可以告诉我。”</p>
            <button
              onClick={openChat}
              className="mt-4 h-[52px] px-10 rounded-full bg-flame text-white text-[17px] active:opacity-85 transition"
            >
              和 TA 说说话
            </button>
          </section>

          <section className="mt-8">
            <h2 className="font-song text-[17px] text-ink">留下你的话</h2>
            <div className="mt-3 bg-white rounded-xl shadow-soft p-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="写下想对 TA 说的话……"
                className="w-full resize-none outline-none text-[16px] text-ink placeholder:text-ink-3 bg-transparent"
              />
              <div className="text-right text-[12px] text-ink-3">{text.length}/500</div>
            </div>
            <div className="mt-3 flex gap-2">
              {(["悼文", "悄悄话", "留言"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`h-9 px-4 rounded-full text-[14px] border transition ${
                    kind === k
                      ? "border-dai text-dai bg-white"
                      : "border-bone text-ink-2 bg-white"
                  }`}
                >
                  {k === "悄悄话" ? "🔒 悄悄话" : k}
                </button>
              ))}
            </div>
            <button
              disabled={!text.trim()}
              onClick={() => {
                setFeed((f) => [
                  {
                    icon: kind === "悼文" ? "📜" : "💬",
                    action: kind,
                    who: "我",
                    when: "刚刚",
                    private_: kind === "悄悄话",
                  },
                  ...f,
                ]);
                setText("");
                say("已留下");
              }}
              className={`mt-4 w-full h-[52px] rounded-full text-[17px] transition ${
                text.trim() ? "bg-flame text-white active:opacity-85" : "bg-disabled text-ink-3"
              }`}
            >
              提 交
            </button>
          </section>
        </div>
      </div>
    );
  };

  /* ---------- 页面 3：和 TA 说说话（§2.4） ---------- */

  const ChatScreen = () => (
    <div className="flex flex-col h-full">
      <TopBar title="和爷爷说说话" back={() => setScreen("home")} more />
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        <div className="flex items-center gap-3 py-2 text-[13px] text-ink-3">
          <span className="flex-1 h-px bg-bone" />今天<span className="flex-1 h-px bg-bone" />
        </div>

        {msgs.length === 0 && !typing && (
          <div className="mt-10 flex flex-col items-center text-center animate-fade-in">
            <Avatar size={48} />
            <p className="mt-3 text-[14px] text-ink-2">想 TA 的时候，可以来和 TA 说说话。</p>
          </div>
        )}

        <div className="space-y-4 mt-2">
          {msgs.map((m, i) =>
            m.from === "me" ? (
              <div key={i} className="flex justify-end animate-fade-up">
                <div className="max-w-[78%] bg-dai text-white rounded-xl rounded-br-sm px-3.5 py-2.5 text-[15px]">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2 animate-fade-up">
                <Avatar size={24} />
                <div className="max-w-[78%]">
                  <div className="bg-white rounded-xl rounded-tl-sm shadow-soft px-3.5 py-2.5 text-[15px] text-ink">
                    {m.text}
                  </div>
                  {m.evidence && (
                    <button
                      onClick={() => setEvidence(m.evidence!)}
                      className="mt-1 text-[13px] text-dai underline underline-offset-4"
                    >
                      查看这句话的依据
                    </button>
                  )}
                  {m.inferred && (
                    <p className="mt-0.5 text-[12px] text-ink-3">基于 TA 的资料推测</p>
                  )}
                  {m.askMemory && (
                    <button
                      onClick={() => {
                        setDrawerSection("TA 喜欢什么");
                        setDrawerOpen(true);
                      }}
                      className="mt-1.5 h-9 px-4 rounded-full border border-dai text-dai text-[13px] bg-white"
                    >
                      添加一段关于 TA 的记忆
                    </button>
                  )}
                </div>
              </div>
            )
          )}
          {typing && (
            <div className="flex gap-2 animate-fade-in">
              <Avatar size={24} />
              <div className="bg-white rounded-xl rounded-tl-sm shadow-soft px-3.5 py-2.5 flex items-center gap-1.5">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-warm animate-typing"
                    style={{ animationDelay: `${d * 0.18}s` }}
                  />
                ))}
                <span className="ml-1 text-[13px] text-ink-3">正在想你问的话…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 快捷 chip：空对话时显示 */}
      {msgs.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 animate-fade-in">
          {QUICK_CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => sendChat(c)}
              className="h-9 px-3.5 rounded-full bg-white border border-bone text-[13px] text-ink-2"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* 输入栏 */}
      <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
        <div className="flex items-center gap-2 bg-white rounded-full shadow-soft pl-4 pr-1.5 py-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat(draft)}
            placeholder="想对 TA 说……"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-ink-3"
          />
          <button
            onClick={() => say("语音功能正在准备中")}
            className="w-10 h-10 rounded-full flex items-center justify-center text-ink-3 opacity-40"
            aria-label="语音（即将上线）"
          >
            🎙
          </button>
          <button
            onClick={() => sendChat(draft)}
            disabled={!draft.trim() || typing}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition ${
              draft.trim() && !typing ? "bg-flame active:opacity-85" : "bg-disabled"
            }`}
            aria-label="发送"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );

  /* ---------- 页面 4：TA 的记忆档案（§2.5） ---------- */

  const MemoryScreen = () => (
    <div className="flex flex-col h-full">
      <TopBar title="TA 的记忆档案" back={() => setScreen("home")} />
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <p className="pt-1 text-[13px] text-ink-2">已建立 {memories.length} 条记忆</p>
        {SECTIONS.map((s) => {
          const items = memories.filter((m) => m.section === s.name);
          return (
            <section key={s.name} className="mt-5">
              <h2
                className={`text-[15px] flex items-center gap-1.5 ${
                  "star" in s && s.star ? "text-dai font-song" : "text-ink"
                }`}
              >
                <span>{s.icon}</span>
                {s.name}
                {"star" in s && s.star && <span className="text-[11px] text-flame">★关系记忆</span>}
              </h2>
              {items.length === 0 ? (
                <p className="mt-2 text-[13px] text-ink-3">{s.hint}</p>
              ) : (
                <div className="mt-2 bg-white rounded-xl shadow-soft divide-y divide-bone">
                  {items.map((m) => (
                    <div key={m.id} className="group flex items-start gap-2 px-4 py-3">
                      <p className="flex-1 text-[14px] text-ink">{m.text}</p>
                      <button
                        className="text-[12px] text-rust opacity-0 group-hover:opacity-100 transition"
                        onClick={() => {
                          setMemories((list) => list.filter((x) => x.id !== m.id));
                          say("已删除");
                        }}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="absolute inset-x-0 bottom-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-paper via-paper to-transparent">
        <button
          onClick={() => {
            setDrawerSection(SECTIONS[0].name);
            setDrawerOpen(true);
          }}
          className="w-full h-[52px] rounded-full bg-dai text-white text-[17px] active:opacity-85 transition"
        >
          ＋ 添加记忆
        </button>
      </div>
    </div>
  );

  /* ---------- 弹层：身份说明页（§2.3，文案逐字使用） ---------- */

  const IntroSheet = () =>
    showIntro ? (
      <div
        className="absolute inset-0 z-40 flex items-end"
        style={{ background: "rgba(0,0,0,0.4)" }}
      >
        <div className="w-full bg-paper rounded-t-2xl px-6 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] animate-sheet-up">
          <div className="flex flex-col items-center text-center">
            <Avatar size={56} />
            <h2 className="mt-4 font-song text-xl text-ink">和 TA 说说话</h2>
            <p className="mt-3 text-[15px] text-ink leading-relaxed">
              根据 TA 的文字、故事、照片等资料构建纪念性 AI。
              <br />
              它不是 TA 本人，也不能真正代表 TA。
            </p>
            <ul className="mt-4 space-y-1.5 text-[14px] text-ink-2">
              <li>· 帮你回忆 TA</li>
              <li>· 听你说说话</li>
              <li>· 根据已有记忆尝试回应</li>
            </ul>
            <button
              onClick={() => {
                setSeenIntro(true);
                setShowIntro(false);
                setScreen("chat");
              }}
              className="mt-6 w-full h-[52px] rounded-full bg-flame text-white text-[17px] active:opacity-85 transition"
            >
              开始和 TA 说说话
            </button>
          </div>
        </div>
      </div>
    ) : null;

  /* ---------- 弹层：回答依据（§2.4） ---------- */

  const EvidenceSheet = () =>
    evidence ? (
      <div
        className="absolute inset-0 z-40 flex items-end"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={() => setEvidence(null)}
      >
        <div
          className="w-full bg-paper rounded-t-2xl px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] animate-sheet-up"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-song text-[17px] text-ink text-center">这句话的依据</h3>
          <div className="mt-4 bg-white rounded-xl shadow-soft p-4">
            <p className="text-[13px] text-dai">📖 你记录的故事</p>
            <p className="mt-2 text-[15px] text-ink">“{evidence.quote}”</p>
            <p className="mt-3 text-[12px] text-ink-3">📅 添加于 {evidence.date}</p>
          </div>
          <button
            onClick={() => setEvidence(null)}
            className="mt-5 w-full h-12 rounded-full border border-dai text-dai bg-white"
          >
            关 闭
          </button>
        </div>
      </div>
    ) : null;

  /* ---------- 抽屉：添加记忆（§2.5 / §2.4 闭环） ---------- */

  const MemoryDrawer = () =>
    drawerOpen ? (
      <div
        className="absolute inset-0 z-40 flex items-end"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={() => setDrawerOpen(false)}
      >
        <div
          className="w-full bg-paper rounded-t-2xl px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-sheet-up"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-song text-[17px] text-ink text-center">添加记忆</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <button
                key={s.name}
                onClick={() => setDrawerSection(s.name)}
                className={`h-9 px-3 rounded-full text-[13px] border transition ${
                  drawerSection === s.name
                    ? "border-dai text-dai bg-white"
                    : "border-bone text-ink-2 bg-white"
               }`}
              >
                {s.icon} {s.name}
              </button>
            ))}
          </div>
          <textarea
            value={drawerText}
            onChange={(e) => setDrawerText(e.target.value)}
            rows={3}
            placeholder="他年轻的时候经常带我去河边……"
            className="mt-4 w-full bg-white rounded-xl shadow-soft p-3 resize-none outline-none text-[15px] placeholder:text-ink-3"
          />
          <button
            disabled={!drawerText.trim()}
            onClick={saveMemory}
            className={`mt-4 w-full h-[52px] rounded-full text-[17px] transition ${
              drawerText.trim() ? "bg-flame text-white active:opacity-85" : "bg-disabled text-ink-3"
            }`}
          >
            保 存
          </button>
        </div>
      </div>
    ) : null;

  /* ---------- 原型外壳：手机框 + 页面切换器 ---------- */

  const SCREENS: { key: Screen; label: string; star: string }[] = [
    { key: "home", label: "纪念馆首页", star: "★★★★★" },
    { key: "miss", label: "想念页", star: "★★★★★" },
    { key: "chat", label: "和 TA 说说话", star: "★★★★★" },
    { key: "memory", label: "记忆档案", star: "★★★★★" },
  ];

  return (
    <div className="proto-stage min-h-screen flex flex-col items-center justify-center py-8 px-4">
      <header className="mb-6 text-center">
        <h1 className="font-song text-2xl text-ink">彼岸 · P0 核心页高保真原型</h1>
        <p className="mt-1 text-[13px] text-ink-2">
          依据《前端具体设计流程》§1.3 视觉规范 · 黛蓝灰 / 宣纸白 / 烛火橙
        </p>
      </header>

      {/* 手机框：375px 移动端基准 */}
      <div className="relative w-[375px] h-[760px] rounded-[2.5rem] border-[10px] border-ink/90 bg-paper overflow-hidden shadow-2xl">
        {screen === "home" && <HomeScreen />}
        {screen === "miss" && <MissScreen />}
        {screen === "chat" && <ChatScreen />}
        {screen === "memory" && <MemoryScreen />}
        <IntroSheet />
        <EvidenceSheet />
        <MemoryDrawer />
        <Toast />
      </div>

      {/* 原型页面切换器（非产品 UI） */}
      <nav className="mt-6 flex flex-wrap justify-center gap-2">
        {SCREENS.map((s) => (
          <button
            key={s.key}
            onClick={() => setScreen(s.key)}
            className={`h-10 px-4 rounded-full text-[14px] border transition ${
              screen === s.key
                ? "bg-dai text-white border-dai"
                : "bg-white text-ink-2 border-bone hover:border-warm"
            }`}
          >
            {s.label} <span className="text-[11px] opacity-70">{s.star}</span>
          </button>
        ))}
      </nav>
      <p className="mt-3 text-[12px] text-ink-3">
        提示：首次点击「和 TA 说说话」会先经过身份说明页；对话中发送任意问题可体验「依据 / 推测角标 / 补充记忆」三种闭环。
      </p>
    </div>
  );
}
