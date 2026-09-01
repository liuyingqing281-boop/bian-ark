"use client";

// 星海底部抽屉（Task 4，墓园规格 §3/§4/§8）：collapsed/half/full 三态。
// - 列表态：桌面横向卡片轨道 / 移动端收起 64–72px；详情半开 45–55vh；供奉全开；
//   详情内容最大宽度 880px。
// - 打开时焦点进入抽屉（data-autofocus 目标），回列表恢复把手焦点；Tab 圈禁在抽屉内。
// - Esc 按 供奉 → 详情 → 列表 层级回退（document 级监听，焦点在控件层也生效）。
// - 供奉面板：成员选择（多人馆）+ 祭品单选 + 留言；失败/未登录不清空输入。

import { useEffect, useRef, useState } from "react";
import type { GardenSeaHall } from "../../lib/garden-sea";
import type { GardenDrawer, GardenSeaState } from "../../lib/garden-sea-state";

export interface HallMember {
  id: string;
  name: string;
}

export type OfferStatus = "idle" | "pending" | "success" | "requiresLogin" | "failed";

export interface OfferItemOption {
  id: string;
  icon: string;
}

export interface StarSeaDrawerLabels {
  drawerLabel: string;
  handleExpand: string;
  listTitle: string;
  hallCount: (n: number) => string;
  detailLoading: string;
  detailCount: (n: number) => string;
  enterHall: string;
  offerCta: string;
  offerTitle: string;
  offerMemberLabel: string;
  offerItemLabel: string;
  offerMessageLabel: string;
  offerMessagePlaceholder: string;
  offerSubmit: string;
  offerSubmitting: string;
  offerSuccess: string;
  offerRequiresLogin: string;
  offerFailedPrefix: string;
  offerRetryLater: string;
  membersLoading: string;
  membersError: string;
  membersRetry: string;
  loginLink: string;
  epitaphEmpty: string;
}

interface StarSeaDrawerProps {
  lang: string;
  state: GardenSeaState;
  halls: Array<GardenSeaHall>;
  selectedHall: GardenSeaHall | null;
  matchedHallIds: Set<string> | null;
  members: Array<HallMember> | null;
  membersLoading: boolean;
  membersError: string | null;
  offerStatus: OfferStatus;
  offerNotice: string;
  offerItems: Array<OfferItemOption>;
  itemLabel: (id: string) => string;
  labels: StarSeaDrawerLabels;
  onRetryMembers: () => void;
  onSelectHall: (hallId: string) => void;
  onOpenOffer: () => void;
  onBack: () => void;
  /** 把手拖拽/列表态点击切换抽屉档位（规格 §3「支持把手、按钮、拖拽和键盘操作」） */
  onDrawerChange?: (drawer: GardenDrawer) => void;
  onSubmitOffer: (payload: { memorialId: string; itemId: string; message: string }) => void;
}

// 访客侧成员名脱敏（与 API nameMasked 同规则：首字 + **）
function maskName(name: string): string {
  return name.length <= 1 ? "*" : name[0] + "**";
}

function hallYears(hall: GardenSeaHall): string {
  const birth = hall.birthDate || "?";
  const death = hall.deathDate || "?";
  return `${birth} — ${death}`;
}

export default function StarSeaDrawer({
  lang,
  state,
  halls,
  selectedHall,
  matchedHallIds,
  members,
  membersLoading,
  membersError,
  offerStatus,
  offerNotice,
  offerItems,
  itemLabel,
  labels,
  onRetryMembers,
  onSelectHall,
  onOpenOffer,
  onBack,
  onDrawerChange,
  onSubmitOffer,
}: StarSeaDrawerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const prevPanelRef = useRef(state.panel);
  const backRef = useRef(onBack);
  backRef.current = onBack;

  const [message, setMessage] = useState("");
  const [itemId, setItemId] = useState(offerItems[0]?.id || "");
  const [memberId, setMemberId] = useState("");

  // 成员列表到达后：默认选中 URL 指定成员或首位
  useEffect(() => {
    if (!members || members.length === 0) return;
    setMemberId((current) => {
      if (current && members.some((m) => m.id === current)) return current;
      const fromUrl = state.selectedMemorialId && members.some((m) => m.id === state.selectedMemorialId)
        ? state.selectedMemorialId
        : null;
      return fromUrl || members[0].id;
    });
  }, [members, state.selectedMemorialId]);

  // 打开面板 → 焦点进入抽屉；回到列表 → 恢复把手焦点。
  // 深链 ?hall=&panel=detail 先于数据到达时 [data-autofocus] 尚不存在：
  // 依赖加 selectedHall（数据落地后身份变化）重试一次；以 panel+hall 键去重，
  // 避免后续数据刷新（合并分页等）反复抢焦点
  const focusedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.panel === "detail" || state.panel === "offer") {
      const key = state.panel === "offer" ? "offer" : `detail:${state.selectedHallId ?? ""}`;
      if (focusedKeyRef.current === key) return;
      const target = rootRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      if (!target) return; // 数据未到，等 selectedHall 变化后重试
      focusedKeyRef.current = key;
      target.focus();
    } else {
      if (prevPanelRef.current && prevPanelRef.current !== "list") {
        handleRef.current?.focus();
      }
      focusedKeyRef.current = null;
    }
    prevPanelRef.current = state.panel;
  }, [state.panel, state.selectedHallId, selectedHall]);

  // Esc 层级回退：供奉 → 详情 → 列表（列表态无操作）
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && state.panel !== "list") backRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state.panel]);

  // 成功送达并返回详情后清空表单（失败分支绝不清空）
  const prevOfferPanelRef = useRef(state.panel);
  useEffect(() => {
    if (prevOfferPanelRef.current === "offer" && state.panel !== "offer" && offerStatus === "success") {
      setMessage("");
      setItemId(offerItems[0]?.id || "");
    }
    prevOfferPanelRef.current = state.panel;
  }, [state.panel, offerStatus, offerItems]);

  // Tab 焦点圈禁在抽屉内（场景层已 inert）
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || state.panel === "list") return;
    const focusables = rootRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea'
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function submitOffer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberId || !itemId || offerStatus === "pending") return;
    onSubmitOffer({ memorialId: memberId, itemId, message });
  }

  // ---- 把手拖拽（Task 9，规格 §3：collapsed/half/full 三档，上拖升档/下拖降档） ----
  // 阈值 32px：小于它视为点按（click 语义不变）；拖拽收尾触发的 click 被吞掉。
  // click 语义：详情/供奉态 = 层级回退 onBack（既有）；列表态 = 收起↔半开切换
  //（back 在列表态是无操作，把手 aria-label「展开」必须兑现）。
  const HANDLE_DRAG_THRESHOLD_PX = 32;
  const handleDragRef = useRef<{ startY: number; from: GardenDrawer } | null>(null);
  const handleDragMovedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const drawerOrder: ReadonlyArray<GardenDrawer> = ["collapsed", "half", "full"];

  function onHandlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!onDrawerChange) return;
    handleDragRef.current = { startY: event.clientY, from: state.drawer };
    handleDragMovedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onHandlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = handleDragRef.current;
    if (drag && Math.abs(drag.startY - event.clientY) > 8) handleDragMovedRef.current = true;
  }

  function onHandlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = handleDragRef.current;
    handleDragRef.current = null;
    suppressClickRef.current = handleDragMovedRef.current;
    handleDragMovedRef.current = false;
    if (!drag || !onDrawerChange) return;
    const dy = drag.startY - event.clientY; // 正值 = 上拖（展开方向）
    const idx = drawerOrder.indexOf(drag.from);
    if (dy > HANDLE_DRAG_THRESHOLD_PX && idx < drawerOrder.length - 1) {
      onDrawerChange(drawerOrder[idx + 1]);
    } else if (dy < -HANDLE_DRAG_THRESHOLD_PX && idx > 0) {
      onDrawerChange(drawerOrder[idx - 1]);
    }
  }

  function onHandleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return; // 拖拽收尾的合成 click 不再触发回退/切换
    }
    if (state.panel === "list" && onDrawerChange) {
      onDrawerChange(state.drawer === "collapsed" ? "half" : "collapsed");
      return;
    }
    onBack();
  }

  const railHalls = matchedHallIds ? halls.filter((hall) => matchedHallIds.has(hall.hallId)) : halls;
  const offerStatusText =
    offerStatus === "pending"
      ? labels.offerSubmitting
      : offerStatus === "success"
        ? labels.offerSuccess
        : offerStatus === "requiresLogin"
          ? labels.offerRequiresLogin
          : offerStatus === "failed"
            ? `${labels.offerFailedPrefix}${offerNotice || ""}${labels.offerRetryLater}`
            : "";

  return (
    <div className="starsea-drawer" data-state={state.drawer} data-panel={state.panel} ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="starsea-handle"
        ref={handleRef}
        aria-label={labels.handleExpand}
        aria-expanded={state.drawer !== "collapsed"}
        onClick={onHandleClick}
        onPointerDown={onDrawerChange ? onHandlePointerDown : undefined}
        onPointerMove={onDrawerChange ? onHandlePointerMove : undefined}
        onPointerUp={onDrawerChange ? onHandlePointerUp : undefined}
        onPointerCancel={onDrawerChange ? onHandlePointerUp : undefined}
      />
      <div className="starsea-drawer-inner">
        {state.panel === "list" && (
          <section className="starsea-list" aria-label={labels.listTitle}>
            <p className="starsea-list-title">{labels.hallCount(railHalls.length)}</p>
            <ul className="starsea-rail">
              {railHalls.map((hall) => (
                <li key={hall.hallId}>
                  <button
                    type="button"
                    className="starsea-card"
                    onClick={() => onSelectHall(hall.hallId)}
                    aria-label={`${hall.nameMasked}，${labels.detailCount(hall.lampCount)}`}
                  >
                    <span className="starsea-card-avatar" aria-hidden="true">
                      {hall.avatarUrl && hall.avatarUrl.startsWith("/") ? (
                        <img src={hall.avatarUrl} alt="" />
                      ) : (
                        hall.avatarUrl || "✦"
                      )}
                    </span>
                    <span className="starsea-card-body">
                      <span className="starsea-card-name">{hall.nameMasked}</span>
                      <span className="starsea-card-meta">
                        {labels.detailCount(hall.lampCount)} · {hallYears(hall)}
                      </span>
                      <span className="starsea-card-epitaph">{hall.epitaph || labels.epitaphEmpty}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {state.panel === "detail" && (
          <section className="starsea-detail" aria-label={selectedHall ? selectedHall.nameMasked : labels.detailLoading}>
            {!selectedHall ? (
              <p className="starsea-detail-loading">{labels.detailLoading}</p>
            ) : (
              <>
                <h2 className="starsea-detail-name" tabIndex={-1} data-autofocus>
                  {selectedHall.nameMasked}
                </h2>
                <p className="starsea-detail-count">{labels.detailCount(selectedHall.lampCount)}</p>
                <p className="starsea-detail-years">{hallYears(selectedHall)}</p>
                <p className="starsea-detail-epitaph">{selectedHall.epitaph || labels.epitaphEmpty}</p>
                <div className="starsea-detail-actions">
                  <a className="starsea-enter" href={`/${lang}/hall/${selectedHall.hallId}`}>
                    {labels.enterHall}
                  </a>
                  <button type="button" className="starsea-offer-open" onClick={onOpenOffer}>
                    {labels.offerCta}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {state.panel === "offer" && (
          <section className="starsea-offer" aria-label={labels.offerTitle}>
            <h2 className="starsea-offer-title" tabIndex={-1} data-autofocus>
              {labels.offerTitle}
            </h2>
            {membersError ? (
              <div className="starsea-offer-error" role="alert">
                <p>{labels.membersError}</p>
                <button type="button" onClick={onRetryMembers}>
                  {labels.membersRetry}
                </button>
              </div>
            ) : !members || membersLoading ? (
              <p className="starsea-detail-loading">{labels.membersLoading}</p>
            ) : (
              <form className="starsea-offer-form" onSubmit={submitOffer}>
                <fieldset>
                  <legend>{labels.offerMemberLabel}</legend>
                  <div className="starsea-offer-members">
                    {members.map((member) => (
                      <label key={member.id} className={memberId === member.id ? "is-selected" : ""}>
                        <input
                          type="radio"
                          name="starsea-offer-member"
                          value={member.id}
                          checked={memberId === member.id}
                          onChange={() => setMemberId(member.id)}
                        />
                        {maskName(member.name)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>{labels.offerItemLabel}</legend>
                  <div className="starsea-offer-items">
                    {offerItems.map((item) => (
                      <label key={item.id} className={itemId === item.id ? "is-selected" : ""}>
                        <input
                          type="radio"
                          name="starsea-offer-item"
                          value={item.id}
                          checked={itemId === item.id}
                          onChange={() => setItemId(item.id)}
                        />
                        <span aria-hidden="true">{item.icon}</span>
                        {itemLabel(item.id)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="starsea-offer-message-label" htmlFor="starsea-offer-message">
                  {labels.offerMessageLabel}
                </label>
                <textarea
                  id="starsea-offer-message"
                  className="starsea-offer-message"
                  maxLength={500}
                  placeholder={labels.offerMessagePlaceholder}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <button type="submit" className="starsea-offer-submit" disabled={offerStatus === "pending"}>
                  {offerStatus === "pending" ? labels.offerSubmitting : labels.offerSubmit}
                </button>
                <p className="starsea-offer-status" role="status">
                  {offerStatus === "requiresLogin" ? (
                    <>
                      {offerStatusText} <a href={`/${lang}/login`}>{labels.loginLink}</a>
                    </>
                  ) : (
                    offerStatusText
                  )}
                </p>
              </form>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
