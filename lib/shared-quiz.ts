import {
  createMixedQuizQuestions,
  type MemoryQuizQuestion,
  type QuizKind,
} from "./quiz.ts";
import { getMemoryDisplayUrl, type Memory } from "./types.ts";

export const SHARED_QUIZ_QUESTION_COUNT = 10;
export const SHARED_QUIZ_DIRECTION_COUNT = 5;
export const SHARED_QUIZ_SECONDS_PER_QUESTION = 5;
export const SHARED_QUIZ_START_DELAY_SECONDS = 5;

export type SharedQuizKind = Extract<QuizKind, "photo-to-caption" | "caption-to-photo">;

export type SharedQuizQuestionPlan = {
  memoryId: string;
  kind: SharedQuizKind;
  choiceIds: string[];
};

export type SharedQuizTiming =
  | { phase: "countdown"; countdown: number; questionIndex: 0; remainingMs: number }
  | { phase: "question"; countdown: 0; questionIndex: number; remainingMs: number }
  | { phase: "finished"; countdown: 0; questionIndex: number; remainingMs: 0 };

function isSharedQuizKind(value: unknown): value is SharedQuizKind {
  return value === "photo-to-caption" || value === "caption-to-photo";
}

export function createSharedQuizPlan(
  memories: Memory[],
  random: () => number = Math.random,
): SharedQuizQuestionPlan[] {
  return createMixedQuizQuestions(
    memories,
    SHARED_QUIZ_DIRECTION_COUNT,
    SHARED_QUIZ_DIRECTION_COUNT,
    random,
  ).map((question) => ({
    memoryId: question.memoryId,
    kind: question.kind as SharedQuizKind,
    choiceIds: question.choices.map((choice) => choice.id),
  }));
}

export function parseSharedQuizPlan(value: unknown): SharedQuizQuestionPlan[] {
  if (!Array.isArray(value) || value.length !== SHARED_QUIZ_QUESTION_COUNT) return [];
  const plans = value.flatMap((item): SharedQuizQuestionPlan[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.memoryId !== "string" || !isSharedQuizKind(record.kind) || !Array.isArray(record.choiceIds)) return [];
    const choiceIds = record.choiceIds.filter((choice): choice is string => typeof choice === "string");
    if (
      choiceIds.length !== record.choiceIds.length
      || choiceIds.length === 0
      || choiceIds.length > 3
      || new Set(choiceIds).size !== choiceIds.length
      || !choiceIds.includes(record.memoryId)
    ) return [];
    return [{ memoryId: record.memoryId, kind: record.kind, choiceIds }];
  });
  if (plans.length !== SHARED_QUIZ_QUESTION_COUNT) return [];
  const photoToCaptionCount = plans.filter((plan) => plan.kind === "photo-to-caption").length;
  return photoToCaptionCount === SHARED_QUIZ_DIRECTION_COUNT ? plans : [];
}

export function hydrateSharedQuizQuestions(
  plans: SharedQuizQuestionPlan[],
  memories: Memory[],
): MemoryQuizQuestion[] {
  const memoryById = new Map(memories.map((memory) => [memory.id, memory]));
  return plans.flatMap((plan, index): MemoryQuizQuestion[] => {
    const memory = memoryById.get(plan.memoryId);
    const choices = plan.choiceIds.map((id) => memoryById.get(id)).filter((item): item is Memory => Boolean(item));
    if (!memory || choices.length !== plan.choiceIds.length || !getMemoryDisplayUrl(memory) || !memory.caption.trim()) return [];

    if (plan.kind === "photo-to-caption") {
      return [{
        id: `shared-${index}-${memory.id}`,
        memoryId: memory.id,
        kind: plan.kind,
        prompt: "この写真に添えた一言は？",
        choices: choices.map((choice) => ({ id: choice.id, label: choice.caption })),
        correctChoiceId: memory.id,
        correctLabel: memory.caption,
        memory,
      }];
    }

    if (choices.some((choice) => !getMemoryDisplayUrl(choice))) return [];
    return [{
      id: `shared-${index}-${memory.id}`,
      memoryId: memory.id,
      kind: plan.kind,
      prompt: `「${memory.caption}」の写真はどれ？`,
      choices: choices.map((choice) => ({ id: choice.id, imageUrl: getMemoryDisplayUrl(choice) })),
      correctChoiceId: memory.id,
      correctLabel: "この思い出の写真",
      memory,
    }];
  });
}

export function getSharedQuizTiming(startedAt: string | number | Date, now = Date.now()): SharedQuizTiming {
  const startsAt = new Date(startedAt).getTime();
  const elapsed = now - startsAt;
  const questionDurationMs = SHARED_QUIZ_SECONDS_PER_QUESTION * 1000;
  if (elapsed < 0) {
    return {
      phase: "countdown",
      countdown: Math.max(1, Math.ceil(-elapsed / 1000)),
      questionIndex: 0,
      remainingMs: -elapsed,
    };
  }

  const questionIndex = Math.floor(elapsed / questionDurationMs);
  if (questionIndex >= SHARED_QUIZ_QUESTION_COUNT) {
    return { phase: "finished", countdown: 0, questionIndex: SHARED_QUIZ_QUESTION_COUNT, remainingMs: 0 };
  }

  return {
    phase: "question",
    countdown: 0,
    questionIndex,
    remainingMs: questionDurationMs - elapsed % questionDurationMs,
  };
}

export function formatSharedQuizTime(milliseconds: number) {
  return `${(Math.max(0, milliseconds) / 1000).toFixed(3)}秒`;
}
