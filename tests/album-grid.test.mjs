import assert from "node:assert/strict";
import test from "node:test";
import { getAlbumFirstColumn, orderAlbumMemories } from "../lib/album-grid.ts";

const memory = (id, date, createdAt = undefined) => ({ id, date, createdAt, imageUrl: "photo.jpg", caption: id, people: [], tags: [] });

test("album chronology ends with the newest photo", () => {
  const ordered = orderAlbumMemories([
    memory("newest", "2026-09-03"),
    memory("oldest", "2026-09-01"),
    memory("same-day-later", "2026-09-02", "2026-09-02T12:00:02Z"),
    memory("same-day-earlier", "2026-09-02", "2026-09-02T12:00:01Z"),
  ]);
  assert.deepEqual(ordered.map((item) => item.id), ["oldest", "same-day-earlier", "same-day-later", "newest"]);
});

test("partial oldest row is right aligned so newest is bottom-right", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(getAlbumFirstColumn), [3, 2, 1, 3, 2, 1]);
});
