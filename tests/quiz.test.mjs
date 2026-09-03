import assert from "node:assert/strict";
import test from "node:test";
import { FRUIT_QUIZ_KINDS, createMemoryQuizQuestion, createMixedQuizQuestions, createQuizQuestions } from "../lib/quiz.ts";

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

test("ten-question mode never repeats a memory when at least ten exist", () => {
  const questions = createQuizQuestions(memories(12), 10, undefined, seededRandom());
  assert.equal(questions.length, 10);
  assert.equal(new Set(questions.map((question) => question.memoryId)).size, 10);
});

test("small collections are exhausted before reuse and repeated memories change format", () => {
  const questions = createQuizQuestions(memories(3), 10, undefined, seededRandom());
  for (let start = 0; start < 9; start += 3) {
    assert.equal(new Set(questions.slice(start, start + 3).map((question) => question.memoryId)).size, 3);
  }
  for (const memory of memories(3)) {
    const appearances = questions.filter((question) => question.memoryId === memory.id);
    for (let index = 1; index < appearances.length; index++) {
      assert.notEqual(appearances[index].kind, appearances[index - 1].kind);
    }
  }
});

test("caption and photo questions use real memories and keep the right answer", () => {
  const source = memories(4);
  const captionQuestion = createMemoryQuizQuestion(source[0], source, "photo-to-caption", seededRandom());
  assert.equal(captionQuestion.correctChoiceId, source[0].id);
  assert.equal(captionQuestion.choices.find((choice) => choice.id === source[0].id).label, source[0].caption);

  const photoQuestion = createMemoryQuizQuestion(source[0], source, "caption-to-photo", seededRandom());
  assert.equal(photoQuestion.correctChoiceId, source[0].id);
  assert.equal(photoQuestion.choices.find((choice) => choice.id === source[0].id).imageUrl, source[0].imageUrl);
});

test("fruit quizzes only use the two recall formats, never the month question", () => {
  const questions = createQuizQuestions(memories(8), 40, FRUIT_QUIZ_KINDS, seededRandom());
  assert.deepEqual(new Set(questions.map((question) => question.kind)), new Set(FRUIT_QUIZ_KINDS));
  assert.ok(questions.every((question) => question.kind !== "month"));
});

test("mixed mode keeps both requested counts and shuffles them into one quiz", () => {
  const questions = createMixedQuizQuestions(memories(12), 4, 3, seededRandom(52));
  assert.equal(questions.length, 7);
  assert.equal(questions.filter((question) => question.kind === "photo-to-caption").length, 4);
  assert.equal(questions.filter((question) => question.kind === "caption-to-photo").length, 3);
  assert.equal(new Set(questions.map((question) => question.memoryId)).size, 7);
  assert.ok(questions.every((question) => question.kind !== "month"));
});

test("mixed mode supports setting either direction to zero questions", () => {
  const questions = createMixedQuizQuestions(memories(6), 0, 4, seededRandom(9));
  assert.equal(questions.length, 4);
  assert.ok(questions.every((question) => question.kind === "caption-to-photo"));
});
