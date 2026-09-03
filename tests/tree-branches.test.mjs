import assert from "node:assert/strict";
import test from "node:test";
import {
  getTreeBranch,
  getTreeAddedFruitCenter,
  getTreeAppearanceStage,
  getTreeCanvasMetrics,
  getTreeTrunkScale,
  getTreeStructure,
  getTreeShapeScale,
  getTreeVisibleCount,
  placeTreeItems,
  TREE_NODE_CAPACITY,
  TREE_PROPORTION,
  TREE_VISIBLE_CAPACITY,
} from "../lib/tree-branches.ts";
import { fruitHangAt } from "../lib/tree-fruit-layout.ts";

test("the tree exterior follows all twelve monthly upload stages beyond the fruit cap", () => {
  const stages = [
    [0, 0], [1, 1], [2, 2], [3, 3], [4, 3], [5, 4], [7, 4],
    [8, 5], [11, 5], [12, 6], [16, 6], [17, 7], [22, 7],
    [23, 8], [28, 8], [29, 9], [35, 9], [36, 10], [45, 10],
    [46, 11], [55, 11], [56, 12], [365, 12],
  ];
  stages.forEach(([photos, stage]) => assert.equal(getTreeAppearanceStage(photos), stage));
  assert.equal(getTreeVisibleCount(56), TREE_VISIBLE_CAPACITY);
});

test("the sapling silhouette grows wider and taller through the mature stages", () => {
  const stages = Array.from({ length: 10 }, (_, index) => getTreeShapeScale(index + 3));
  stages.slice(1).forEach((scale, index) => {
    assert.ok(scale.x > stages[index].x);
    assert.ok(scale.y > stages[index].y);
  });
});

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
    const viewportScale = (width - 40) / 380;
    for (const mirrored of [false, true]) {
      const fruit = Array.from({ length: TREE_NODE_CAPACITY }, (_, index) => {
        const branch = getTreeBranch(index, mirrored);
        const hang = fruitHangAt(index, mirrored);
        return {
          x: ((branch.x - 190) * TREE_PROPORTION.x + hang.x) * viewportScale,
          y: ((branch.y - 383) * TREE_PROPORTION.y + hang.y) * viewportScale,
        };
      });
      for (let i = 0; i < fruit.length; i++) {
        for (let j = i + 1; j < fruit.length; j++) {
          const dx = Math.abs(fruit[i].x - fruit[j].x);
          const dy = Math.abs(fruit[i].y - fruit[j].y);
          assert.ok(dx >= 44 || dy >= 52, `fruit ${i + 1} and ${j + 1} overlap at ${width}px`);
        }
      }
    }
  }
});

test("the added crown keeps every fruit inside one compact camera", () => {
  for (const count of [13, 15, 16, 17, 22, 23, 33, 120]) {
    const visibleCount = getTreeVisibleCount(count);
    const canvas = getTreeCanvasMetrics(count);
    assert.equal(getTreeStructure(count, false).length, visibleCount);
    for (const width of [320, 430]) {
      const viewportScale = (width - 40) / canvas.width;
      for (const mirrored of [false, true]) {
        Array.from({ length: visibleCount }, (_, index) => {
          const branch = getTreeBranch(index, mirrored);
          const hang = fruitHangAt(index, mirrored);
          const x = 190 + (branch.x - 190) * TREE_PROPORTION.x + hang.x;
          const y = 383 + (branch.y - 383) * TREE_PROPORTION.y + hang.y;
          assert.ok(x >= canvas.minX + 10 && x <= canvas.minX + canvas.width - 10,
            `fruit ${index + 1} is outside the horizontal canvas`);
          assert.ok(y >= canvas.minY + 10 && y <= canvas.minY + canvas.height - 10,
            `fruit ${index + 1} is outside the vertical canvas`);
          const screenX = (x - canvas.minX) * viewportScale;
          assert.ok(screenX >= 0 && screenX <= width - 40,
            `fruit ${index + 1} is outside the ${width}px viewport`);
        });
      }
    }
  }
});

test("the camera remains compact as later fruit fill the crown", () => {
  assert.deepEqual(getTreeCanvasMetrics(12), { minX: 0, width: 380, minY: 0, height: 420, addedTips: 0 });
  assert.deepEqual(getTreeCanvasMetrics(13), { minX: 0, width: 380, minY: -8, height: 428, addedTips: 1 });
  assert.deepEqual(getTreeCanvasMetrics(22), { minX: 0, width: 380, minY: -8, height: 428, addedTips: 10 });
  assert.deepEqual(getTreeCanvasMetrics(33), { minX: 0, width: 380, minY: -8, height: 428, addedTips: 21 });
  assert.deepEqual(getTreeCanvasMetrics(365), getTreeCanvasMetrics(33));
});

test("the trunk keeps gaining girth after all visible fruit positions are full", () => {
  assert.equal(getTreeTrunkScale(12), 1);
  assert.equal(getTreeTrunkScale(17), 1);
  assert.ok(getTreeTrunkScale(29) > 1.14);
  assert.ok(getTreeTrunkScale(46) > getTreeTrunkScale(35));
  assert.ok(Math.abs(getTreeTrunkScale(56) - 1.36) < 1e-9);
  assert.equal(getTreeTrunkScale(365), getTreeTrunkScale(56));
});

test("twigs meet a parent branch curve without a visible gap, including mirrored months", () => {
  const pointAt = (path, t) => {
    const p = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const u = 1 - t;
    return [0, 1].map(axis => u ** 3 * p[axis] + 3 * u ** 2 * t * p[axis + 2]
      + 3 * u * t ** 2 * p[axis + 4] + t ** 3 * p[axis + 6]);
  };
  for (const mirrored of [false, true]) {
    for (const index of [3, 4, 6, 7, 8, 9, 10, 11, 15, 16, 20, 21, 22, 28, 29, 30, 31]) {
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

test("the first twelve branches never move while later branches are created only as needed", () => {
  for (const mirrored of [false, true]) {
    const grown = getTreeStructure(7, mirrored);
    assert.equal(grown.length, TREE_NODE_CAPACITY);
    for (const count of [8, 12, 13, 31, 120, 365]) {
      const expanded = getTreeStructure(count, mirrored);
      assert.equal(expanded.length, Math.max(TREE_NODE_CAPACITY, getTreeVisibleCount(count)));
      assert.deepEqual(expanded.slice(0, TREE_NODE_CAPACITY), grown);
    }
  }
});

test("each added crown grows from one central tip toward balanced outer tips", () => {
  const center = (index) => {
    const branch = getTreeBranch(index, false);
    const hang = fruitHangAt(index, false);
    return 190 + (branch.x - 190) * TREE_PROPORTION.x + hang.x;
  };
  const tips = [12, 13, 14, 15, 16].map(center);
  assert.ok(Math.abs(tips[0] - 190) < 2);
  assert.ok(tips[1] < tips[0] && tips[2] > tips[0]);
  assert.ok(tips[3] < tips[1] && tips[4] > tips[2]);
});

test("all added fruit positions stay inside the compact mature crown", () => {
  const centers = Array.from({ length: TREE_VISIBLE_CAPACITY - TREE_NODE_CAPACITY }, (_, index) =>
    getTreeAddedFruitCenter(TREE_NODE_CAPACITY + index));
  const xs = centers.map(([x]) => x);
  const ys = centers.map(([, y]) => y);
  assert.equal(centers.length, 21);
  assert.ok(xs.every(x => x >= 40 && x <= 340));
  assert.ok(ys.every(y => y >= 30 && y <= 300));
  assert.equal(Math.min(...ys), centers[0][1]);
  assert.ok(Math.max(...xs) - Math.min(...xs) <= 300);
});

test("the sapling adds forks gradually before reaching the unchanged mature skeleton", () => {
  const expectedCounts = [0, 0, 0, 3, 6, 8, 10, 12];
  const expectedWidthScales = [0, 0, 0, .28, .33, .38, .42, 1];
  for (const mirrored of [false, true]) {
    const mature = getTreeStructure(7, mirrored);
    expectedCounts.forEach((count, stage) => {
      const growing = getTreeStructure(stage, mirrored);
      assert.equal(growing.length, count);
      growing.forEach((branch, index) => {
        assert.equal(branch.path, mature[index].path);
        assert.ok(Math.abs(branch.width / mature[index].width - expectedWidthScales[stage]) < 1e-9);
        if (stage < 7) assert.notEqual(branch.surface, mature[index].surface);
      });
      if (stage === 7) assert.deepEqual(growing, mature);
    });
  }
});

const photo = (n) => ({ id: `photo-${n}`, memoryId: `photo-${n}`, stage: "quiz-ready", fruitSlot: n, fruitTone: "peach", growth: 1, growthStage: 7, href: `/quiz?memory=photo-${n}` });
const collect = (items, id) => items.map(item => item.id === id
  ? { id, memoryId: id, stage: "harvested", word: "思い出", wordSlot: 0 }
  : item);

test("every active photo receives a stable visible tip as the tree expands", () => {
  for (const count of [0, 1, 7, 12, 13, 120, 365]) {
    const items = Array.from({ length: count }, (_, i) => photo(i));
    const original = structuredClone(items);
    const placed = placeTreeItems(items);
    const visibleCount = Math.min(TREE_VISIBLE_CAPACITY, count);
    assert.equal(placed.slots.length, Math.max(TREE_NODE_CAPACITY, visibleCount));
    assert.deepEqual(placed.visibleItems.map(item => item.id), items.slice(0, visibleCount).map(item => item.id));
    assert.equal(new Set(placed.visibleItems.map(item => item.fruitSlot)).size, placed.visibleItems.length);
    assert.deepEqual(items, original);
  }
});

test("the first photo beyond the visible limit waits internally and fills the first harvested position", () => {
  let items = Array.from({ length: TREE_VISIBLE_CAPACITY + 2 }, (_, i) => photo(i));
  let placed = placeTreeItems(items);
  assert.equal(placed.visibleItems.length, TREE_VISIBLE_CAPACITY);
  assert.ok(!placed.visibleItems.some(item => item.id === `photo-${TREE_VISIBLE_CAPACITY}`
    || item.id === `photo-${TREE_VISIBLE_CAPACITY + 1}`));
  const before = [...placed.slots];
  items = collect(items, "photo-7");
  placed = placeTreeItems(items, placed.slots);
  assert.equal(placed.slots[7], `photo-${TREE_VISIBLE_CAPACITY}`);
  before.forEach((id, index) => { if (index !== 7) assert.equal(placed.slots[index], id); });
  assert.ok(!placed.visibleItems.some(item => item.id === `photo-${TREE_VISIBLE_CAPACITY + 1}`));
});

test("a later upload reuses a harvested tip without moving the other fruit", () => {
  let items = Array.from({ length: 16 }, (_, i) => photo(i));
  let placed = placeTreeItems(items);
  for (const [removed, slot, replacement] of [[5, 5, 16], [2, 2, 17]]) {
    const before = [...placed.slots];
    items = collect(items, `photo-${removed}`);
    placed = placeTreeItems(items, placed.slots);
    assert.equal(placed.slots[slot], null);
    before.forEach((id, i) => { if (i !== slot) assert.equal(placed.slots[i], id); });
    items.push(photo(replacement));
    placed = placeTreeItems(items, placed.slots);
    assert.equal(placed.slots[slot], `photo-${replacement}`);
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
  const occupied = repaired.slots.filter(Boolean);
  assert.equal(occupied.length, 15);
  assert.equal(new Set(occupied).size, occupied.length);
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
    assert.equal(placed.visibleItems.length, Math.min(TREE_VISIBLE_CAPACITY, 365 - harvested.size));
  }
  assert.equal(harvested.size, 365);
  assert.equal(items.length, 365);
  assert.ok(placed.slots.every(id => id === null));
});
