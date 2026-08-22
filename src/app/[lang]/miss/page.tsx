import MissPageClient from "./MissPageClient";

// Server Component：读取 searchParams 并渲染想念页
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ memorial_id?: string; name?: string; avatar?: string }>;
}) {
  const sp = await searchParams;
  const memorialId = sp.memorial_id ?? "";
  const memorialName = decodeURIComponent(sp.name ?? "TA");
  const avatarUrl = decodeURIComponent(sp.avatar ?? "");

  return (
    <MissPageClient
      memorialId={memorialId}
      memorialName={memorialName}
      avatarUrl={avatarUrl}
    />
  );
}
