import { getMemoryDisplayUrl, type Memory } from "./types.ts";

export type QuizKind = "month" | "photo-to-caption" | "caption-to-photo";
export type QuizMode = "quick" | "mixed" | "photo-to-caption" | "caption-to-photo" | "endless";

export type QuizChoice = {
  id: string;
  label?: string;
  imageUrl?: string;
};

export type MemoryQuizQuestion = {
  id: string;
  memoryId: string;
  kind: QuizKind;
  prompt: string;
  choices: QuizChoice[];
  correctChoiceId: string;
  correctLabel: string;
  memory: Memory;
};

export type QuizAnswer = {
  question: MemoryQuizQuestion;
  selectedChoiceId: string;
  selectedLabel: string;
  correct: boolean;
};

export type QuizHistoryQuestion = {
  memoryId: string;
  kind: QuizKind;
  prompt: string;
  memoryCaption: string;
  selectedLabel: string;
  correctLabel: string;
  correct: boolean;
};

export type QuizHistoryEntry = {
  id: string;
  mode: QuizMode;
  completedAt: string;
  answers: QuizHistoryQuestion[];
};

export const ALL_QUIZ_KINDS: QuizKind[] = ["month", "photo-to-caption", "caption-to-photo"];
export const FRUIT_QUIZ_KINDS: QuizKind[] = ["photo-to-caption", "caption-to-photo"];

export const QUIZ_KIND_LABELS: Record<QuizKind, string> = {
  month: "写真から時期",
  "photo-to-caption": "写真から一言",
  "caption-to-photo": "一言から写真",
};

export const QUIZ_MODE_LABELS: Record<QuizMode, string> = {
  quick: "10問クイズ",
  mixed: "写真と一言クイズ",
  "photo-to-caption": "写真から一言",
  "caption-to-photo": "一言から写真",
  endless: "総集クイズ",
};

function uniqueMemories(memories: Memory[]) {
  return [...new Map(memories.map((memory) => [memory.id, memory])).values()]
    .filter((memory) => Boolean(getMemoryDisplayUrl(memory) && memory.caption.trim()));
}

function shuffle<T>(values: readonly T[], random: () => number) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [next[index], next[other]] = [next[other], next[index]];
  }
  return next;
}

function rotateFirstAwayFrom<T>(values: T[], matches: (value: T) => boolean) {
  if (values.length < 2 || !matches(values[0])) return values;
  const replacement = values.findIndex((value, index) => index > 0 && !matches(value));
  if (replacement > 0) [values[0], values[replacement]] = [values[replacement], values[0]];
  return values;
}

function monthLabel(month: string) {
  return `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`;
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function choiceLabel(choice: QuizChoice) {
  return choice.label ?? "写真の選択肢";
}

export function createMemoryQuizQuestion(
  memory: Memory,
  memories: Memory[],
  kind: QuizKind,
  random: () => number = Math.random,
  id = `${Date.now()}-${Math.floor(random() * 1_000_000)}`,
): MemoryQuizQuestion {
  const source = uniqueMemories(memories);
  const otherMemories = source.filter((candidate) => candidate.id !== memory.id);

  if (kind === "month") {
    const month = memory.date.slice(0, 7);
    const monthChoices = shuffle([shiftMonth(month, -1), month, shiftMonth(month, 1)], random);
    return {
      id,
      memoryId: memory.id,
      kind,
      prompt: "これはいつの思い出？",
      choices: monthChoices.map((choice) => ({ id: choice, label: monthLabel(choice) })),
      correctChoiceId: month,
      correctLabel: monthLabel(month),
      memory,
    };
  }

  if (kind === "photo-to-caption") {
    const distractors = shuffle(
      otherMemories.filter((candidate) => candidate.caption.trim() !== memory.caption.trim()),
      random,
    ).slice(0, 2);
    const choices = shuffle([memory, ...distractors], random).map((candidate) => ({
      id: candidate.id,
      label: candidate.caption,
    }));
    return {
      id,
      memoryId: memory.id,
      kind,
      prompt: "この写真に添えた一言は？",
      choices,
      correctChoiceId: memory.id,
      correctLabel: memory.caption,
      memory,
    };
  }

  const choices = shuffle([memory, ...shuffle(otherMemories, random).slice(0, 2)], random).map((candidate) => ({
    id: candidate.id,
    imageUrl: getMemoryDisplayUrl(candidate),
  }));
  return {
    id,
    memoryId: memory.id,
    kind,
    prompt: `「${memory.caption}」の写真はどれ？`,
    choices,
    correctChoiceId: memory.id,
    correctLabel: "この思い出の写真",
    memory,
  };
}

export function createQuizQuestions(
  memories: Memory[],
  count: number,
  kinds: QuizKind[] = ALL_QUIZ_KINDS,
  random: () => number = Math.random,
  previous: MemoryQuizQuestion[] = [],
) {
  const source = uniqueMemories(memories);
  if (source.length === 0 || count <= 0 || kinds.length === 0) return [];

  const questions: MemoryQuizQuestion[] = [];
  const lastKindByMemory = new Map<string, QuizKind>();
  for (const question of previous) lastKindByMemory.set(question.memoryId, question.kind);
  let lastMemoryId = previous.at(-1)?.memoryId ?? null;
  let pool: Memory[] = [];

  for (let index = 0; index < count; index++) {
    if (pool.length === 0) {
      pool = rotateFirstAwayFrom(shuffle(source, random), (memory) => memory.id === lastMemoryId);
    }
    const memory = pool.shift()!;
    const previousKind = lastKindByMemory.get(memory.id);
    const availableKinds = kinds.length > 1 ? kinds.filter((kind) => kind !== previousKind) : kinds;
    const kind = availableKinds[Math.floor(random() * availableKinds.length)] ?? kinds[0];
    const questionId = `${Date.now()}-${previous.length + index}-${Math.floor(random() * 1_000_000)}`;
    const question = createMemoryQuizQuestion(memory, source, kind, random, questionId);
    questions.push(question);
    lastMemoryId = memory.id;
    lastKindByMemory.set(memory.id, kind);
  }

  return questions;
}

export function createMixedQuizQuestions(
  memories: Memory[],
  photoToCaptionCount: number,
  captionToPhotoCount: number,
  random: () => number = Math.random,
) {
  const source = uniqueMemories(memories);
  if (source.length === 0) return [];

  const kinds = shuffle<QuizKind>([
    ...Array.from({ length: Math.max(0, photoToCaptionCount) }, () => "photo-to-caption" as const),
    ...Array.from({ length: Math.max(0, captionToPhotoCount) }, () => "caption-to-photo" as const),
  ], random);
  const questions: MemoryQuizQuestion[] = [];
  const lastKindByMemory = new Map<string, QuizKind>();
  let lastMemoryId: string | null = null;
  let pool: Memory[] = [];

  for (let index = 0; index < kinds.length; index++) {
    if (pool.length === 0) {
      pool = rotateFirstAwayFrom(shuffle(source, random), (memory) => memory.id === lastMemoryId);
    }
    const kind = kinds[index];
    const idealIndex = pool.findIndex((memory) => memory.id !== lastMemoryId && lastKindByMemory.get(memory.id) !== kind);
    const nonRepeatingIndex = pool.findIndex((memory) => memory.id !== lastMemoryId);
    const differentKindIndex = pool.findIndex((memory) => lastKindByMemory.get(memory.id) !== kind);
    const memoryIndex = idealIndex >= 0 ? idealIndex : nonRepeatingIndex >= 0 ? nonRepeatingIndex : differentKindIndex >= 0 ? differentKindIndex : 0;
    const memory = pool.splice(memoryIndex, 1)[0];
    const questionId = `${Date.now()}-mixed-${index}-${Math.floor(random() * 1_000_000)}`;
    questions.push(createMemoryQuizQuestion(memory, source, kind, random, questionId));
    lastMemoryId = memory.id;
    lastKindByMemory.set(memory.id, kind);
  }

  return questions;
}

export function answerLabel(question: MemoryQuizQuestion, choiceId: string) {
  const choice = question.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) return "未回答";
  if (choice.imageUrl) return choice.id === question.correctChoiceId ? "正解の写真" : "別の写真";
  return choiceLabel(choice);
}

export function toHistoryQuestion(answer: QuizAnswer): QuizHistoryQuestion {
  return {
    memoryId: answer.question.memoryId,
    kind: answer.question.kind,
    prompt: answer.question.prompt,
    memoryCaption: answer.question.memory.caption,
    selectedLabel: answer.selectedLabel,
    correctLabel: answer.question.correctLabel,
    correct: answer.correct,
  };
}
