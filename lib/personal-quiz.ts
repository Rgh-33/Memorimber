"use client";
import { createClient } from "@/lib/supabase/client";
import type { MemoryQuizQuestion, QuizHistoryEntry } from "@/lib/quiz";
import { getMemoryDisplayUrl, type Memory } from "@/lib/types";
export type SavedQuestion = MemoryQuizQuestion & { sessionId: string; correct?: boolean; selectedChoiceId?: string };
function hydrate(question: SavedQuestion, memories: Memory[]): SavedQuestion {
  const byId = new Map(memories.map((memory) => [memory.id, memory]));
  const memory = byId.get(question.memoryId);
  return {
    ...question,
    memory: { ...question.memory, imageUrl: memory?.imageUrl ?? "", thumbnailUrl: memory?.thumbnailUrl },
    choices: question.choices.map((choice) => question.kind === "caption-to-photo" ? { ...choice, imageUrl: byId.has(choice.id) ? getMemoryDisplayUrl(byId.get(choice.id)!) : "" } : choice),
  };
}
export async function startPersonalQuiz(mode: string, count: number, memories: Memory[], memoryId?: string, photoCount?: number) {
  const { data, error } = await createClient().rpc("start_personal_quiz", { p_mode: mode, p_count: count, p_memory: memoryId ?? null, p_photo_count: photoCount ?? null });
  if (error) throw new Error("クイズを開始できませんでした。通信状態を確認してください。");
  window.dispatchEvent(new Event("memorimber:profile-invalidated"));
  return (data.questions as SavedQuestion[]).map((question) => hydrate(question, memories));
}
export async function answerPersonalQuiz(questionId: string, choiceId: string, memories: Memory[]) {
  const { data, error } = await createClient().rpc("answer_personal_quiz", { p_question: questionId, p_choice: choiceId });
  if (error) throw new Error("回答を保存できませんでした。もう一度お試しください。");
  window.dispatchEvent(new Event("memorimber:profile-invalidated"));
  return hydrate(data as SavedQuestion, memories);
}
export async function nextPersonalQuestion(sessionId: string, memories: Memory[]) {
  const { data, error } = await createClient().rpc("next_personal_quiz_question", { p_session: sessionId });
  if (error) throw new Error("問題を読み込めませんでした。もう一度お試しください。");
  return hydrate(data as SavedQuestion, memories);
}
export async function restorePetal(questionId: string) {
  const { error } = await createClient().rpc("restore_memory_petal", { p_question: questionId });
  if (error) throw new Error("花びらを戻せませんでした。もう一度お試しください。");
  window.dispatchEvent(new Event("memorimber:profile-invalidated"));
}
export async function loadPersonalQuizHistory(): Promise<QuizHistoryEntry[]> {
  const { data, error } = await createClient().rpc("get_personal_quiz_history");
  if (error) throw new Error("成績を読み込めませんでした。もう一度お試しください。");
  return data as QuizHistoryEntry[];
}
