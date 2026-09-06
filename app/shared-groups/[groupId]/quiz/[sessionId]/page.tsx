import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SharedQuizRoom } from "@/components/shared-quiz-room";
import { hydrateSharedQuizQuestions, SHARED_QUIZ_QUESTION_COUNT } from "@/lib/shared-quiz";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSharedAlbum, isUuid, loadSharedAlbumMemories } from "@/lib/supabase/shared-albums";
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
        <Link href={`/shared-groups/${groupId}`} className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-ink/55 hover:text-coral"><ArrowLeft size={15} />グループへ戻る</Link>
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
    const memoriesPromise = session.status === "active"
      ? loadSharedAlbumMemories(client, groupId)
      : Promise.resolve([]);
    const standingsPromise = session.status === "completed"
      ? listSharedQuizStandings(client, sessionId)
      : Promise.resolve([]);
    const [participants, initialAnswers, memories, standings] = await Promise.all([
      participantsPromise,
      answersPromise,
      memoriesPromise,
      standingsPromise,
    ]);
    const questions = session.status === "active"
      ? hydrateSharedQuizQuestions(session.questions, memories)
      : [];
    const questionError = session.status === "active" && questions.length !== SHARED_QUIZ_QUESTION_COUNT
      ? "問題の写真を読み込めませんでした。通信状態を確認して再読み込みしてください。"
      : null;

    return (
      <div className="page-pad shared-quiz-page">
        <AppHeader />
        <Link href={`/shared-groups/${groupId}`} className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-ink/55 hover:text-coral"><ArrowLeft size={15} />{album.name}へ戻る</Link>
        {questionError ? <p role="alert" className="auth-notice auth-notice--error mt-7">{questionError}</p> : (
          <SharedQuizRoom
            groupId={groupId}
            groupName={album.name}
            userId={user.id}
            session={session}
            participants={participants}
            questions={questions}
            initialAnswers={initialAnswers}
            standings={standings}
            serverNow={Date.now()}
            actionError={actionError}
          />
        )}
      </div>
    );
  } catch (error) {
    return (
      <div className="page-pad shared-quiz-page">
        <AppHeader />
        <Link href={`/shared-groups/${groupId}`} className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-ink/55 hover:text-coral"><ArrowLeft size={15} />{album.name}へ戻る</Link>
        <p role="alert" className="auth-notice auth-notice--error mt-7">{error instanceof Error ? error.message : "クイズを読み込めませんでした。"}</p>
      </div>
    );
  }
}
