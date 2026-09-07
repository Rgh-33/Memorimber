import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SharedMemoryDetail } from "@/components/shared-memory-detail";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSharedAlbum, isUuid } from "@/lib/supabase/shared-albums";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ groupId: string; memoryId: string }> };

export default async function SharedMemoryDetailPage({ params }: PageProps) {
  const { groupId, memoryId } = await params;
  if (!isUuid(groupId) || !isUuid(memoryId)) notFound();
  if (!isSupabaseConfigured()) {
    return <div className="page-pad"><AppHeader /><p role="alert" className="auth-notice auth-notice--info mt-8">Supabaseの接続情報が設定されていません。</p></div>;
  }

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/login?${new URLSearchParams({ next: `/shared-groups/${groupId}/memories/${memoryId}` })}`);

  const album = await getSharedAlbum(client, groupId);
  if (!album) notFound();
  return <SharedMemoryDetail album={album} memoryId={memoryId} />;
}
