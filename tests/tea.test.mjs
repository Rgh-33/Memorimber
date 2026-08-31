import assert from "node:assert/strict";
import test from "node:test";
import { addTeaMemories, drinkPearl, emptyTea, localMonth, memoryWord, MONTHLY_SIPS, nextMonth, readTeaState, readyPearls, rollTeaMonth, sipCount, teaQuestion, teaRemaining } from "../lib/tea-state.ts";
import { getProfileLevelProgress, PROFILE_LEVEL_REQUIREMENTS, PROFILE_MEDALS } from "../lib/profile-data.ts";

const memory = (number, changes = {}) => ({ id: `memory-${String(number).padStart(3, "0")}`, date: "2026-08-10", createdAt: `2026-08-10T00:${String(number).padStart(2, "0")}:00Z`, caption: "いつもの帰り道", tags: ["8月", "夕焼け"], people: ["友達"], imageUrl: "", ...changes });
const fill = (count) => addTeaMemories(emptyTea("2026-08"), Array.from({ length: count }, (_, index) => memory(index)));

test("seven recent pearls wait; upload eight releases exactly the oldest", () => {
  const seven = fill(7);
  assert.deepEqual(readyPearls(seven), []);
  assert.equal(teaRemaining(seven), 1);
  const eight = addTeaMemories(seven, [memory(7)]);
  assert.deepEqual(readyPearls(eight), [memory(0).id]);
  assert.equal(seven.pearls.length, 7);
});

test("FIFO uses upload time, not a backdated memory date; duplicates are ignored", () => {
  const first = memory(1, { date: "2026-08-30" });
  const second = memory(2, { date: "2020-01-01" });
  const state = addTeaMemories(emptyTea("2026-08"), [second, first, first]);
  assert.deepEqual(state.pearls, [first.id, second.id]);
  assert.equal(addTeaMemories(state, [second, first]), state);
});

test("backlogged releases remain available and cannot skip the queue", () => {
  const state = fill(12);
  assert.equal(readyPearls(state).length, 5);
  assert.equal(drinkPearl(state, memory(1).id, true), state);
  const next = drinkPearl(state, memory(0).id, false);
  assert.equal(next.pearls.length, 11);
  assert.equal(readyPearls(next).length, 4);
  assert.equal(next.sips[0].correct, false);
  assert.equal(drinkPearl(next, memory(0).id, true), next);
  assert.equal(drinkPearl(fill(7), memory(0).id, true).sips.length, 0);
});

test("15 answers empty the tea; more released quizzes still work", () => {
  let state = fill(25);
  for (let index = 0; index < MONTHLY_SIPS; index++) state = drinkPearl(state, state.pearls[0], true);
  assert.equal(sipCount(state), 15);
  assert.equal(teaRemaining(state), 0);
  state = drinkPearl(state, state.pearls[0], false);
  assert.equal(sipCount(state), 16);
  assert.equal(teaRemaining(state), 0);
  assert.equal(readyPearls(state).length, 2);
});

test("month rollover carries every waiting and ready pearl in order", () => {
  const old = drinkPearl(fill(12), memory(0).id, true);
  const next = rollTeaMonth(old, "2026-09");
  assert.deepEqual(next.pearls, old.pearls);
  assert.deepEqual(next.sips, old.sips);
  assert.deepEqual(readyPearls(next), readyPearls(old));
  assert.equal(teaRemaining(next), 1);
  assert.equal(sipCount(next), 0);
  assert.deepEqual(next.rollover, { from: "2026-08", to: "2026-09", remaining: 14 / 15, carried: 11 });
  assert.equal(drinkPearl(next, next.pearls[0], true), next);
  const dismissed = { ...next, rollover: null };
  assert.equal(sipCount(drinkPearl(dismissed, dismissed.pearls[0], true)), 1);
  assert.equal(rollTeaMonth(dismissed, "2026-09"), dismissed);
});

test("empty cup, empty queue, skipped months and year changes are safe", () => {
  let state = fill(22);
  for (let index = 0; index < 15; index++) state = drinkPearl(state, state.pearls[0], true);
  const next = rollTeaMonth(state, "2027-01");
  assert.equal(next.rollover.remaining, 0);
  assert.equal(next.pearls.length, 7);
  assert.equal(rollTeaMonth(next, "2026-12"), next);
  assert.equal(rollTeaMonth(emptyTea("2026-08"), "2026-09").rollover.carried, 0);
  assert.equal(nextMonth("2026-12"), "2027-01");
  assert.equal(nextMonth("2026-08"), "2026-09");
  assert.equal(localMonth(new Date(2026, 8, 1)), "2026-09");
});

test("reload preserves answers, order and unfinished rollover", () => {
  const state = rollTeaMonth(drinkPearl(fill(9), memory(0).id, true), "2026-09");
  assert.deepEqual(readTeaState(JSON.stringify(state), "2026-09"), state);
  const stored = readTeaState(JSON.stringify(fill(9)), "2026-10");
  assert.equal(stored.month, "2026-10");
  assert.equal(stored.rollover.carried, 9);
});

test("corrupt or inconsistent browser state is rejected safely", () => {
  const base = fill(8);
  const invalid = [null, "{", "null", JSON.stringify({ ...base, version: 2 }), JSON.stringify({ ...base, month: "2026-99" }), JSON.stringify({ ...base, pearls: ["missing"] }), JSON.stringify({ ...base, pearls: [memory(0).id, memory(0).id] }), JSON.stringify({ ...base, sips: [{ memoryId: memory(0).id, month: "2026-08", correct: true }] }), JSON.stringify({ ...base, rollover: { from: "2026-07", to: "2026-08", remaining: -1, carried: 7 } })];
  for (const raw of invalid) assert.deepEqual(readTeaState(raw, "2026-08"), emptyTea("2026-08"));
});

test("generated quizzes have three distinct choices and stable correct answer", () => {
  const item = memory(1, { date: "2026-01-03" });
  const quiz = teaQuestion(item);
  assert.equal(quiz.correctChoice, "2026年1月");
  assert.equal(new Set(quiz.choices).size, 3);
  assert.ok(quiz.choices.includes(quiz.correctChoice));
  assert.ok(quiz.choices.includes("2025年12月"));
  assert.equal(memoryWord(item), "夕焼け");
  assert.equal(memoryWord({ ...item, tags: [] }), item.caption);
});

test("long-running uploads, answers and month changes never lose a pearl", () => {
  let state = emptyTea("2026-08");
  for (let index = 0; index < 240; index++) {
    state = addTeaMemories(state, [memory(index)]);
    if (index % 3 !== 0 && readyPearls(state).length) state = drinkPearl(state, state.pearls[0], index % 2 === 0);
    if (index % 24 === 23) state = { ...rollTeaMonth(state, nextMonth(state.month)), rollover: null };
    assert.equal(state.seen.length, state.pearls.length + state.sips.length);
    assert.ok(teaRemaining(state) >= 0 && teaRemaining(state) <= 1);
    assert.ok(state.pearls.every((id) => !state.sips.some((sip) => sip.memoryId === id)));
    assert.deepEqual(readTeaState(JSON.stringify(state), state.month), state);
  }
});

test("level numbers and activity metrics stay compatible; visible copy uses tea", () => {
  assert.equal(PROFILE_LEVEL_REQUIREMENTS.length, 19);
  const level11 = PROFILE_LEVEL_REQUIREMENTS.find((level) => level.level === 11);
  assert.equal(level11.additionalCondition.metric, "harvestedFruits");
  assert.equal(level11.additionalCondition.target, 5);
  assert.match(level11.additionalCondition.label, /5粒味わう/);
  assert.equal(PROFILE_MEDALS.find((medal) => medal.id === "fruit-harvester").label, "思い出のテイスター");
  assert.equal(getProfileLevelProgress({ uploadedPhotos: 1, harvestedFruits: 0, correctQuizAnswers: 0, activeMonths: 0, sharedMemories: 0, friendQuizSessions: 0 }).level, 2);
});
