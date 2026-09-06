import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SHARED_QUIZ_QUESTION_COUNT,
  SHARED_QUIZ_SECONDS_PER_QUESTION,
  parseSharedQuizPlan,
  type SharedQuizQuestionPlan,
} from "../shared-quiz.ts";
import { isUuid } from "./shared-albums.ts";

export type SharedQuizStatus = "waiting" | "active" | "completed";

export type SharedQuizSession = {
  id: string;
  albumId: string;
  status: SharedQuizStatus;
  questions: SharedQuizQuestionPlan[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type SharedQuizParticipant = {
  userId: string;
  displayName: string;
  joinedAt: string;
  answeredCount: number;
};

export type SharedQuizAnswer = {
  questionIndex: number;
  selectedChoiceId: string | null;
  correct: boolean;
  responseTimeMs: number;
};

export type SharedQuizStanding = {
  rank: number;
  userId: string;
  displayName: string;
  correctCount: number;
  correctTimeMs: number;
};

type QuizRow = {
  id: string;
  album_id: string;
  status: string;
  questions: unknown;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function requireUuid(value: unknown, label: string) {
  if (!isUuid(value)) throw new Error(`${label}が正しくありません。`);
  return value;
}

function messageOf(error: unknown) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : "";
}

function quizError(error: unknown, fallback: string) {
  const message = messageOf(error);
  if (message.includes("shared quiz has already started")) return "このクイズはすでに始まっています。次の回をお待ちください。";
  if (message.includes("shared quiz is not waiting")) return "このクイズはすでに開始または終了しています。";
  if (message.includes("shared quiz participant not found")) return "先にクイズへ参加してください。";
  if (message.includes("shared quiz has not finished")) return "クイズはまだ終了していません。";
  if (message.includes("shared album membership not found")) return "このグループのメンバーではありません。";
  if (message.includes("shared quiz not found")) return "クイズが見つからないか、参加する権限がありません。";
  if (message.includes("shared quiz questions are invalid")) return "問題を作成できませんでした。共有された思い出を確認してください。";
  return fallback;
}

function toSession(row: QuizRow): SharedQuizSession | null {
  if (!isUuid(row.id) || !isUuid(row.album_id) || !["waiting", "active", "completed"].includes(row.status)) return null;
  return {
    id: row.id,
    albumId: row.album_id,
    status: row.status as SharedQuizStatus,
    questions: parseSharedQuizPlan(row.questions),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export async function joinSharedQuiz(client: SupabaseClient, albumId: string) {
  const { data, error } = await client.rpc("join_shared_quiz", {
    target_album_id: requireUuid(albumId, "グループ"),
  });
  if (error) throw new Error(quizError(error, "クイズに参加できませんでした。"));
  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
  if (!row || !isUuid(row.quiz_id) || (row.quiz_status !== "waiting" && row.quiz_status !== "active")) {
    throw new Error("クイズに参加できませんでした。");
  }
  return { id: row.quiz_id, status: row.quiz_status as Extract<SharedQuizStatus, "waiting" | "active"> };
}

export async function startSharedQuiz(
  client: SupabaseClient,
  sessionId: string,
  questions: SharedQuizQuestionPlan[],
) {
  if (questions.length !== SHARED_QUIZ_QUESTION_COUNT) throw new Error("10問を作成できる思い出がありません。");
  const { data, error } = await client.rpc("start_shared_quiz", {
    target_quiz_id: requireUuid(sessionId, "クイズ"),
    quiz_questions: questions,
  });
  if (error) throw new Error(quizError(error, "クイズを開始できませんでした。"));
  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
  if (!row || row.quiz_status !== "active" || typeof row.started_at !== "string") {
    throw new Error("クイズを開始できませんでした。");
  }
  return { status: "active" as const, startedAt: row.started_at };
}

async function selectSharedQuiz(client: SupabaseClient, sessionId: string) {
  const { data, error } = await client.from("shared_quizzes")
    .select("id, album_id, status, questions, started_at, completed_at, created_at")
    .eq("id", requireUuid(sessionId, "クイズ"))
    .maybeSingle();
  if (error) throw new Error(quizError(error, "クイズを読み込めませんでした。"));
  return data ? toSession(data as QuizRow) : null;
}

export async function getSharedQuizSession(client: SupabaseClient, sessionId: string) {
  let session = await selectSharedQuiz(client, sessionId);
  if (
    session?.status === "active"
    && session.startedAt
    && Date.now() >= new Date(session.startedAt).getTime() + SHARED_QUIZ_QUESTION_COUNT * SHARED_QUIZ_SECONDS_PER_QUESTION * 1000
  ) {
    const { error } = await client.rpc("finalize_shared_quiz", { target_quiz_id: session.id });
    if (!error) session = await selectSharedQuiz(client, session.id);
  }
  return session;
}

export async function listSharedQuizParticipants(client: SupabaseClient, sessionId: string) {
  const { data, error } = await client.rpc("list_shared_quiz_participants", {
    target_quiz_id: requireUuid(sessionId, "クイズ"),
  });
  if (error) throw new Error(quizError(error, "参加者を読み込めませんでした。"));
  return (Array.isArray(data) ? data : []).flatMap((raw): SharedQuizParticipant[] => {
    const row = raw as Record<string, unknown>;
    if (typeof row.user_id !== "string" || typeof row.display_name !== "string" || typeof row.joined_at !== "string") return [];
    return [{
      userId: row.user_id,
      displayName: row.display_name,
      joinedAt: row.joined_at,
      answeredCount: Number(row.answered_count) || 0,
    }];
  });
}

export async function loadOwnSharedQuizAnswers(
  client: SupabaseClient,
  sessionId: string,
  userId: string,
) {
  const { data, error } = await client.from("shared_quiz_answers")
    .select("question_index, selected_choice_id, is_correct, response_time_ms")
    .eq("quiz_id", requireUuid(sessionId, "クイズ"))
    .eq("user_id", requireUuid(userId, "ユーザー"))
    .order("question_index", { ascending: true });
  if (error) throw new Error(quizError(error, "回答を読み込めませんでした。"));
  return (Array.isArray(data) ? data : []).flatMap((raw): SharedQuizAnswer[] => {
    const row = raw as Record<string, unknown>;
    const questionIndex = Number(row.question_index);
    const responseTimeMs = Number(row.response_time_ms);
    if (!Number.isInteger(questionIndex) || typeof row.is_correct !== "boolean" || !Number.isFinite(responseTimeMs)) return [];
    return [{
      questionIndex,
      selectedChoiceId: typeof row.selected_choice_id === "string" ? row.selected_choice_id : null,
      correct: row.is_correct,
      responseTimeMs,
    }];
  });
}

export async function submitSharedQuizAnswer(
  client: SupabaseClient,
  sessionId: string,
  questionIndex: number,
  selectedChoiceId: string,
) {
  const { data, error } = await client.rpc("submit_shared_quiz_answer", {
    target_quiz_id: requireUuid(sessionId, "クイズ"),
    target_question_index: questionIndex,
    target_selected_choice_id: requireUuid(selectedChoiceId, "回答"),
  });
  if (error) throw new Error(quizError(error, "回答を送信できませんでした。"));
  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
  if (!row || typeof row.is_correct !== "boolean") throw new Error("回答を送信できませんでした。");
  return {
    questionIndex: Number(row.question_index),
    selectedChoiceId: typeof row.selected_choice_id === "string" ? row.selected_choice_id : selectedChoiceId,
    correct: row.is_correct,
    responseTimeMs: Number(row.response_time_ms) || 0,
  } satisfies SharedQuizAnswer;
}

export async function finalizeSharedQuiz(client: SupabaseClient, sessionId: string) {
  const { data, error } = await client.rpc("finalize_shared_quiz", {
    target_quiz_id: requireUuid(sessionId, "クイズ"),
  });
  if (error) throw new Error(quizError(error, "結果を集計できませんでした。"));
  return data === "completed";
}

export async function listSharedQuizStandings(client: SupabaseClient, sessionId: string) {
  const { data, error } = await client.rpc("list_shared_quiz_standings", {
    target_quiz_id: requireUuid(sessionId, "クイズ"),
  });
  if (error) throw new Error(quizError(error, "順位を読み込めませんでした。"));
  return (Array.isArray(data) ? data : []).flatMap((raw): SharedQuizStanding[] => {
    const row = raw as Record<string, unknown>;
    if (typeof row.user_id !== "string" || typeof row.display_name !== "string") return [];
    return [{
      rank: Number(row.rank) || 0,
      userId: row.user_id,
      displayName: row.display_name,
      correctCount: Number(row.correct_count) || 0,
      correctTimeMs: Number(row.correct_time_ms) || 0,
    }];
  });
}
