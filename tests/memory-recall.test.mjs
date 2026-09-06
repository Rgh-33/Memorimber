import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MEMORY_RECALL_STALE_MS, chooseFadingMemoryId, readMemoryRecallState, recordMemoryReview } from "../lib/memory-recall.ts";

const now = Date.parse("2026-09-04T12:00:00Z");
const petal = (id, age) => ({ id, memoryId: id, stage: "harvested", word: id, wordSlot: 0,
  harvestedAt: new Date(now - age).toISOString() });

test("only one long-unshaken memory is selected and the selection stays stable", () => {
  const petals = [petal("fresh", MEMORY_RECALL_STALE_MS - 1), petal("old-a", MEMORY_RECALL_STALE_MS), petal("old-b", MEMORY_RECALL_STALE_MS * 2)];
  assert.equal(chooseFadingMemoryId(petals, { reviewedAt: {}, featuredId: null }, now, { random: () => 0.99 }), "old-b");
  assert.equal(chooseFadingMemoryId(petals, { reviewedAt: {}, featuredId: "old-a" }, now, { random: () => 0.99 }), "old-a");
});

test("preview can feature a fresh petal immediately", () => {
  const fresh = petal("fresh", 0);
  assert.equal(chooseFadingMemoryId([fresh], { reviewedAt: {}, featuredId: null }, now, { ignoreAge: true }), "fresh");
});

test("shaking a petal postpones fading and clears its featured state", () => {
  const before = { reviewedAt: {}, featuredId: "old" };
  const reviewed = recordMemoryReview(before, "old", now);
  assert.equal(reviewed.featuredId, null);
  assert.equal(chooseFadingMemoryId([petal("old", MEMORY_RECALL_STALE_MS * 2)], reviewed, now + MEMORY_RECALL_STALE_MS - 1), null);
  assert.equal(chooseFadingMemoryId([petal("old", MEMORY_RECALL_STALE_MS * 3)], reviewed, now + MEMORY_RECALL_STALE_MS), "old");
});

test("stored recall state rejects malformed timestamps", () => {
  assert.deepEqual(readMemoryRecallState('{"reviewedAt":{"ok":123,"bad":"today"},"featuredId":"ok"}'), {
    reviewedAt: { ok: 123 }, featuredId: "ok",
  });
  assert.deepEqual(readMemoryRecallState("not json"), { reviewedAt: {}, featuredId: null });
});

test("recall restoration returns directly to the tree with a subtle purification effect", () => {
  const dialog = readFileSync(new URL("../components/memory-recall-dialog.tsx", import.meta.url), "utf8");
  const tree = readFileSync(new URL("../components/memory-tree.tsx", import.meta.url), "utf8");
  const treeCss = readFileSync(new URL("../app/konoha.css", import.meta.url), "utf8");
  const fruitQuiz = readFileSync(new URL("../components/fruit-quiz-dialog.tsx", import.meta.url), "utf8");
  const quizCss = readFileSync(new URL("../app/quiz.css", import.meta.url), "utf8");

  assert.match(dialog, /onRemembered\(\);\s*onClose\(\);/);
  assert.match(dialog, /花びらをもとに戻す/);
  assert.match(tree, /setPurifyingMemoryId\(memoryId\)/);
  assert.match(tree, /data-purifying=\{isPurifying \|\| undefined\}/);
  assert.match(treeCss, /konoha-memory-purify-haze/);
  assert.match(treeCss, /konoha-memory-purification/);
  assert.match(fruitQuiz, /data-golden-quiz=\{golden \|\| undefined\}/);
  assert.match(quizCss, /fruit-quiz-overlay\[data-golden-quiz="true"\]/);
});
