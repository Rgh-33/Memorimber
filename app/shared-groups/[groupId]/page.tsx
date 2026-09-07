import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SharedGroupDetail } from "@/components/shared-group-detail";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSharedAlbum, isUuid } from "@/lib/supabase/shared-albums";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SharedGroupDetailPage({ params, searchParams }: PageProps) {
  const [{ groupId }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(groupId)) notFound();
  const success = typeof query.success === "string" ? query.success : null;
  const actionError = typeof query.error === "string" ? query.error : null;
  if (!isSupabaseConfigured()) {
    return (
      <div className="page-pad"><AppHeader /><p role="alert" className="auth-notice auth-notice--info mt-8">Supabaseの接続情報が設定されていません。</p></div>
    );
  }

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/login?${new URLSearchParams({ next: `/shared-groups/${groupId}` })}`);

  let album;
  try {
    album = await getSharedAlbum(client, groupId);
  } catch (error) {
    return (
      <div className="page-pad"><AppHeader /><p role="alert" className="auth-notice auth-notice--error mt-8">{error instanceof Error ? error.message : "グループを読み込めませんでした。"}</p></div>
    );
  }
  if (!album) notFound();

  return <SharedGroupDetail initialAlbum={album} userId={user.id} success={success} actionError={actionError} />;
}
