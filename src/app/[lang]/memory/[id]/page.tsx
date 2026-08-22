import MemoryPageClient from "./MemoryPageClient";

// Server Component：读取 searchParams 并渲染记忆档案页
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ memorial_id?: string; name?: string }>;
}) {
  const sp = await searchParams;
  const memorialId = sp.memorial_id ?? "";
  const memorialName = decodeURIComponent(sp.name ?? "TA");

  return <MemoryPageClient memorialId={memorialId} memorialName={memorialName} />;
}
