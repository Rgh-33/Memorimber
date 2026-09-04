import assert from "node:assert/strict";
import test from "node:test";
import { advanceDate, applyUploadPresentation, buildPersistedPetals, buildPersistedTreeItems, buildPetals, buildTreeItems, getFruitQuiz, getHarvestWordForMemory, memoryQuestion, monthlyQueue, recordHarvest, tokyoDate, uploadDate } from "../lib/tree-growth.ts";

const memory = (index, changes = {}) => ({ id: `photo-${String(index).padStart(3, "0")}`, date: "2020-01-01",
  createdAt: `2026-08-01T12:00:${String(index).padStart(2, "0")}`, imageUrl: "test.jpg", caption: "思い出", people: [], tags: [], ...changes });
const photos = (length) => Array.from({ length }, (_, index) => memory(index));

test("a photo starts as its own leaf and ripens only after seven later uploads", () => {
  const oldestStages = [1, 2, 3, 4, 5, 6, 6, 7];
  for (let count = 1; count <= 8; count++) {
    const items = buildTreeItems(photos(count), "2026-08-01", {});
    assert.equal(items[0].memoryId, "photo-000");
    assert.equal(items[0].growthStage, oldestStages[count - 1]);
    assert.equal(items.filter((item) => item.stage === "quiz-ready").length, count === 8 ? 1 : 0);
    assert.equal(items.at(-1).growthStage, 1);
    assert.equal(items.at(-1).memoryId, memory(count - 1).id);
  }
  assert.equal(buildTreeItems(photos(8), "2026-08-01", {})[1].stage, "growing");
  assert.equal(buildTreeItems(photos(9), "2026-08-01", {})[1].stage, "quiz-ready");
});

test("only the latest photo and the fruit formed or ripened by it are marked for emphasis", () => {
  for (let count = 1; count <= 20; count++) {
    const items = buildTreeItems(photos(count), "2026-08-01", {});
    const newlyAdded = items.filter(item => item.newlyAdded);
    const newlyFruited = items.filter(item => item.newlyFruited);
    const newlyRipened = items.filter(item => item.newlyRipened);
    assert.deepEqual(newlyAdded.map(item => item.memoryId), [`photo-${String(count - 1).padStart(3, "0")}`]);
    assert.deepEqual(newlyFruited.map(item => item.memoryId), count >= 6 ? [`photo-${String(count - 6).padStart(3, "0")}`] : []);
    assert.deepEqual(newlyRipened.map(item => item.memoryId), count >= 8 ? [`photo-${String(count - 8).padStart(3, "0")}`] : []);
    assert.ok(newlyAdded.every(item => item.growthStage === 1 && item.stage === "growing"));
    assert.ok(newlyFruited.every(item => item.growthStage === 6 && item.stage === "growing"));
    assert.ok(newlyRipened.every(item => item.growthStage === 7 && item.stage === "quiz-ready"));
  }
});

test("upload presentation runs only for an explicitly pending upload", () => {
  const source = buildTreeItems(photos(8), "2026-08-01", {});
  const stable = applyUploadPresentation(source, null);
  assert.equal(stable.some((item) => item.newlyAdded || item.newlyFruited || item.newlyRipened || item.advancedThisUpload), false);

  const arriving = applyUploadPresentation(source, "photo-007");
  assert.deepEqual(arriving.filter((item) => item.newlyAdded).map((item) => item.id), ["photo-007"]);
  assert.deepEqual(arriving.filter((item) => item.newlyFruited).map((item) => item.id), ["photo-002"]);
  assert.deepEqual(arriving.filter((item) => item.newlyRipened).map((item) => item.id), ["photo-000"]);
  assert.ok(arriving.some((item) => item.advancedThisUpload));

  const unrelated = applyUploadPresentation(source, "another-month");
  assert.equal(unrelated.some((item) => item.newlyAdded || item.newlyFruited || item.newlyRipened || item.advancedThisUpload), false);
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
  const source = [...photos(8), memory(8, { createdAt: "2026-09-01T12:00:00" }), memory(9, { createdAt: "2026-09-02T12:00:00" })];
  assert.equal(buildTreeItems(source, "2026-08-31", {}).length, 8);
  const september = buildTreeItems(source, "2026-09-01", {});
  assert.equal(september.length, 1);
  assert.equal(september[0].growthStage, 1);
  assert.equal(buildTreeItems(source, "2026-10-01", {}).length, 0);
  assert.equal(buildTreeItems(source, "2026-08-31", {})[0].stage, "quiz-ready");
});

test("only ripe fruit can be harvested and each harvest keeps its exact memory and word", () => {
  const source = photos(8);
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

test("real tree dates follow the same Asia/Tokyo boundary as the backend", () => {
  assert.equal(tokyoDate(new Date("2026-08-31T14:59:59Z")), "2026-08-31");
  assert.equal(tokyoDate(new Date("2026-08-31T15:00:00Z")), "2026-09-01");
  assert.equal(uploadDate(memory(1, { createdAt: "2026-08-31T15:00:00Z" })), "2026-09-01");
});

test("quiz uses the selected photo date, not upload date; choices remain distinct across years", () => {
  const source = memory(1, { date: "2025-12-21" });
  const question = memoryQuestion(source);
  assert.equal(question.memoryId, source.id);
  assert.equal(question.correctChoice, "2025年12月");
  assert.deepEqual([...question.choices].sort(), ["2025年11月", "2025年12月", "2026年1月"].sort());
});

test("harvested petals survive month rollover without showing future words or another account's photos", () => {
  const source = photos(8);
  const harvests = recordHarvest(source, "2026-08-01", {}, source[0].id, "夏の日");
  assert.equal(buildPetals(source, "2026-09-01", harvests)[0].word, "夏の日");
  assert.equal(buildPetals(source, "2026-07-31", harvests).length, 0);
  assert.equal(buildPetals([], "2026-09-01", harvests).length, 0);
});

test("persisted fruit timestamps, not frontend upload counts, decide ripe and harvested states", () => {
  const source = photos(9);
  const fruits = {
    [source[0].id]: { memoryId: source[0].id, ripenedAt: "2026-08-01T12:00:07Z", harvestedAt: null,
      harvestWord: null, wordAssignedAt: null, homeVisibleUntil: null },
  };
  const items = buildPersistedTreeItems(source, "2026-08-31", fruits);
  assert.equal(items[0].stage, "quiz-ready");
  // Nine uploads would make the second fruit ripe in the prototype algorithm,
  // but the real UI must wait for the backend timestamp.
  assert.equal(items[1].stage, "growing");

  const harvested = { ...fruits, [source[0].id]: { ...fruits[source[0].id],
    harvestedAt: "2026-08-20T03:00:00Z", harvestWord: "夏の日",
    wordAssignedAt: "2026-08-20T03:00:00Z", homeVisibleUntil: "2026-08-31T15:00:00Z" } };
  assert.equal(buildPersistedTreeItems(source, "2026-08-31", harvested)[0].stage, "harvested");
});

test("persisted petals disappear at the backend deadline while harvest history remains", () => {
  const source = photos(1);
  const fruits = { [source[0].id]: { memoryId: source[0].id, ripenedAt: "2026-08-01T12:00:07Z",
    harvestedAt: "2026-08-20T03:00:00Z", harvestWord: "夏の日", wordAssignedAt: "2026-08-20T03:00:00Z",
    homeVisibleUntil: "2026-08-31T15:00:00Z" } };
  assert.equal(buildPersistedPetals(source, "2026-08-31", fruits, Date.parse("2026-08-31T14:59:59Z"))[0].word, "夏の日");
  assert.equal(buildPersistedPetals(source, "2026-09-01", fruits, Date.parse("2026-08-31T15:00:00Z")).length, 0);
  assert.equal(buildPersistedTreeItems(source, "2026-08-31", fruits)[0].stage, "harvested");
  assert.equal(getHarvestWordForMemory(source[0].id, {}, fruits), "夏の日");
  assert.equal(getHarvestWordForMemory("not-harvested", {}, fruits), null);
});

test("each ripe fruit opens exactly its own photo's question, even when multiple fruits are ripe", () => {
  const source = photos(10).map((photo, index) => ({ ...photo, date: `202${index}-01-02`, imageUrl: `photo-${index}.jpg`, caption: `caption-${index}` }));
  const items = buildTreeItems(source, "2026-08-01", {});
  assert.equal(items.filter((item) => item.stage === "quiz-ready").length, 3);
  for (const index of [0, 1, 2]) {
    const fruit = items[index];
    const requestedId = new URL(fruit.href, "https://example.test").searchParams.get("memory");
    const quiz = getFruitQuiz(source, items, requestedId);
    assert.equal(quiz.memory.id, source[index].id);
    assert.equal(quiz.memory.imageUrl, `photo-${index}.jpg`);
    assert.equal(quiz.question.memoryId, source[index].id);
    assert.equal(quiz.question.correctChoice, `202${index}年1月`);
    assert.equal(quiz.question.hint, `caption-${index}`);
    assert.equal(Array.isArray(quiz.question), false);
  }
  const selected = getFruitQuiz(source, items, source[1].id);
  assert.deepEqual(getFruitQuiz([...source].reverse(), [...items].reverse(), source[1].id), selected);
});

test("missing, immature and harvested fruits never fall back to another question", () => {
  const source = photos(9);
  const items = buildTreeItems(source, "2026-08-01", {});
  for (const id of [null, "", "missing", source[2].id, "memory-ice-cream"]) {
    assert.equal(getFruitQuiz(source, items, id), null);
  }
  assert.equal(getFruitQuiz(source.slice(1), items, source[0].id), null);
  const harvests = recordHarvest(source, "2026-08-01", {}, source[0].id, "最初の写真");
  const after = buildTreeItems(source, "2026-08-01", harvests);
  assert.equal(getFruitQuiz(source, after, source[0].id), null);
  assert.equal(getFruitQuiz(source, after, source[1].id).question.memoryId, source[1].id);
});
