import assert from "node:assert/strict";
import test from "node:test";
import {
  getTreeAppearanceStage,
  getTreeGrowthModel,
  getTreeSlot,
  getTreeVisibleCount,
  placeTreeItems,
  TREE_PROPORTION,
} from "../lib/tree-branches.ts";
import { fruitHangAt } from "../lib/tree-fruit-layout.ts";

test("tree stages follow the requested individual and grouped upload ranges", () => {
  const stages = [
    [0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7],
    [8, 8], [12, 8], [13, 9], [18, 9], [19, 10], [24, 10],
    [25, 11], [31, 11], [32, 12], [38, 12], [39, 13], [45, 13], [46, 14],
  ];
  stages.forEach(([photos, stage]) => assert.equal(getTreeAppearanceStage(photos), stage));
  assert.equal(getTreeVisibleCount(365), 365);
});

test("classic mode restores the fixed twelve-tip tree from main", () => {
  const expectedSlots = [
    [80, 238], [302, 214], [145, 74], [310, 141], [75, 162], [224, 91],
    [75, 82], [295, 63], [155, 150], [230, 166], [154, 228], [226, 239],
  ];
  const expectedBranches = [0, 0, 0, 5, 8, 10, 12, 12];
  const expectedScales = [.18, .18, .32, .47, .61, .76, .89, 1];
  for (let count = 0; count <= 7; count++) {
    const model = getTreeGrowthModel(count, "classic");
    assert.equal(model.mode, "classic");
    assert.equal(model.stage, count);
    assert.equal(model.capacity, 12);
    assert.equal(model.branches.length, expectedBranches[count]);
    assert.equal(model.contentScale, expectedScales[count]);
    assert.deepEqual(model.canvas, { minX: 0, width: 380, minY: 0, height: 420, addedTips: 0 });
    assert.deepEqual(model.slots, expectedSlots);
  }
  const full = getTreeGrowthModel(42, "classic");
  assert.equal(full.stage, 7);
  assert.equal(full.branches.length, 12);
  assert.deepEqual(full.slots, expectedSlots);
  assert.equal(getTreeVisibleCount(42, "classic"), 12);
  assert.equal(getTreeVisibleCount(42, "expanding"), 42);
});

test("five, six and seven photos keep one branch topology while growing continuously", () => {
  const models = [5, 6, 7].map(getTreeGrowthModel);
  models.forEach(model => assert.equal(model.capacity, 7));
  assert.deepEqual(models[0].branches.map(branch => branch.id), models[1].branches.map(branch => branch.id));
  assert.deepEqual(models[1].branches.map(branch => branch.id), models[2].branches.map(branch => branch.id));
  assert.deepEqual(models.map(model => model.branches.length), [13, 13, 13]);
  assert.deepEqual(models.map(model => model.canopy.length), [7, 11, 13]);

  for (let stage = 1; stage < models.length; stage++) {
    assert.ok(models[stage].trunk.scaleX > models[stage - 1].trunk.scaleX);
    assert.ok(models[stage].trunk.scaleY > models[stage - 1].trunk.scaleY);
    models[stage].branches.forEach((branch, index) => {
      const previous = models[stage - 1].branches[index];
      assert.ok(branch.width > previous.width);
      const oldDirection = Math.sign(previous.x - previous.origin[0]);
      const newDirection = Math.sign(branch.x - branch.origin[0]);
      if (oldDirection !== 0 && newDirection !== 0) assert.equal(newDirection, oldDirection);
    });
  }
  assert.deepEqual(models[2].slots, [
    [198, 182], [94.16000000000001, 97], [278.84, 110], [98.16000000000001, 280],
    [284.84, 277], [111.03999999999999, 198], [276.96000000000004, 198],
  ]);
});

test("eight through twelve photos use exactly one fixed tree skeleton", () => {
  const geometry = (count) => {
    const model = getTreeGrowthModel(count);
    return { capacity: model.capacity, slots: model.slots, branches: model.branches,
      canopy: model.canopy, canvas: model.canvas, trunk: model.trunk };
  };
  const mature = geometry(8);
  for (let count = 9; count <= 12; count++) assert.deepEqual(geometry(count), mature);
});

test("mature fruit are subtly scattered and remain deterministic", () => {
  for (const count of [12, 18, 24, 31, 38, 45, 101]) {
    const model = getTreeGrowthModel(count);
    assert.deepEqual(model.slots, getTreeGrowthModel(count).slots);
    const fruitCenters = model.slots.map((slot, index) => {
      const hang = fruitHangAt(index, false);
      return [slot[0] + hang.x, slot[1] + hang.y];
    });
    const rowCount = count <= 12 ? 3 : count <= 18 ? 4 : count <= 24 ? 5 : count <= 31 ? 6 : 6 + (model.stage - 11) * 2;
    assert.ok(new Set(fruitCenters.map(([, y]) => y.toFixed(3))).size > rowCount);
  }
});

test("scattered fruit stay attached to their terminal branches", () => {
  for (const count of [12, 31, 45, 101]) {
    const model = getTreeGrowthModel(count);
    const terminalBranches = new Map(model.branches.filter(branch => branch.id.startsWith("tip-"))
      .map(branch => [Number(branch.id.slice(4)), branch]));
    model.slots.forEach(([x, y], slot) => {
      const branch = terminalBranches.get(slot);
      assert.ok(branch);
      assert.equal(branch.x, x);
      assert.equal(branch.y, y);
    });
  }
});

test("later photos grow the whole tree only at band boundaries", () => {
  const geometry = (count) => {
    const model = getTreeGrowthModel(count);
    return { capacity: model.capacity, slots: model.slots, branches: model.branches,
      canopy: model.canopy, minY: model.canvas.minY, height: model.canvas.height, trunk: model.trunk };
  };
  for (const [first, last] of [[13, 18], [19, 24], [25, 31], [32, 38], [39, 45]]) {
    const expected = geometry(first);
    for (let count = first + 1; count <= last; count++) assert.deepEqual(geometry(count), expected);
  }
  assert.deepEqual([18, 24, 31, 38, 45].map(count => getTreeGrowthModel(count).capacity), [18, 24, 31, 38, 45]);
});

test("mature stages increase trunk, branches, crown reach and vertical canvas together", () => {
  const models = [12, 18, 24, 31, 38, 45].map(getTreeGrowthModel);
  models.slice(1).forEach((model, index) => {
    const previous = models[index];
    assert.ok(model.trunk.scaleX > previous.trunk.scaleX);
    assert.ok(model.branches.length > previous.branches.length);
    assert.ok(model.canopy.length > previous.canopy.length);
    assert.ok(model.canvas.height > previous.canvas.height);
    const crownWidth = Math.max(...model.canopy.map(clump => clump.x)) - Math.min(...model.canopy.map(clump => clump.x));
    const previousWidth = Math.max(...previous.canopy.map(clump => clump.x)) - Math.min(...previous.canopy.map(clump => clump.x));
    assert.ok(crownWidth >= previousWidth);
  });
});

test("the 31-photo crown is rounded rather than an upright or inverted triangle", () => {
  const model = getTreeGrowthModel(31);
  const rows = new Map();
  model.canopy.filter(clump => clump.id.startsWith("leaf-")).forEach(clump => {
    const row = Number(clump.id.split("-")[1]);
    const values = rows.get(row) ?? [];
    values.push(clump.x);
    rows.set(row, values);
  });
  const widths = [...rows.entries()].sort(([a], [b]) => a - b)
    .map(([, xs]) => Math.max(...xs) - Math.min(...xs));
  assert.equal(widths.length, 6);
  assert.ok(Math.max(...widths.slice(1, -1)) >= widths[0]);
  assert.ok(Math.max(...widths.slice(1, -1)) >= widths.at(-1));
  assert.ok(widths.slice(1, -1).filter(width => width >= 300).length >= 3);
});

test("every generated branch and slot remains finite and inside its tree scene", () => {
  for (const count of [3, 5, 8, 13, 19, 25, 31, 32, 45, 101]) {
    const model = getTreeGrowthModel(count);
    model.branches.forEach(branch => {
      assert.ok([branch.x, branch.y, branch.width, ...branch.origin].every(Number.isFinite));
      assert.ok(branch.path.startsWith(`M${branch.origin.join(" ")} C`));
      assert.match(branch.surface, /^M.+Z$/);
    });
    model.slots.forEach(([x, y]) => {
      assert.ok(x >= 10 && x <= 370);
      assert.ok(y >= model.canvas.minY + 10 && y <= 380);
    });
  }
});

function renderedTarget(model, index, mirrored, width) {
  const slot = getTreeSlot(model, index, mirrored);
  const hang = fruitHangAt(index, mirrored);
  const localX = slot.x + hang.x / model.contentScale;
  const localY = slot.y + 14 + (9 + hang.y) / model.contentScale;
  const proportionalX = 190 + (localX - 190) * TREE_PROPORTION.x;
  const proportionalY = 383 + (localY - 383) * TREE_PROPORTION.y;
  const targetX = 190 + (proportionalX - 190) * model.contentScale;
  const targetY = 383 + (proportionalY - 383) * model.contentScale;
  const scale = width / model.canvas.width;
  return { x: (targetX - model.canvas.minX) * scale, y: (targetY - model.canvas.minY) * scale };
}

test("all fruit keep separate 44 by 52 pixel targets on phone widths", () => {
  for (const [count, mode] of [[12, "classic"], [12, "expanding"], [18, "expanding"],
    [24, "expanding"], [31, "expanding"], [38, "expanding"], [45, "expanding"], [101, "expanding"]]) {
    const model = getTreeGrowthModel(count, mode);
    for (const width of [320, 430]) {
      const scale = width / model.canvas.width;
      for (const mirrored of [false, true]) {
        const fruit = Array.from({ length: Math.min(count, model.capacity) }, (_, index) => renderedTarget(model, index, mirrored, width));
        fruit.forEach((point, index) => {
          assert.ok(point.x >= 22 && point.x <= width - 22, `fruit ${index + 1} leaves the horizontal target area`);
          assert.ok(point.y >= 26 && point.y <= model.canvas.height * scale - 26, `fruit ${index + 1} leaves the vertical target area`);
        });
        for (let i = 0; i < fruit.length; i++) {
          for (let j = i + 1; j < fruit.length; j++) {
            const dx = Math.abs(fruit[i].x - fruit[j].x);
            const dy = Math.abs(fruit[i].y - fruit[j].y);
            assert.ok(dx >= 44 || dy >= 52, `fruit ${i + 1} and ${j + 1} overlap at ${mode}/${count}/${width}px`);
          }
        }
      }
    }
  }
});

test("mirrored months reflect slots around the same trunk", () => {
  const model = getTreeGrowthModel(45);
  model.slots.forEach((_, index) => {
    const normal = getTreeSlot(model, index, false);
    const mirrored = getTreeSlot(model, index, true);
    assert.equal(normal.x + mirrored.x, 380);
    assert.equal(normal.y, mirrored.y);
  });
});

const photo = (n) => ({ id: `photo-${n}`, memoryId: `photo-${n}`, stage: "quiz-ready", fruitSlot: n,
  fruitTone: "peach", growth: 1, growthStage: 7, href: `/quiz?memory=photo-${n}` });
const collect = (items, id) => items.map(item => item.id === id
  ? { id, memoryId: id, stage: "harvested", word: "思い出", wordSlot: 0 }
  : item);

test("classic mode queues fruit after twelve and fills a harvested branch", () => {
  let items = Array.from({ length: 13 }, (_, index) => photo(index));
  let placed = placeTreeItems(items, [], 12);
  assert.equal(placed.slots.length, 12);
  assert.deepEqual(placed.visibleItems.map((item) => item.id), items.slice(0, 12).map((item) => item.id));

  items = collect(items, "photo-3");
  placed = placeTreeItems(items, placed.slots, 12);
  assert.equal(placed.visibleItems.length, 12);
  assert.equal(placed.slots[3], "photo-12");
  assert.equal(placed.visibleItems.find((item) => item.id === "photo-12").fruitSlot, 3);
});

test("all active photos receive a stable visible slot without a capacity limit", () => {
  for (const count of [0, 1, 7, 12, 31, 38, 101, 365]) {
    const items = Array.from({ length: count }, (_, index) => photo(index));
    const placed = placeTreeItems(items);
    assert.equal(placed.visibleItems.length, count);
    assert.equal(placed.slots.length, count);
    assert.deepEqual(placed.visibleItems.map(item => item.id), items.map(item => item.id));
    assert.equal(new Set(placed.visibleItems.map(item => item.fruitSlot)).size, count);
  }
});

test("harvesting leaves one stable hole and the next upload reuses it", () => {
  let items = Array.from({ length: 45 }, (_, index) => photo(index));
  let placed = placeTreeItems(items);
  const before = [...placed.slots];
  items = collect(items, "photo-7");
  placed = placeTreeItems(items, placed.slots);
  assert.equal(placed.slots[7], null);
  before.forEach((id, index) => { if (index !== 7) assert.equal(placed.slots[index], id); });

  items.push(photo(45));
  placed = placeTreeItems(items, placed.slots);
  assert.equal(placed.slots[7], "photo-45");
  assert.equal(placed.visibleItems.find(item => item.id === "photo-45").fruitSlot, 7);
});

test("deleting a memory across a growth boundary repairs slots to the smaller tree", () => {
  let items = Array.from({ length: 39 }, (_, index) => photo(index));
  const initial = placeTreeItems(items);
  items = items.filter(item => item.id !== "photo-7");
  const placed = placeTreeItems(items, initial.slots);
  assert.equal(placed.slots.length, 38);
  assert.equal(placed.visibleItems.length, 38);
  assert.ok(placed.visibleItems.every(item => item.fruitSlot < getTreeGrowthModel(38).capacity));
  assert.equal(new Set(placed.visibleItems.map(item => item.id)).size, 38);
});

test("saved placements recover without stale or duplicate memory ids", () => {
  let items = Array.from({ length: 38 }, (_, index) => photo(index));
  const initial = placeTreeItems(items);
  items = collect(items, "photo-5");
  const placed = placeTreeItems(items, initial.slots);
  assert.deepEqual(placeTreeItems(items, JSON.parse(JSON.stringify(placed.slots))), placed);
  const repaired = placeTreeItems(items, ["missing", "photo-5", "photo-0", "photo-0"]);
  const occupied = repaired.slots.filter(Boolean);
  assert.equal(occupied.length, 37);
  assert.equal(new Set(occupied).size, occupied.length);
  assert.ok(!occupied.includes("photo-5"));
});
