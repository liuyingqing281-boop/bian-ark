"use client";

import PcSideNav from "./PcSideNav";
import PcChatPanel from "./PcChatPanel";

/**
 * PC 壳层（M2）：左导航 224px + 主区让位 + 对话侧板/竖条。
 * 布局可见性由 globals.css 纯媒体查询驱动（≥768px 生效，≤1024px 导航收 64px），
 * 不依赖 JS 水合；本组件仅负责挂载导航与侧板的交互逻辑。
 * 对话对象由当前页面 RegisterPcChat 注册（见 PcChatPanel）。
 */
export default function PcShell({
  lang,
  user,
}: {
  lang: string;
  user: boolean;
}) {
  return (
    <>
      <PcSideNav lang={lang} user={user} />
      <PcChatPanel lang={lang} />
    </>
  );
}
