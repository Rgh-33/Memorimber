import type { MemoryTreeItem } from "./tree-data";

type Point = readonly [number, number];
type TreeBranch = { tip: Point; origin: Point | { branch: number; at: number }; bend: Point; shoulder: Point; width: number };

// The first twelve tips are the existing mature tree and must not move.
const BASE_BRANCHES: readonly TreeBranch[] = [
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

export const TREE_NODE_CAPACITY = BASE_BRANCHES.length;
export const TREE_PROPORTION = { x: .98, y: 1.06 } as const;

export const TREE_VISIBLE_CAPACITY = 33;
export const TREE_SLOT_STORAGE_LIMIT = TREE_VISIBLE_CAPACITY;

// Added tips form an upright triangle: a narrow crown at the top, then pairs
// that become progressively wider toward the lower skirt. The order matters;
// it lets the silhouette keep growing downward and outward without ever
// becoming an inverted triangle.
// Coordinates describe the leaf/fruit anchor before the fruit's own 23px
// hanging stem is added.
const EXTRA_FRUIT_CENTERS: readonly Point[] = [
  [190, 30], [120, 90], [260, 90],
  [105, 145], [275, 145], [35, 200], [345, 200],
  [0, 250], [380, 250], [-75, 285], [455, 285],
  [150, 125], [230, 125], [115, 180], [265, 180],
  [110, 220], [270, 220], [-120, 315], [500, 315],
  [155, 300], [225, 300],
];

// Every added limb grows from the trunk or an already-connected bough. This
// keeps even the exaggerated outer silhouette botanically plausible.
const EXTRA_BRANCH_ORIGINS: readonly TreeBranch["origin"][] = [
  [190, 218], { branch: 2, at: .48 }, { branch: 5, at: .48 },
  { branch: 0, at: .48 }, { branch: 1, at: .48 },
  { branch: 4, at: .52 }, { branch: 3, at: .52 },
  { branch: 6, at: .42 }, { branch: 7, at: .42 },
  { branch: 17, at: .62 }, { branch: 18, at: .62 },
  { branch: 0, at: .38 }, { branch: 1, at: .38 }, [190, 260],
  { branch: 13, at: .56 }, { branch: 14, at: .56 },
  { branch: 19, at: .58 }, { branch: 20, at: .58 },
  { branch: 0, at: .3 }, { branch: 1, at: .3 }, [190, 300],
];

const EXTRA_BRANCH_WIDTHS = [
  3.35, 2.75, 2.75, 2.3, 2.3, 2.1, 2.1,
  1.85, 1.85, 1.55, 1.55, 1.8, 1.8, 2.15,
  1.45, 1.45, 1.25, 1.25, 1.55, 1.55, 1.65,
] as const;
// Keep these twelve offsets in step with tree-fruit-layout. They are repeated
// here so this geometry module remains dependency-free in Node's type-stripped
// tests as well as in the browser bundle.
const FRUIT_HANG_OFFSETS = [
  [-8, 8], [10, 5], [-3, -8], [6, -2], [-9, 1], [2, -8],
  [-10, -8], [9, -10], [-2, 4], [4, 7], [-2, 9], [3, 11],
] as const;
const GENERATED_BRANCHES: TreeBranch[] = [...BASE_BRANCHES];
type RenderedBranch = { x: number; y: number; origin: Point; width: number; path: string; surface: string };
const RENDERED_BRANCHES = new Map<string, RenderedBranch>();

export function getTreeVisibleCount(count: number) {
  return Math.min(TREE_VISIBLE_CAPACITY, Math.max(0, Math.floor(count)));
}

export function getTreeAddedFruitCenter(index: number): Point {
  const offset = Math.max(0, Math.min(EXTRA_FRUIT_CENTERS.length - 1,
    Math.floor(index) - TREE_NODE_CAPACITY));
  return EXTRA_FRUIT_CENTERS[offset];
}

export function getTreeTrunkScale(count: number) {
  const photos = getTreeVisibleCount(count);
  const smoothstep = (value: number) => {
    const progress = Math.max(0, Math.min(1, value));
    return progress * progress * (3 - 2 * progress);
  };
  // Once the added crown is carrying several fruit, the established trunk
  // gains girth without moving its roots, forks, or the outer crown.
  const matureGrowth = smoothstep((photos - 20) / 16) * .24;
  const elderGrowth = smoothstep((photos - 36) / 36) * .12;
  return 1 + matureGrowth + elderGrowth;
}

export function getTreeCanvasMetrics(count: number) {
  const photos = getTreeVisibleCount(count);
  const hasAddedCrown = photos > TREE_NODE_CAPACITY;
  // Keep the familiar framing while the new upper crown remains inside it.
  // Pull back in steps as each successively wider lower tier appears.
  const horizontal = photos <= 17
    ? { minX: 0, width: 380 }
    : photos === 18
      ? { minX: -25, width: 410 }
      : photos === 19
        ? { minX: -25, width: 430 }
        : photos <= 21
          ? { minX: -55, width: 490 }
          : photos <= 29
            ? { minX: -145, width: 670 }
            : { minX: -190, width: 760 };
  return {
    ...horizontal,
    minY: hasAddedCrown ? -20 : 0,
    height: hasAddedCrown ? 440 : 420,
    addedTips: Math.max(0, photos - TREE_NODE_CAPACITY),
  };
}

/** Keep occupied tips still and render at most one month's thirty-three positions.
 * Additional unharvested photos stay in insertion order until a harvested
 * vacancy can receive the oldest waiting photo. */
export function placeTreeItems(items: MemoryTreeItem[], previousSlots: readonly (string | null)[] = []) {
  const pending = new Map(items.flatMap(item => item.stage === "harvested" ? [] : [[item.id, item] as const]));
  const assigned = new Set<string>();
  const capacity = Math.max(TREE_NODE_CAPACITY, Math.min(TREE_VISIBLE_CAPACITY, items.length));
  const slots = Array.from({ length: capacity }, (_, index) => {
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

function pointOnBranch(branch: TreeBranch, t: number, branches: readonly TreeBranch[]): Point {
  const start = branchOrigin(branch, branches);
  const u = 1 - t;
  const coordinate = (axis: 0 | 1) => u ** 3 * start[axis]
    + 3 * u ** 2 * t * branch.bend[axis] + 3 * u * t ** 2 * branch.shoulder[axis]
    + t ** 3 * (branch.tip[axis] + (axis === 1 ? 14 : 0));
  return [coordinate(0), coordinate(1)];
}

function branchOrigin(branch: TreeBranch, branches: readonly TreeBranch[]): Point {
  if (!("branch" in branch.origin)) return branch.origin;
  return pointOnBranch(branches[branch.origin.branch], branch.origin.at, branches);
}

function appendBranch() {
  const index = GENERATED_BRANCHES.length;
  const offset = index - TREE_NODE_CAPACITY;
  const [hangX, hangY] = FRUIT_HANG_OFFSETS[index % FRUIT_HANG_OFFSETS.length];
  const [fruitCenterX, fruitCenterY] = EXTRA_FRUIT_CENTERS[offset];
  const tip: Point = [fruitCenterX - hangX, fruitCenterY - hangY];
  const origin = EXTRA_BRANCH_ORIGINS[offset];
  const start = "branch" in origin
    ? pointOnBranch(GENERATED_BRANCHES[origin.branch], origin.at, GENERATED_BRANCHES)
    : origin;
  const end: Point = [tip[0], tip[1] + 14];
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const direction = Math.sign(fruitCenterX - 190) || (offset % 2 === 0 ? -1 : 1);
  const curve = direction * Math.min(18, 4 + Math.abs(dx) * .055);
  GENERATED_BRANCHES.push({
    tip,
    origin,
    bend: [start[0] + dx * .32 + curve, start[1] + dy * .23],
    shoulder: [start[0] + dx * .78 - curve * .24, start[1] + dy * .7],
    width: EXTRA_BRANCH_WIDTHS[offset],
  });
}

function ensureBranches(count: number) {
  while (GENERATED_BRANCHES.length < count) appendBranch();
}

export function getTreeBranch(index: number, mirrored: boolean, widthScale = 1) {
  const safeIndex = Math.max(0, Math.floor(index));
  ensureBranches(safeIndex + 1);
  const cacheKey = `${safeIndex}:${mirrored ? 1 : 0}:${widthScale}`;
  const cached = RENDERED_BRANCHES.get(cacheKey);
  if (cached) return cached;
  const branch = GENERATED_BRANCHES[safeIndex];
  const width = branch.width * widthScale;
  const flip = ([x, y]: Point): Point => [mirrored ? 380 - x : x, y];
  const [x, y] = flip(branch.tip);
  const origin = flip(branchOrigin(branch, GENERATED_BRANCHES));
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
    const radius = (width * (1 - t) ** 1.35 + .65) / 2;
    const length = Math.hypot(d[0], d[1]) || 1;
    for (const side of [0, 1]) {
      const sign = side === 0 ? 1 : -1;
      sides[side].push([p[0] - sign * d[1] / length * radius, p[1] + sign * d[0] / length * radius]);
    }
  }
  const outline = [...sides[0], ...sides[1].reverse()].map(p => p.map(v => v.toFixed(2)).join(" "));
  const rendered = { x, y, origin, width,
    path: `M${origin.join(" ")} C${bend.join(" ")} ${shoulder.join(" ")} ${x} ${y + 14}`,
    surface: `M${outline.join(" L")}Z` };
  RENDERED_BRANCHES.set(cacheKey, rendered);
  return rendered;
}

export function getTreeStructure(count: number, mirrored: boolean, photoCount = count) {
  const stage = Math.max(0, Math.min(7, Math.floor(count)));
  // The first seven uploads keep the original growth. Once mature, generate
  // only the number of photo tips this month has actually needed.
  const boughCount = stage < 7
    ? [0, 0, 0, 3, 6, 8, 10][stage]
    : Math.max(TREE_NODE_CAPACITY, getTreeVisibleCount(photoCount));
  // Before the trunk thickens at stage seven, boughs stay slimmer than the
  // young trunk. Their center lines remain fixed, so only wood thickness grows.
  const widthScale = [0, 0, 0, .28, .33, .38, .42, 1][stage];
  return Array.from({ length: boughCount }, (_, index) => getTreeBranch(index, mirrored, widthScale));
}
