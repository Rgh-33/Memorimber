import assert from "node:assert/strict";
import test from "node:test";
import { MEMORY_RECALL_STALE_MS, chooseFadingMemoryId, readMemoryRecallState, recordMemoryReview } from "../lib/memory-recall.ts";

const now = Date.parse("2026-09-04T12:00:00Z");
const petal = (id, age) => ({ id, memoryId: id, stage: "harvested", word: id, wordSlot: 0,
  harvestedAt: new Date(now - age).toISOString() });

test("only one long-unshaken memory is selected and the selection stays stable", () => {
  const petals = [petal("fresh", MEMORY_RECALL_STALE_MS - 1), petal("old-a", MEMORY_RECALL_STALE_MS), petal("old-b", MEMORY_RECALL_STALE_MS * 2)];
  assert.equal(chooseFadingMemoryId(petals, { reviewedAt: {}, featuredId: null }, now, () => 0.99), "old-b");
  assert.equal(chooseFadingMemoryId(petals, { reviewedAt: {}, featuredId: "old-a" }, now, () => 0.99), "old-a");
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
