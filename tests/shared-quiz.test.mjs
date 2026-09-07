import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SHARED_QUIZ_QUESTION_COUNT,
  createSharedQuizPlan,
  getSharedQuizTiming,
  hydrateSharedQuizQuestions,
  parseSharedQuizConfig,
  parseSharedQuizPlan,
  selectBalancedSharedQuizMemories,
} from "../lib/shared-quiz.ts";

const memories = (length) => Array.from({ length }, (_, index) => ({
  id: `memory-${index}`,
  date: `2026-${String(index % 12 + 1).padStart(2, "0")}-01`,
  imageUrl: `photo-${index}.jpg`,
  caption: `一言-${index}`,
  people: [],
  tags: [],
}));

function seededRandom(seed = 12345) {
  let state = seed;
  return () => {
    state = state * 16807 % 2147483647;
    return (state - 1) / 2147483646;
  };
}

test("shared quizzes always contain five questions in each direction", () => {
  const plan = createSharedQuizPlan(memories(12), seededRandom());
  assert.equal(plan.length, SHARED_QUIZ_QUESTION_COUNT);
  assert.equal(plan.filter((question) => question.kind === "photo-to-caption").length, 5);
  assert.equal(plan.filter((question) => question.kind === "caption-to-photo").length, 5);
  assert.ok(plan.every((question) => question.choiceIds.includes(question.memoryId)));
});

test("a one-memory group can still build the complete ten-question game", () => {
  const plan = createSharedQuizPlan(memories(1), seededRandom());
  assert.equal(plan.length, 10);
  assert.ok(plan.every((question) => question.memoryId === "memory-0"));
  assert.ok(plan.every((question) => question.choiceIds.length === 1));
});

test("custom shared quizzes keep exact kind counts and one synchronized time limit", () => {
  const source = memories(12);
  const config = parseSharedQuizConfig({
    mode: "custom",
    balanceContributors: true,
    monthCount: 2,
    photoToCaptionCount: 3,
    captionToPhotoCount: 5,
    secondsPerQuestion: 10,
  });
  const plan = createSharedQuizPlan(source, seededRandom(31), config);
  assert.equal(plan.length, 10);
  assert.equal(plan.filter((question) => question.kind === "month").length, 2);
  assert.equal(plan.filter((question) => question.kind === "photo-to-caption").length, 3);
  assert.equal(plan.filter((question) => question.kind === "caption-to-photo").length, 5);
  assert.ok(plan.every((question) => question.secondsPerQuestion === 10));
  const questions = hydrateSharedQuizQuestions(parseSharedQuizPlan(plan), source);
  assert.equal(questions.length, 10);
  assert.ok(questions.filter((question) => question.kind === "month")
    .every((question) => question.choices.some((choice) => choice.id === question.memoryId)));
});

test("balanced mode ignores zero-post participants and samples the positive minimum equally", () => {
  const source = memories(7);
  const selected = selectBalancedSharedQuizMemories([
    ...source.slice(0, 3).map((memory) => ({ contributorId: "person-a", memory })),
    ...source.slice(3, 5).map((memory) => ({ contributorId: "person-b", memory })),
    ...source.slice(5).map((memory) => ({ contributorId: "not-playing", memory })),
  ], ["person-a", "person-b", "person-with-zero"], seededRandom(8));
  assert.equal(selected.length, 4);
  assert.equal(selected.filter((memory) => Number(memory.id.split("-")[1]) < 3).length, 2);
  assert.equal(selected.filter((memory) => [3, 4].includes(Number(memory.id.split("-")[1]))).length, 2);
  assert.ok(selected.every((memory) => !["memory-5", "memory-6"].includes(memory.id)));

  const contributorByMemory = new Map(selected.map((memory) => [
    memory.id,
    Number(memory.id.split("-")[1]) < 3 ? "person-a" : "person-b",
  ]));
  const plan = createSharedQuizPlan(selected, seededRandom(19), {
    mode: "random",
    balanceContributors: true,
  }, contributorByMemory);
  const questionCountByContributor = plan.reduce((counts, question) => {
    const contributor = contributorByMemory.get(question.memoryId);
    counts.set(contributor, (counts.get(contributor) ?? 0) + 1);
    return counts;
  }, new Map());
  assert.deepEqual([...questionCountByContributor.values()].sort(), [5, 5]);
});

test("stored plans hydrate from fresh signed image URLs", () => {
  const source = memories(5);
  const plan = createSharedQuizPlan(source, seededRandom(9));
  const refreshed = source.map((memory) => ({ ...memory, imageUrl: `fresh-${memory.id}.webp` }));
  const questions = hydrateSharedQuizQuestions(parseSharedQuizPlan(plan), refreshed);
  assert.equal(questions.length, 10);
  assert.ok(questions.every((question) => question.correctChoiceId === question.memoryId));
  assert.ok(questions.filter((question) => question.kind === "caption-to-photo")
    .every((question) => question.choices.every((choice) => choice.imageUrl?.startsWith("fresh-"))));
});

test("the shared clock gives every question exactly five seconds", () => {
  const start = Date.UTC(2026, 8, 6, 0, 0, 0);
  assert.deepEqual(getSharedQuizTiming(start, start - 2500), {
    phase: "countdown", countdown: 3, questionIndex: 0, remainingMs: 2500,
  });
  assert.deepEqual(getSharedQuizTiming(start, start), {
    phase: "question", countdown: 0, questionIndex: 0, remainingMs: 5000,
  });
  assert.deepEqual(getSharedQuizTiming(start, start + 4999), {
    phase: "question", countdown: 0, questionIndex: 0, remainingMs: 1,
  });
  assert.deepEqual(getSharedQuizTiming(start, start + 5000), {
    phase: "question", countdown: 0, questionIndex: 1, remainingMs: 5000,
  });
  assert.equal(getSharedQuizTiming(start, start + 50_000).phase, "finished");
});

test("the shared clock follows custom three and ten second limits", () => {
  const start = Date.UTC(2026, 8, 6, 0, 0, 0);
  assert.equal(getSharedQuizTiming(start, start + 2999, 10, 3).questionIndex, 0);
  assert.equal(getSharedQuizTiming(start, start + 3000, 10, 3).questionIndex, 1);
  assert.equal(getSharedQuizTiming(start, start + 99_999, 10, 10).questionIndex, 9);
  assert.equal(getSharedQuizTiming(start, start + 100_000, 10, 10).phase, "finished");
});

test("migration keeps quiz writes behind hardened RPCs and ranks without ties", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260906000000_create_shared_quizzes.sql", import.meta.url),
    "utf8",
  );
  for (const table of ["shared_quizzes", "shared_quiz_participants", "shared_quiz_answers"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
  }
  for (const rpc of ["join_shared_quiz", "start_shared_quiz", "submit_shared_quiz_answer", "finalize_shared_quiz", "list_shared_quiz_standings"]) {
    assert.match(migration, new RegExp(`function public\\.${rpc}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`));
  }
  assert.match(migration, /jsonb_array_length\(quiz_questions\) <> 10/);
  assert.match(migration, /photo_to_caption_count <> 5 or caption_to_photo_count <> 5/);
  assert.match(migration, /interval '5 seconds'/);
  assert.match(migration, /primary key \(quiz_id, user_id, question_index\)/);
  assert.match(migration, /order by scores\.correct_count desc, scores\.correct_time_ms asc, scores\.joined_at asc, scores\.user_id asc/);
  assert.match(migration, /row_number\(\) over/);
});

test("configurable quiz migration accepts month questions and synchronizes custom limits", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260907010000_configurable_shared_quizzes.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /not in \('month', 'photo-to-caption', 'caption-to-photo'\)/);
  assert.match(migration, /not in \('3', '5', '10'\)/);
  assert.match(migration, /only the shared album owner can start a quiz/);
  assert.match(migration, /least\(quiz_seconds \* 1000/);
  assert.match(migration, /jsonb_array_length\(quiz_questions\)[\s\S]*secondsPerQuestion/);
  assert.match(migration, /response_time_ms between 0 and 10000/);
});

test("shared group UI exposes the join flow and dedicated quiz room", () => {
  const groupPage = readFileSync(new URL("../components/shared-group-detail.tsx", import.meta.url), "utf8");
  const room = readFileSync(new URL("../components/shared-quiz-room.tsx", import.meta.url), "utf8");
  assert.match(groupPage, /クイズに参加/);
  assert.match(groupPage, /joinSharedQuizAction/);
  assert.doesNotMatch(groupPage, /回答時間|各問 5秒|順位|正答数＋速さ|10問勝負|写真から一言 5問/);
  assert.doesNotMatch(groupPage, /\bClock3\b|\bTrophy\b/);
  assert.match(room, /クイズを開始/);
  assert.match(room, /SHARED_QUIZ_SECONDS_PER_QUESTION/);
  assert.match(room, /balanceQuizContributors/);
  assert.match(room, /quizSecondsPerQuestion/);
  assert.match(room, /オーナーがクイズを開始するまで/);
  assert.match(room, /正答数が多い順/);
});
