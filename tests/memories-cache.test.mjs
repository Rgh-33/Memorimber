import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addMemoryToCache, removeMemoryFromCache, updateMemoryInCache } from "../lib/memories-cache.ts";

const memory = (id, changes = {}) => ({
  id,
  date: "2026-09-04",
  imageUrl: `https://images.invalid/${id}`,
  imagePath: `user/${id}.jpg`,
  caption: id,
  people: [],
  tags: [],
  ...changes,
});

test("tab-local cache applies committed additions, updates, and removals without duplicates", () => {
  const first = memory("first");
  const second = memory("second");
  second.thumbnailUrl = "https://images.invalid/second-thumbnail";
  const added = addMemoryToCache([first], second);
  assert.deepEqual(added.map(({ id }) => id), ["second", "first"]);
  assert.equal(addMemoryToCache(added, { ...second, caption: "saved" }).filter(({ id }) => id === "second").length, 1);

  const updated = updateMemoryInCache(added, { ...second, imageUrl: "", caption: "updated" });
  assert.equal(updated[0].caption, "updated");
  assert.equal(updated[0].imageUrl, second.imageUrl);
  assert.equal(updated[0].thumbnailUrl, second.thumbnailUrl);
  assert.deepEqual(removeMemoryFromCache(updated, "second"), [first]);
});

test("an updated detail-only memory hydrates the working copy", () => {
  const hydrated = updateMemoryInCache([], memory("detail-only"));
  assert.deepEqual(hydrated.map(({ id }) => id), ["detail-only"]);
});

test("routing does not drive full memory reloads and mutation screens use cache operations", () => {
  const provider = readFileSync(new URL("../lib/memories-context.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../components/memory-form.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../app/memory/[id]/page.tsx", import.meta.url), "utf8");
  const appearance = readFileSync(new URL("../app/memory/[id]/album-settings/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(provider, /usePathname/);
  assert.match(provider, /addMemory: \(memory: Memory\) => void/);
  assert.match(provider, /updateMemory: \(memory: Memory\) => void/);
  assert.match(provider, /removeMemory: \(id: string\) => void/);
  assert.match(provider, /refreshAge >= MEMORY_IMAGE_URL_LIFETIME/);
  assert.doesNotMatch(form, /refreshMemories/);
  assert.match(form, /addMemory\(memory\)/);
  assert.match(detail, /const localMemory = previewMemory \?\? sampleMemory/);
  assert.doesNotMatch(detail, /localMemory = [^;]*cachedMemory/);
  assert.match(detail, /loadMemory\(createClient\(\), params\.id\)/);
  assert.match(detail, /updateCachedMemory\(updated\)/);
  assert.match(detail, /removeMemory\(memory\.id\)/);
  assert.doesNotMatch(detail, /void refreshMemories/);
  assert.match(appearance, /updateCachedMemory\(\{ \.\.\.memory, albumAppearance: saved \}\)/);
});
