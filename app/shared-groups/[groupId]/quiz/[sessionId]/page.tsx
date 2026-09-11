import { notFound, redirect } from "next/navigation";
import { AppBackLink } from "@/components/app-back-link";
import { AppHeader } from "@/components/app-header";
import { SharedQuizRoomData } from "@/components/shared-quiz-room-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSharedAlbum, isUuid } from "@/lib/supabase/shared-albums";
import {
  getSharedQuizSession,
  listSharedQuizParticipants,
  listSharedQuizStandings,
  loadOwnSharedQuizAnswers,
} from "@/lib/supabase/shared-quiz";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ groupId: string; sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SharedQuizPage({ params, searchParams }: PageProps) {
  const [{ groupId, sessionId }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(groupId) || !isUuid(sessionId)) notFound();
  const actionError = typeof query.error === "string" ? query.error : null;

  if (!isSupabaseConfigured()) {
    return <div className="page-pad"><AppHeader /><p role="alert" className="auth-notice auth-notice--info mt-8">Supabaseの接続情報が設定されていません。</p></div>;
  }

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/login?${new URLSearchParams({ next: `/shared-groups/${groupId}/quiz/${sessionId}` })}`);

  let album;
  let session;
  try {
    [album, session] = await Promise.all([
      getSharedAlbum(client, groupId),
      getSharedQuizSession(client, sessionId),
    ]);
  } catch (error) {
    return (
      <div className="page-pad shared-quiz-page">
        <AppHeader />
        <AppBackLink href={`/shared-groups/${groupId}`} label="グループへ戻る" />
        <p role="alert" className="auth-notice auth-notice--error mt-7">{error instanceof Error ? error.message : "クイズを読み込めませんでした。"}</p>
      </div>
    );
  }
  if (!album || !session || session.albumId !== groupId) notFound();

  try {
    const participantsPromise = listSharedQuizParticipants(client, sessionId);
    const answersPromise = session.status === "active"
      ? loadOwnSharedQuizAnswers(client, sessionId, user.id)
      : Promise.resolve([]);
    const standingsPromise = session.status === "completed"
      ? listSharedQuizStandings(client, sessionId)
      : Promise.resolve([]);
    const [participants, initialAnswers, standings] = await Promise.all([
      participantsPromise,
      answersPromise,
      standingsPromise,
    ]);
    return (
      <div className="page-pad shared-quiz-page">
        <AppHeader />
        <AppBackLink href={`/shared-groups/${groupId}`} label={`${album.name}へ戻る`} />
          <SharedQuizRoomData
            groupId={groupId}
            groupName={album.name}
            userId={user.id}
            session={session}
            participants={participants}
            questions={[]}
            initialAnswers={initialAnswers}
            standings={standings}
            serverNow={Date.now()}
            actionError={actionError}
            isOwner={album.ownerId === user.id}
          />
      </div>
    );
  } catch (error) {
    return (
      <div className="page-pad shared-quiz-page">
        <AppHeader />
        <AppBackLink href={`/shared-groups/${groupId}`} label={`${album.name}へ戻る`} />
        <p role="alert" className="auth-notice auth-notice--error mt-7">{error instanceof Error ? error.message : "クイズを読み込めませんでした。"}</p>
      </div>
    );
  }
}
