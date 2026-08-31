import assert from "node:assert/strict";
import test from "node:test";
import { getTreeBranch, getTreeStructure, placeTreeItems, TREE_NODE_CAPACITY, TREE_PROPORTION } from "../lib/tree-branches.ts";

test("photo tips stay in the leafy crown, away from the bare lower trunk", () => {
  for (const mirrored of [false, true]) {
    for (let index = 0; index < TREE_NODE_CAPACITY; index++) {
      const branch = getTreeBranch(index, mirrored);
      assert.ok(branch.x >= 45 && branch.x <= 335);
      assert.ok(branch.y >= 60 && branch.y <= 240);
      if (index >= 7) assert.ok(branch.origin[1] <= 265);
      const reflected = getTreeBranch(index, !mirrored);
      assert.equal(branch.x + reflected.x, 380);
      assert.equal(branch.y, reflected.y);
    }
  }
});

test("all ripe fruit touch areas remain separate at 320px and 430px screen widths", () => {
  for (const width of [320, 430]) {
    const scale = (width - 40) / 380;
    const branches = Array.from({ length: TREE_NODE_CAPACITY }, (_, i) => getTreeBranch(i, false));
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const dx = Math.abs(branches[i].x - branches[j].x) * scale * TREE_PROPORTION.x;
        const dy = Math.abs(branches[i].y - branches[j].y) * scale * TREE_PROPORTION.y;
        assert.ok(dx >= 44 || dy >= 52, `fruit ${i + 1} and ${j + 1} overlap at ${width}px`);
      }
    }
  }
});

test("twigs meet a parent branch curve without a visible gap, including mirrored months", () => {
  const pointAt = (path, t) => {
    const p = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const u = 1 - t;
    return [0, 1].map(axis => u ** 3 * p[axis] + 3 * u ** 2 * t * p[axis + 2]
      + 3 * u * t ** 2 * p[axis + 4] + t ** 3 * p[axis + 6]);
  };
  for (const mirrored of [false, true]) {
    for (const index of [3, 4, 6, 7, 8, 9, 10, 11]) {
      const { origin } = getTreeBranch(index, mirrored);
      let nearest = Infinity;
      for (let parent = 0; parent < index; parent++) {
        const { path } = getTreeBranch(parent, mirrored);
        for (let step = 0; step <= 1000; step++) {
          const point = pointAt(path, step / 1000);
          nearest = Math.min(nearest, Math.hypot(point[0] - origin[0], point[1] - origin[1]));
        }
      }
      assert.ok(nearest < .25, `branch ${index + 1} is detached by ${nearest}px`);
    }
  }
});

test("the grown tree keeps its skeleton even when more photos are added", () => {
  for (const mirrored of [false, true]) {
    const grown = getTreeStructure(7, mirrored);
    assert.ok(grown.length > 0);
    for (const count of [8, 12, 13, 31, 120, 365]) {
      assert.deepEqual(getTreeStructure(count, mirrored), grown);
    }
  }
});

const photo = (n) => ({ id: `photo-${n}`, memoryId: `photo-${n}`, stage: "quiz-ready", fruitSlot: n, fruitTone: "peach", growth: 1, growthStage: 7, href: `/quiz?memory=photo-${n}` });
const collect = (items, id) => items.map(item => item.id === id
  ? { id, memoryId: id, stage: "harvested", word: "思い出", wordSlot: 0 }
  : item);

test("a full tree keeps the oldest photos and never expands or mutates the waiting queue", () => {
  for (const count of [0, 1, 7, 12, 13, 120, 365]) {
    const items = Array.from({ length: count }, (_, i) => photo(i));
    const original = structuredClone(items);
    const placed = placeTreeItems(items);
    assert.equal(placed.slots.length, TREE_NODE_CAPACITY);
    assert.deepEqual(placed.visibleItems.map(item => item.id), items.slice(0, TREE_NODE_CAPACITY).map(item => item.id));
    assert.equal(new Set(placed.visibleItems.map(item => item.fruitSlot)).size, placed.visibleItems.length);
    assert.deepEqual(items, original);
  }
});

test("harvesting arbitrary fruit reuses that exact tip for the oldest waiting photo", () => {
  let items = Array.from({ length: 16 }, (_, i) => photo(i));
  let placed = placeTreeItems(items);
  for (const [removed, slot, replacement] of [[5, 5, 12], [2, 2, 13]]) {
    const before = [...placed.slots];
    items = collect(items, `photo-${removed}`);
    placed = placeTreeItems(items, placed.slots);
    assert.equal(placed.slots[slot], `photo-${replacement}`);
    before.forEach((id, i) => { if (i !== slot) assert.equal(placed.slots[i], id); });
    const next = placed.visibleItems.find(item => item.fruitSlot === slot);
    assert.equal(next.memoryId, `photo-${replacement}`);
    assert.equal(next.href, `/quiz?memory=photo-${replacement}`);
  }
});

test("a vacant tip stays vacant until a new photo arrives; other fruit do not slide over", () => {
  let items = [photo(0), photo(1), photo(2)];
  let placed = placeTreeItems(items);
  items = collect(items, "photo-1");
  placed = placeTreeItems(items, placed.slots);
  assert.equal(placed.slots[1], null);
  assert.equal(placed.visibleItems.find(item => item.id === "photo-2").fruitSlot, 2);
  items.push({ ...photo(3), stage: "growing", growth: 0, growthStage: 1, href: undefined });
  placed = placeTreeItems(items, placed.slots);
  assert.equal(placed.slots[1], "photo-3");
  assert.equal(placed.visibleItems.find(item => item.id === "photo-3").growthStage, 1);
  const matured = items.map(item => item.id === "photo-3" ? photo(3) : item);
  const grown = placeTreeItems(matured, placed.slots);
  assert.deepEqual(grown.slots, placed.slots);
  assert.equal(grown.visibleItems.find(item => item.id === "photo-3").stage, "quiz-ready");
});

test("saved placements survive reload, and stale or repeated IDs cannot duplicate fruit", () => {
  let items = Array.from({ length: 16 }, (_, i) => photo(i));
  const initial = placeTreeItems(items);
  items = collect(items, "photo-5");
  const placed = placeTreeItems(items, initial.slots);
  assert.deepEqual(placeTreeItems(items, JSON.parse(JSON.stringify(placed.slots))), placed);
  const repaired = placeTreeItems(items, ["missing", "photo-5", "photo-0", "photo-0"]);
  assert.equal(repaired.slots[2], "photo-0");
  assert.equal(new Set(repaired.slots).size, TREE_NODE_CAPACITY);
  assert.ok(!repaired.slots.includes("photo-5"));
});

test("a backlog can be fully harvested from one tree without losing or repeating a photo", () => {
  let items = Array.from({ length: 365 }, (_, i) => photo(i));
  let placed = placeTreeItems(items);
  const harvested = new Set();
  while (placed.visibleItems.length) {
    const item = placed.visibleItems[placed.visibleItems.length - 1];
    assert.ok(!harvested.has(item.id));
    harvested.add(item.id);
    items = collect(items, item.id);
    placed = placeTreeItems(items, placed.slots);
    assert.ok(placed.visibleItems.length <= TREE_NODE_CAPACITY);
  }
  assert.equal(harvested.size, 365);
  assert.equal(items.length, 365);
  assert.ok(placed.slots.every(id => id === null));
});
