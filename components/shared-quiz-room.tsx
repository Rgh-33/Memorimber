"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, Clock3, LoaderCircle, Medal, Trophy, UserRound, UsersRound } from "lucide-react";
import { joinSharedQuizAction, startSharedQuizAction } from "@/app/shared-groups/actions";
import { QuizQuestionCard } from "@/components/quiz-question-card";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import {
  SHARED_QUIZ_QUESTION_COUNT,
  SHARED_QUIZ_SECONDS_PER_QUESTION,
  formatSharedQuizTime,
  getSharedQuizTiming,
} from "@/lib/shared-quiz";
import { createClient } from "@/lib/supabase/client";
import {
  finalizeSharedQuiz,
  submitSharedQuizAnswer,
  type SharedQuizAnswer,
  type SharedQuizParticipant,
  type SharedQuizSession,
  type SharedQuizStanding,
} from "@/lib/supabase/shared-quiz";
import type { MemoryQuizQuestion } from "@/lib/quiz";

type Props = {
  groupId: string;
  groupName: string;
  userId: string;
  session: SharedQuizSession;
  participants: SharedQuizParticipant[];
  questions: MemoryQuizQuestion[];
  initialAnswers: SharedQuizAnswer[];
  standings: SharedQuizStanding[];
  serverNow: number;
  actionError?: string | null;
};

function ParticipantList({ participants, userId }: { participants: SharedQuizParticipant[]; userId: string }) {
  return (
    <ul className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper">
      {participants.map((participant, index) => (
        <li key={participant.userId} className={`flex items-center gap-3 px-4 py-3.5 ${index ? "border-t border-line" : ""}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral/10 text-coral"><UserRound size={17} /></span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {participant.displayName}{participant.userId === userId ? "（あなた）" : ""}
          </span>
          <Check size={16} className="text-coral" aria-label="参加済み" />
        </li>
      ))}
    </ul>
  );
}

function QuizLobby({ groupId, userId, session, participants, actionError }: Pick<Props, "groupId" | "userId" | "session" | "participants" | "actionError">) {
  const joined = participants.some((participant) => participant.userId === userId);
  return (
    <section className="shared-quiz-lobby" aria-labelledby="shared-quiz-lobby-title">
      <div className="shared-quiz-lobby-mark" aria-hidden="true"><UsersRound size={28} /></div>
      <p className="shared-quiz-eyebrow">WAITING ROOM</p>
      <h1 id="shared-quiz-lobby-title">クイズの待機ルーム</h1>
      <p className="shared-quiz-lead">参加者がそろったら始めよう。あなた1人でも開始できます。</p>

      {actionError ? <p role="alert" className="auth-notice auth-notice--error mt-5">{actionError}</p> : null}

      <div className="mt-7 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">参加中</h2>
        <span className="rounded-full bg-coral/10 px-3 py-1 text-xs font-semibold text-coral">{participants.length}人</span>
      </div>
      <ParticipantList participants={participants} userId={userId} />

      {joined ? (
        <form action={startSharedQuizAction} className="mt-6">
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="sessionId" value={session.id} />
          <SharedGroupSubmitButton pendingLabel="問題を準備中…" className="min-h-12 w-full text-sm">クイズを開始</SharedGroupSubmitButton>
        </form>
      ) : (
        <form action={joinSharedQuizAction} className="mt-6">
          <input type="hidden" name="groupId" value={groupId} />
          <SharedGroupSubmitButton pendingLabel="参加中…" className="min-h-12 w-full text-sm">このクイズに参加</SharedGroupSubmitButton>
        </form>
      )}
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-ink/45"><LoaderCircle size={12} className="animate-spin" />参加状況を更新しています</p>
    </section>
  );
}

function QuizCountdown({ countdown, participants }: { countdown: number; participants: SharedQuizParticipant[] }) {
  return (
    <section className="shared-quiz-countdown" aria-live="assertive">
      <div className="shared-quiz-countdown-number" key={countdown}>{countdown}</div>
      <h1>まもなくスタート</h1>
      <p>{participants.length}人で10問に挑戦します</p>
    </section>
  );
}

function SharedQuizResults({ groupId, userId, standings }: Pick<Props, "groupId" | "userId" | "standings">) {
  const ownStanding = standings.find((standing) => standing.userId === userId);
  return (
    <section className="shared-quiz-results" aria-labelledby="shared-quiz-results-title">
      <div className="shared-quiz-trophy" aria-hidden="true"><Trophy size={34} /></div>
      <p className="shared-quiz-eyebrow">FINAL RESULT</p>
      <h1 id="shared-quiz-results-title">最終順位</h1>
      {ownStanding ? <p className="shared-quiz-own-result">あなたは <strong>{ownStanding.rank}位</strong> · {ownStanding.correctCount}/10問正解</p> : null}

      <ol className="shared-quiz-ranking">
        {standings.map((standing) => (
          <li key={standing.userId} data-current={standing.userId === userId || undefined}>
            <span className="shared-quiz-rank" data-rank={standing.rank <= 3 ? standing.rank : undefined}>
              {standing.rank <= 3 ? <Medal size={19} /> : null}<strong>{standing.rank}</strong>
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm text-ink">{standing.displayName}{standing.userId === userId ? "（あなた）" : ""}</strong>
              <small className="mt-0.5 block text-[10px] text-ink/45">正解までの合計 {formatSharedQuizTime(standing.correctTimeMs)}</small>
            </span>
            <span className="text-right"><strong className="text-lg text-coral">{standing.correctCount}</strong><small className="text-[10px] text-ink/40"> / 10</small></span>
          </li>
        ))}
      </ol>

      <div className="mt-5 rounded-xl bg-ivory px-4 py-3 text-[10px] leading-5 text-ink/50">
        正答数が多い順。同じ正答数なら正解した問題の回答時間合計、さらに同じなら参加順で順位を決めます。
      </div>
      <form action={joinSharedQuizAction} className="mt-5">
        <input type="hidden" name="groupId" value={groupId} />
        <SharedGroupSubmitButton pendingLabel="待機ルームへ移動中…" className="min-h-12 w-full text-sm">もう一度参加</SharedGroupSubmitButton>
      </form>
      <Link href={`/shared-groups/${groupId}`} className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-line bg-paper text-xs font-semibold text-ink">グループに戻る</Link>
    </section>
  );
}

export function SharedQuizRoom(props: Props) {
  const { groupId, groupName, userId, session, participants, questions, initialAnswers, standings, serverNow, actionError } = props;
  const router = useRouter();
  const [now, setNow] = useState(serverNow);
  const [answers, setAnswers] = useState(initialAnswers);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const clockOffset = useRef(serverNow - Date.now());
  const submitting = useRef(new Set<number>());
  const finalizing = useRef(false);

  useEffect(() => {
    if (session.status !== "waiting") return;
    const interval = window.setInterval(() => router.refresh(), 1500);
    return () => window.clearInterval(interval);
  }, [router, session.status]);

  useEffect(() => {
    if (session.status !== "active") return;
    const tick = () => setNow(Date.now() + clockOffset.current);
    tick();
    const interval = window.setInterval(tick, 50);
    return () => window.clearInterval(interval);
  }, [session.status]);

  const timing = session.startedAt ? getSharedQuizTiming(session.startedAt, now) : null;
  const answerByIndex = useMemo(() => new Map(answers.map((answer) => [answer.questionIndex, answer])), [answers]);

  const selectAnswer = useCallback(async (questionIndex: number, choiceId: string) => {
    if (submitting.current.has(questionIndex) || answerByIndex.has(questionIndex)) return;
    submitting.current.add(questionIndex);
    setDrafts((current) => ({ ...current, [questionIndex]: choiceId }));
    setSubmitError(null);
    try {
      const answer = await submitSharedQuizAnswer(createClient(), session.id, questionIndex, choiceId);
      setAnswers((current) => [...current.filter((item) => item.questionIndex !== questionIndex), answer]);
    } catch (error) {
      setDrafts((current) => {
        const next = { ...current };
        delete next[questionIndex];
        return next;
      });
      setSubmitError(error instanceof Error ? error.message : "回答を送信できませんでした。");
    } finally {
      submitting.current.delete(questionIndex);
    }
  }, [answerByIndex, session.id]);

  useEffect(() => {
    if (session.status !== "active" || timing?.phase !== "finished" || finalizing.current) return;
    finalizing.current = true;
    let cancelled = false;
    let retryTimer: number | undefined;
    let attempts = 0;
    const finalize = async () => {
      attempts += 1;
      try {
        await finalizeSharedQuiz(createClient(), session.id);
        if (!cancelled) router.refresh();
      } catch (error) {
        if (cancelled) return;
        if (attempts < 4) {
          retryTimer = window.setTimeout(() => void finalize(), 750);
          return;
        }
        finalizing.current = false;
        setSubmitError(error instanceof Error ? error.message : "結果を集計できませんでした。");
      }
    };
    // Leave a short drain window for an answer sent at the end of question 10.
    retryTimer = window.setTimeout(() => void finalize(), 900);
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [router, session.id, session.status, timing?.phase]);

  if (session.status === "waiting") {
    return <QuizLobby groupId={groupId} userId={userId} session={session} participants={participants} actionError={actionError} />;
  }

  if (session.status === "completed") {
    return <SharedQuizResults groupId={groupId} userId={userId} standings={standings} />;
  }

  if (!timing || timing.phase === "finished") {
    return (
      <section className="shared-quiz-countdown" aria-live="polite">
        <LoaderCircle size={34} className="animate-spin text-coral" />
        <h1>結果を集計中</h1>
        <p>{submitError ?? "順位を計算しています…"}</p>
      </section>
    );
  }

  if (timing.phase === "countdown") return <QuizCountdown countdown={timing.countdown} participants={participants} />;

  const question = questions[timing.questionIndex];
  if (!question) {
    return <p role="alert" className="auth-notice auth-notice--error mt-8">問題を表示できませんでした。グループへ戻ってもう一度お試しください。</p>;
  }
  const savedAnswer = answerByIndex.get(timing.questionIndex);
  const selectedChoiceId = savedAnswer?.selectedChoiceId ?? drafts[timing.questionIndex] ?? null;
  const answered = Boolean(savedAnswer || drafts[timing.questionIndex]);
  const progress = Math.max(0, Math.min(100, timing.remainingMs / (SHARED_QUIZ_SECONDS_PER_QUESTION * 1000) * 100));

  return (
    <section className="shared-quiz-playing" aria-labelledby="shared-quiz-playing-title">
      <header className="shared-quiz-playing-header">
        <div>
          <p className="shared-quiz-eyebrow">{groupName}</p>
          <h1 id="shared-quiz-playing-title">みんなでクイズ</h1>
        </div>
        <span className="shared-quiz-player-count"><UsersRound size={14} />{participants.length}</span>
      </header>

      <div className="shared-quiz-progress-copy">
        <span>QUESTION <strong>{timing.questionIndex + 1}</strong> / {SHARED_QUIZ_QUESTION_COUNT}</span>
        <span className="shared-quiz-timer"><Clock3 size={14} /><strong>{Math.max(0, Math.ceil(timing.remainingMs / 1000))}</strong>秒</span>
      </div>
      <div className="shared-quiz-timer-track" aria-label={`残り${Math.max(0, Math.ceil(timing.remainingMs / 1000))}秒`}>
        <span style={{ "--shared-quiz-progress": `${progress}%` } as CSSProperties} />
      </div>

      {submitError ? <p role="alert" className="auth-notice auth-notice--error mt-4">{submitError}</p> : null}
      <div className="mt-5">
        <QuizQuestionCard
          question={question}
          selectedChoiceId={selectedChoiceId}
          answered={answered}
          onSelect={(choiceId) => void selectAnswer(timing.questionIndex, choiceId)}
        />
      </div>
      {!answered ? <p className="mt-3 text-center text-[10px] text-ink/45">時間切れになると自動で次の問題へ進みます</p> : null}
    </section>
  );
}
