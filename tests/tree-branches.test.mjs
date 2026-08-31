import assert from "node:assert/strict";
import test from "node:test";
import { getTreeBranch, getTreeStructure, TREE_BRANCHES_PER_PAGE, TREE_PROPORTION } from "../lib/tree-branches.ts";

test("photo tips stay in the leafy crown, away from the bare lower trunk", () => {
  for (const mirrored of [false, true]) {
    for (let index = 0; index < TREE_BRANCHES_PER_PAGE; index++) {
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
    const branches = Array.from({ length: TREE_BRANCHES_PER_PAGE }, (_, i) => getTreeBranch(i, false));
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

test("the grown tree keeps its skeleton even when more photos or pages are added", () => {
  for (const mirrored of [false, true]) {
    const grown = getTreeStructure(7, mirrored);
    assert.ok(grown.length > 0);
    for (const count of [8, 12, 13, 31, 120, 365]) {
      assert.deepEqual(getTreeStructure(count, mirrored), grown);
    }
    for (let i = 0; i < TREE_BRANCHES_PER_PAGE; i++) {
      assert.deepEqual(getTreeBranch(i + TREE_BRANCHES_PER_PAGE, mirrored), getTreeBranch(i, mirrored));
    }
  }
});
