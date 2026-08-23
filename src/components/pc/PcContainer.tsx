/**
 * PC 限宽容器：max-width 1120px 居中（01-PC前端设计文档 §3.2）。
 * 服务端/客户端组件均可使用。M3 各页面改造时逐页接入。
 */
export default function PcContainer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`pc-container ${className}`.trim()}>{children}</div>;
}
