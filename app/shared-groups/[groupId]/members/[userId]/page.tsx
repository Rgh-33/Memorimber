import { notFound, redirect } from "next/navigation";
import { AppBackLink } from "@/components/app-back-link";
import { AppHeader } from "@/components/app-header";
import { SharedMemberProfile } from "@/components/shared-member-profile";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSharedAlbum, isUuid, listSharedAlbumMembers } from "@/lib/supabase/shared-albums";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ groupId: string; userId: string }> };

export default async function SharedMemberProfilePage({ params }: PageProps) {
  const { groupId, userId } = await params;
  if (!isUuid(groupId) || !isUuid(userId)) notFound();
  if (!isSupabaseConfigured()) {
    return <div className="page-pad"><AppHeader /><p role="alert" className="auth-notice auth-notice--info mt-8">Supabaseの接続情報が設定されていません。</p></div>;
  }

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/login?${new URLSearchParams({ next: `/shared-groups/${groupId}/members/${userId}` })}`);

  const [album, members] = await Promise.all([
    getSharedAlbum(client, groupId),
    listSharedAlbumMembers(client, groupId),
  ]);
  if (!album) notFound();
  const member = members.find((candidate) => candidate.userId === userId);
  if (!member) notFound();

  return (
    <div className="page-pad">
      <AppHeader />
      <AppBackLink href={`/shared-groups/${groupId}`} label={`${album.name}へ戻る`} />
      <SharedMemberProfile member={member} currentUserId={user.id} />
    </div>
  );
}
