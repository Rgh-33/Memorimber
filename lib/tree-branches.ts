import type { MemoryTreeItem } from "./tree-data";

type Point = readonly [number, number];
type TreeBranch = { tip: Point; origin: Point | { branch: number; at: number }; bend: Point; shoulder: Point; width: number };

// A permanent crown, independent of photo count. Photos occupy
// its tips; they never create extra boughs once the tree is grown.
const BRANCHES: readonly TreeBranch[] = [
  { tip: [80, 238], origin: [188, 282], bend: [150, 269], shoulder: [129, 242], width: 14 },
  { tip: [302, 214], origin: [197, 267], bend: [236, 232], shoulder: [273, 242], width: 15 },
  { tip: [145, 74], origin: [185, 248], bend: [142, 209], shoulder: [170, 139], width: 13 },
  { tip: [310, 141], origin: { branch: 1, at: .52 }, bend: [287, 216], shoulder: [287, 175], width: 5 },
  { tip: [75, 162], origin: { branch: 0, at: .6 }, bend: [105, 230], shoulder: [86, 203], width: 5 },
  { tip: [224, 91], origin: [209, 225], bend: [236, 192], shoulder: [216, 136], width: 12 },
  { tip: [75, 82], origin: { branch: 4, at: .6 }, bend: [77, 171], shoulder: [69, 132], width: 3 },
  { tip: [295, 63], origin: { branch: 3, at: .52 }, bend: [311, 162], shoulder: [314, 114], width: 3 },
  { tip: [155, 150], origin: { branch: 2, at: .35 }, bend: [132, 175], shoulder: [136, 162], width: 3.5 },
  { tip: [230, 166], origin: { branch: 5, at: .36 }, bend: [224, 173], shoulder: [239, 170], width: 3.5 },
  { tip: [154, 228], origin: { branch: 0, at: .4 }, bend: [149, 251], shoulder: [158, 233], width: 3 },
  { tip: [226, 239], origin: { branch: 1, at: .32 }, bend: [233, 246], shoulder: [232, 249], width: 3 },
];

export const TREE_NODE_CAPACITY = BRANCHES.length;
export const TREE_PROPORTION = { x: .98, y: 1.06 } as const;

/** Keep occupied tips still and reuse only vacant tips, oldest waiting photo
 * first. The full photo queue remains separate from this one tree's display. */
export function placeTreeItems(items: MemoryTreeItem[], previousSlots: readonly (string | null)[] = []) {
  const pending = new Map(items.flatMap(item => item.stage === "harvested" ? [] : [[item.id, item] as const]));
  const assigned = new Set<string>();
  const slots = Array.from({ length: TREE_NODE_CAPACITY }, (_, index) => {
    const id = previousSlots[index];
    if (!id || !pending.has(id) || assigned.has(id)) return null;
    assigned.add(id);
    return id;
  });
  const waiting = [...pending.keys()].filter(id => !assigned.has(id));
  let next = 0;
  for (let slot = 0; slot < slots.length && next < waiting.length; slot++) {
    if (slots[slot] === null) slots[slot] = waiting[next++];
  }
  const visibleItems = slots.flatMap((id, fruitSlot) => {
    const item = id ? pending.get(id) : undefined;
    return item ? [{ ...item, fruitSlot }] : [];
  });
  return { slots, visibleItems };
}

function branchOrigin(branch: TreeBranch): Point {
  if (!("branch" in branch.origin)) return branch.origin;
  const parent = BRANCHES[branch.origin.branch];
  const start = branchOrigin(parent);
  const t = branch.origin.at;
  const u = 1 - t;
  const coordinate = (axis: 0 | 1) => u ** 3 * start[axis]
    + 3 * u ** 2 * t * parent.bend[axis] + 3 * u * t ** 2 * parent.shoulder[axis]
    + t ** 3 * (parent.tip[axis] + (axis === 1 ? 14 : 0));
  return [coordinate(0), coordinate(1)];
}

export function getTreeBranch(index: number, mirrored: boolean) {
  const branch = BRANCHES[index % BRANCHES.length];
  const flip = ([x, y]: Point): Point => [mirrored ? 380 - x : x, y];
  const [x, y] = flip(branch.tip);
  const origin = flip(branchOrigin(branch));
  const bend = flip(branch.bend);
  const shoulder = flip(branch.shoulder);
  const end: Point = [x, y + 14];
  const sides: Point[][] = [[], []];
  // A tapered wooden surface instead of a constant-width line. The tangent
  // normal keeps the bark continuous even where a bough curves back on itself.
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const u = 1 - t;
    const p = [0, 1].map(axis => u ** 3 * origin[axis] + 3 * u ** 2 * t * bend[axis]
      + 3 * u * t ** 2 * shoulder[axis] + t ** 3 * end[axis]);
    const d = [0, 1].map(axis => 3 * u ** 2 * (bend[axis] - origin[axis])
      + 6 * u * t * (shoulder[axis] - bend[axis]) + 3 * t ** 2 * (end[axis] - shoulder[axis]));
    const radius = (branch.width * (1 - t) ** 1.35 + .65) / 2;
    const length = Math.hypot(d[0], d[1]) || 1;
    for (const side of [0, 1]) {
      const sign = side === 0 ? 1 : -1;
      sides[side].push([p[0] - sign * d[1] / length * radius, p[1] + sign * d[0] / length * radius]);
    }
  }
  const outline = [...sides[0], ...sides[1].reverse()].map(p => p.map(v => v.toFixed(2)).join(" "));
  return { x, y, origin, width: branch.width,
    path: `M${origin.join(" ")} C${bend.join(" ")} ${shoulder.join(" ")} ${x} ${y + 14}`,
    surface: `M${outline.join(" L")}Z` };
}

export function getTreeStructure(count: number, mirrored: boolean) {
  const stage = Math.max(0, Math.min(7, Math.floor(count)));
  // A young tree forks a little at a time. Seven uploads still reveal the
  // exact same twelve-bough mature skeleton used by every later upload.
  const boughCount = [0, 0, 0, 3, 6, 8, 10, 12][stage];
  return Array.from({ length: boughCount }, (_, index) => getTreeBranch(index, mirrored));
}
