import assert from "node:assert/strict";
import test from "node:test";
import { advanceDate, buildPetals, buildTreeItems, memoryQuestion, monthlyQueue, recordHarvest } from "../lib/tree-growth.ts";

const memory = (index, changes = {}) => ({ id: `photo-${String(index).padStart(3, "0")}`, date: "2020-01-01",
  createdAt: `2026-08-01T12:00:${String(index).padStart(2, "0")}`, imageUrl: "test.jpg", caption: "思い出", people: [], tags: [], ...changes });
const photos = (length) => Array.from({ length }, (_, index) => memory(index));

test("each later upload advances older photos once; the seventh unlocks only the oldest", () => {
  for (let count = 1; count <= 7; count++) {
    const items = buildTreeItems(photos(count), "2026-08-01", {});
    assert.deepEqual(items.map((item) => item.growthStage), Array.from({ length: count }, (_, index) => count - index));
    assert.equal(items.filter((item) => item.stage === "quiz-ready").length, count === 7 ? 1 : 0);
    assert.equal(items.at(-1).growthStage, 1);
  }
  assert.equal(buildTreeItems(photos(8), "2026-08-01", {})[1].stage, "quiz-ready");
});

test("growth follows uploads, remains stable after refresh and does not double count", () => {
  const source = photos(8);
  const expected = buildTreeItems(source, "2026-08-01", {});
  assert.deepEqual(buildTreeItems([...source].reverse(), "2026-08-01", {}), expected);
  assert.deepEqual(buildTreeItems([...source, source[0]], "2026-08-01", {}), expected);
  assert.deepEqual(buildTreeItems(source, "2026-08-31", {}), expected);
  assert.equal(monthlyQueue(source, "2020-01-01").length, 0);
});

test("month rollover starts a separate tree, preserves old queue, excludes future uploads", () => {
  const source = [...photos(7), memory(8, { createdAt: "2026-09-01T12:00:00" }), memory(9, { createdAt: "2026-09-02T12:00:00" })];
  assert.equal(buildTreeItems(source, "2026-08-31", {}).length, 7);
  const september = buildTreeItems(source, "2026-09-01", {});
  assert.equal(september.length, 1);
  assert.equal(september[0].growthStage, 1);
  assert.equal(buildTreeItems(source, "2026-10-01", {}).length, 0);
  assert.equal(buildTreeItems(source, "2026-08-31", {})[0].stage, "quiz-ready");
});

test("only ripe fruit can be harvested and each harvest keeps its exact memory and word", () => {
  const source = photos(7);
  const empty = {};
  assert.equal(recordHarvest(source, "2026-08-01", empty, source[1].id, "まだ葉"), empty);
  assert.equal(recordHarvest(source, "2026-08-01", empty, "missing", "test"), empty);
  assert.equal(recordHarvest(source, "2026-08-01", empty, source[0].id, "  "), empty);
  assert.equal(recordHarvest(source, "2026-08-01", empty, source[0].id, "あ".repeat(13)), empty);
  const saved = recordHarvest(source, "2026-08-01", empty, source[0].id, " 帰り道 ");
  assert.equal(recordHarvest(source, "2026-08-01", saved, source[0].id, "別の言葉"), saved);
  const result = buildTreeItems(source, "2026-08-01", saved)[0];
  assert.equal(result.stage, "harvested");
  assert.equal(result.word, "帰り道");
  assert.deepEqual(result.relatedMemoryIds, [source[0].id]);
  assert.equal(buildTreeItems([...source, memory(8)], "2026-08-01", saved)[1].stage, "quiz-ready");
});

test("preview calendar clamps month ends and handles year/leap-day boundaries", () => {
  assert.equal(advanceDate("2026-08-31", 0, 1), "2026-09-30");
  assert.equal(advanceDate("2026-08-31", 1), "2026-09-01");
  assert.equal(advanceDate("2026-12-31", 1), "2027-01-01");
  assert.equal(advanceDate("2024-01-31", 0, 1), "2024-02-29");
  assert.equal(advanceDate("2026-01-31", 0, 1), "2026-02-28");
});

test("quiz uses the selected photo date, not upload date; choices remain distinct across years", () => {
  const source = memory(1, { date: "2025-12-21" });
  const question = memoryQuestion(source);
  assert.equal(question.memoryId, source.id);
  assert.equal(question.correctChoice, "2025年12月");
  assert.deepEqual([...question.choices].sort(), ["2025年11月", "2025年12月", "2026年1月"].sort());
});

test("harvested petals survive month rollover without showing future words or another account's photos", () => {
  const source = photos(7);
  const harvests = recordHarvest(source, "2026-08-01", {}, source[0].id, "夏の日");
  assert.equal(buildPetals(source, "2026-09-01", harvests)[0].word, "夏の日");
  assert.equal(buildPetals(source, "2026-07-31", harvests).length, 0);
  assert.equal(buildPetals([], "2026-09-01", harvests).length, 0);
});
