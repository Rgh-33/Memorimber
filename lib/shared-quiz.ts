import {
  createMemoryQuizQuestion,
  createQuizQuestionsByKindCounts,
  type MemoryQuizQuestion,
  type QuizKind,
} from "./quiz.ts";
import { getMemoryDisplayUrl, type Memory } from "./types.ts";

export const SHARED_QUIZ_QUESTION_COUNT = 10;
export const SHARED_QUIZ_DIRECTION_COUNT = 5;
export const SHARED_QUIZ_SECONDS_PER_QUESTION = 5;
export const SHARED_QUIZ_START_DELAY_SECONDS = 5;

export type SharedQuizKind = Extract<QuizKind, "month" | "photo-to-caption" | "caption-to-photo">;
export type SharedQuizSeconds = 3 | 5 | 10;
export type SharedQuizConfig = {
  mode: "random" | "custom";
  balanceContributors: boolean;
  monthCount: number;
  photoToCaptionCount: number;
  captionToPhotoCount: number;
  secondsPerQuestion: SharedQuizSeconds;
};

export const DEFAULT_SHARED_QUIZ_CONFIG: SharedQuizConfig = {
  mode: "random",
  balanceContributors: false,
  monthCount: 0,
  photoToCaptionCount: 5,
  captionToPhotoCount: 5,
  secondsPerQuestion: 5,
};

export type SharedQuizQuestionPlan = {
  memoryId: string;
  kind: SharedQuizKind;
  choiceIds: string[];
  secondsPerQuestion: SharedQuizSeconds;
  snapshots?: Record<string, { caption: string; date: string }>;
};

export type SharedQuizTiming =
  | { phase: "countdown"; countdown: number; questionIndex: 0; remainingMs: number }
  | { phase: "question"; countdown: 0; questionIndex: number; remainingMs: number }
  | { phase: "finished"; countdown: 0; questionIndex: number; remainingMs: 0 };

function isSharedQuizKind(value: unknown): value is SharedQuizKind {
  return value === "month" || value === "photo-to-caption" || value === "caption-to-photo";
}

function isSharedQuizSeconds(value: unknown): value is SharedQuizSeconds {
  return value === 3 || value === 5 || value === 10;
}

function validCount(value: unknown) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 && count <= SHARED_QUIZ_QUESTION_COUNT ? count : 0;
}

export function parseSharedQuizConfig(value: unknown): SharedQuizConfig {
  if (!value || typeof value !== "object") return { ...DEFAULT_SHARED_QUIZ_CONFIG };
  const candidate = value as Partial<SharedQuizConfig>;
  const mode = candidate.mode === "custom" ? "custom" : "random";
  const custom = {
    monthCount: validCount(candidate.monthCount),
    photoToCaptionCount: validCount(candidate.photoToCaptionCount),
    captionToPhotoCount: validCount(candidate.captionToPhotoCount),
  };
  const customTotal = custom.monthCount + custom.photoToCaptionCount + custom.captionToPhotoCount;
  return {
    mode,
    balanceContributors: candidate.balanceContributors === true,
    ...(mode === "custom" && customTotal === SHARED_QUIZ_QUESTION_COUNT
      ? custom
      : {
        monthCount: DEFAULT_SHARED_QUIZ_CONFIG.monthCount,
        photoToCaptionCount: DEFAULT_SHARED_QUIZ_CONFIG.photoToCaptionCount,
        captionToPhotoCount: DEFAULT_SHARED_QUIZ_CONFIG.captionToPhotoCount,
      }),
    secondsPerQuestion: mode === "custom" && isSharedQuizSeconds(candidate.secondsPerQuestion)
      ? candidate.secondsPerQuestion
      : SHARED_QUIZ_SECONDS_PER_QUESTION,
  };
}

function shuffle<T>(values: readonly T[], random: () => number) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [next[index], next[other]] = [next[other], next[index]];
  }
  return next;
}

export type SharedQuizContribution = {
  contributorId: string | null;
  memory: Memory;
};

export function selectBalancedSharedQuizMemories(
  contributions: SharedQuizContribution[],
  participantIds: string[],
  random: () => number = Math.random,
) {
  const uniqueParticipantIds = [...new Set(participantIds)];
  const byContributor = uniqueParticipantIds.map((participantId) => ({
    participantId,
    memories: [...new Map(
      contributions
        .filter((entry) => entry.contributorId === participantId)
        .map((entry) => [entry.memory.id, entry.memory]),
    ).values()],
  })).filter((entry) => entry.memories.length > 0);
  if (byContributor.length === 0) return [];
  const minimum = Math.min(...byContributor.map((entry) => entry.memories.length));
  return shuffle(
    byContributor.flatMap((entry) => shuffle(entry.memories, random).slice(0, minimum)),
    random,
  );
}

function monthChoiceIds(memory: Memory, memories: Memory[], random: () => number) {
  const memoryMonth = memory.date.slice(0, 7);
  const representativeByMonth = new Map<string, Memory>();
  for (const candidate of shuffle(memories.filter((item) => getMemoryDisplayUrl(item) && item.caption.trim()), random)) {
    const month = candidate.date.slice(0, 7);
    if (month !== memoryMonth && !representativeByMonth.has(month)) representativeByMonth.set(month, candidate);
  }
  return shuffle([memory.id, ...[...representativeByMonth.values()].slice(0, 2).map((candidate) => candidate.id)], random);
}

export function createSharedQuizPlan(
  memories: Memory[],
  random: () => number = Math.random,
  requestedConfig: Partial<SharedQuizConfig> = DEFAULT_SHARED_QUIZ_CONFIG,
  contributorByMemory?: ReadonlyMap<string, string>,
): SharedQuizQuestionPlan[] {
  const config = parseSharedQuizConfig(requestedConfig);
  const counts = {
    month: config.monthCount,
    "photo-to-caption": config.photoToCaptionCount,
    "caption-to-photo": config.captionToPhotoCount,
  };
  const questions = contributorByMemory?.size
    ? createContributorBalancedQuestions(memories, counts, contributorByMemory, random)
    : createQuizQuestionsByKindCounts(memories, counts, random);
  return questions.map((question) => ({
    memoryId: question.memoryId,
    kind: question.kind as SharedQuizKind,
    choiceIds: question.kind === "month"
      ? monthChoiceIds(question.memory, memories, random)
      : question.choices.map((choice) => choice.id),
    secondsPerQuestion: config.secondsPerQuestion,
  }));
}

function createContributorBalancedQuestions(
  memories: Memory[],
  counts: Record<SharedQuizKind, number>,
  contributorByMemory: ReadonlyMap<string, string>,
  random: () => number,
) {
  const source = [...new Map(memories
    .filter((memory) => getMemoryDisplayUrl(memory) && memory.caption.trim())
    .map((memory) => [memory.id, memory])).values()];
  const byContributor = new Map<string, Memory[]>();
  for (const memory of source) {
    const contributorId = contributorByMemory.get(memory.id);
    if (!contributorId) continue;
    byContributor.set(contributorId, [...(byContributor.get(contributorId) ?? []), memory]);
  }
  if (byContributor.size === 0) return [];

  const kinds = shuffle<SharedQuizKind>([
    ...Array.from({ length: counts.month }, () => "month" as const),
    ...Array.from({ length: counts["photo-to-caption"] }, () => "photo-to-caption" as const),
    ...Array.from({ length: counts["caption-to-photo"] }, () => "caption-to-photo" as const),
  ], random);
  const contributorUses = new Map<string, number>();
  const memoryUses = new Map<string, number>();
  const lastKindByMemory = new Map<string, SharedQuizKind>();
  let lastContributorId: string | null = null;
  let lastMemoryId: string | null = null;

  return kinds.map((kind, index) => {
    const contributorMinimum = Math.min(...[...byContributor].map(([id]) => contributorUses.get(id) ?? 0));
    let contributorCandidates = [...byContributor]
      .filter(([id]) => (contributorUses.get(id) ?? 0) === contributorMinimum);
    if (contributorCandidates.length > 1) {
      const withoutLast = contributorCandidates.filter(([id]) => id !== lastContributorId);
      if (withoutLast.length) contributorCandidates = withoutLast;
    }
    const [contributorId, contributorMemories] = shuffle(contributorCandidates, random)[0];
    const memoryMinimum = Math.min(...contributorMemories.map((memory) => memoryUses.get(memory.id) ?? 0));
    let memoryCandidates = contributorMemories.filter((memory) => (memoryUses.get(memory.id) ?? 0) === memoryMinimum);
    const ideal = memoryCandidates.filter((memory) => memory.id !== lastMemoryId && lastKindByMemory.get(memory.id) !== kind);
    if (ideal.length) memoryCandidates = ideal;
    else {
      const nonRepeating = memoryCandidates.filter((memory) => memory.id !== lastMemoryId);
      if (nonRepeating.length) memoryCandidates = nonRepeating;
    }
    const memory = shuffle(memoryCandidates, random)[0];
    contributorUses.set(contributorId, (contributorUses.get(contributorId) ?? 0) + 1);
    memoryUses.set(memory.id, (memoryUses.get(memory.id) ?? 0) + 1);
    lastKindByMemory.set(memory.id, kind);
    lastContributorId = contributorId;
    lastMemoryId = memory.id;
    return createMemoryQuizQuestion(memory, source, kind, random, `shared-balanced-${index}-${memory.id}`);
  });
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
    const secondsPerQuestion = record.secondsPerQuestion === undefined
      ? SHARED_QUIZ_SECONDS_PER_QUESTION
      : record.secondsPerQuestion;
    if (!isSharedQuizSeconds(secondsPerQuestion)) return [];
    const snapshots: NonNullable<SharedQuizQuestionPlan["snapshots"]> = {};
    if (record.snapshots && typeof record.snapshots === "object") {
      for (const [id, value] of Object.entries(record.snapshots)) {
        if (value && typeof value === "object" && typeof value.caption === "string" && typeof value.date === "string") snapshots[id] = { caption: value.caption, date: value.date };
      }
    }
    return [{ memoryId: record.memoryId, kind: record.kind, choiceIds, secondsPerQuestion, ...(Object.keys(snapshots).length ? { snapshots } : {}) }];
  });
  if (plans.length !== SHARED_QUIZ_QUESTION_COUNT) return [];
  return new Set(plans.map((plan) => plan.secondsPerQuestion)).size === 1 ? plans : [];
}

export function hydrateSharedQuizQuestions(
  plans: SharedQuizQuestionPlan[],
  memories: Memory[],
): MemoryQuizQuestion[] {
  const memoryById = new Map(memories.map((memory) => [memory.id, memory]));
  return plans.flatMap((plan, index): MemoryQuizQuestion[] => {
    const savedMemory = (id: string) => {
      const current = memoryById.get(id);
      return current ? { ...current, ...plan.snapshots?.[id] } : undefined;
    };
    const memory = savedMemory(plan.memoryId);
    const choices = plan.choiceIds.map(savedMemory).filter((item): item is Memory => Boolean(item));
    if (!memory || choices.length !== plan.choiceIds.length || !getMemoryDisplayUrl(memory) || !memory.caption.trim()) return [];

    if (plan.kind === "month") {
      const monthLabel = (candidate: Memory) => `${candidate.date.slice(0, 4)}年${Number(candidate.date.slice(5, 7))}月`;
      return [{
        id: `shared-${index}-${memory.id}`,
        memoryId: memory.id,
        kind: plan.kind,
        prompt: "これはいつの思い出？",
        choices: choices.map((choice) => ({ id: choice.id, label: monthLabel(choice) })),
        correctChoiceId: memory.id,
        correctLabel: monthLabel(memory),
        memory,
      }];
    }

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

export function getSharedQuizTiming(
  startedAt: string | number | Date,
  now = Date.now(),
  questionCount = SHARED_QUIZ_QUESTION_COUNT,
  secondsPerQuestion: SharedQuizSeconds = SHARED_QUIZ_SECONDS_PER_QUESTION,
): SharedQuizTiming {
  const startsAt = new Date(startedAt).getTime();
  const elapsed = now - startsAt;
  const questionDurationMs = secondsPerQuestion * 1000;
  if (elapsed < 0) {
    return {
      phase: "countdown",
      countdown: Math.max(1, Math.ceil(-elapsed / 1000)),
      questionIndex: 0,
      remainingMs: -elapsed,
    };
  }

  const questionIndex = Math.floor(elapsed / questionDurationMs);
  if (questionIndex >= questionCount) {
    return { phase: "finished", countdown: 0, questionIndex: questionCount, remainingMs: 0 };
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
