import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FRUIT_VARIETY_POOL, fruitAppearanceFor, fruitHangAt } from "../lib/tree-fruit-layout.ts";

test("each photo gets a varied but refresh-stable fruit appearance", () => {
  const ids = Array.from({ length: 256 }, (_, index) => `photo-${index}`);
  const first = ids.map(fruitAppearanceFor);
  const second = ids.map(fruitAppearanceFor);
  assert.deepEqual(second, first);
  assert.deepEqual(new Set(first.map(item => item.variety)), new Set(FRUIT_VARIETY_POOL));
  assert.ok(first.every(item => item.tilt >= -6 && item.tilt <= 6));
  assert.ok(first.every(item => item.size >= .93 && item.size <= 1.07));
  assert.ok(new Set(first.map(item => `${item.variety}:${item.tilt}:${item.size}`)).size > 40);
});

test("fruit hang at different heights and mirror with their tree", () => {
  const normal = Array.from({ length: 12 }, (_, slot) => fruitHangAt(slot, false));
  const mirrored = Array.from({ length: 12 }, (_, slot) => fruitHangAt(slot, true));
  assert.ok(new Set(normal.map(item => item.y)).size >= 8);
  normal.forEach((item, index) => assert.deepEqual(mirrored[index], { x: -item.x, y: item.y }));
});

test("the tree uses all eight supplied memory-fruit SVGs", () => {
  const component = readFileSync(new URL("../components/tree-fruit.tsx", import.meta.url), "utf8");
  const assets = ["star", "acorn", "bloom", "cluster", "drop", "geode", "heart", "moon"];

  assert.equal(FRUIT_VARIETY_POOL.length, 8);
  assert.equal(new Set(FRUIT_VARIETY_POOL).size, 8);
  for (const asset of assets) {
    assert.match(component, new RegExp(`/memory-fruits/memory-${asset}\\.svg`));
    assert.match(readFileSync(new URL(`../public/memory-fruits/memory-${asset}.svg`, import.meta.url), "utf8"), /^<svg\b/);
  }
});
