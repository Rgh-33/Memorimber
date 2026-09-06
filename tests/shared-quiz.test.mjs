import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SHARED_QUIZ_QUESTION_COUNT,
  createSharedQuizPlan,
  getSharedQuizTiming,
  hydrateSharedQuizQuestions,
  parseSharedQuizPlan,
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

test("shared group UI exposes the join flow and dedicated quiz room", () => {
  const groupPage = readFileSync(new URL("../app/shared-groups/[groupId]/page.tsx", import.meta.url), "utf8");
  const room = readFileSync(new URL("../components/shared-quiz-room.tsx", import.meta.url), "utf8");
  assert.match(groupPage, /クイズに参加/);
  assert.match(groupPage, /joinSharedQuizAction/);
  assert.match(room, /クイズを開始/);
  assert.match(room, /SHARED_QUIZ_SECONDS_PER_QUESTION/);
  assert.match(room, /正答数が多い順/);
});
