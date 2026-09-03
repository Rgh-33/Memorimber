import type { MemoryTreeItem } from "./tree-data";
import type { TreeDisplayMode } from "./tree-preferences";

export type Point = readonly [number, number];
type BranchOrigin = Point | { branch: number; at: number };
type BranchSpec = { id: string; tip: Point; origin: BranchOrigin; bend: Point; shoulder: Point; width: number };

export type RenderedTreeBranch = {
  id: string;
  x: number;
  y: number;
  origin: Point;
  width: number;
  path: string;
  surface: string;
};

export type TreeCanopyClump = {
  id: string;
  x: number;
  y: number;
  source: number;
  scaleX: number;
  scaleY: number;
  front: boolean;
};

export type TreeGrowthModel = {
  mode: TreeDisplayMode;
  stage: number;
  count: number;
  capacity: number;
  contentScale: number;
  slots: readonly Point[];
  branches: readonly RenderedTreeBranch[];
  canopy: readonly TreeCanopyClump[];
  canvas: { minX: number; width: number; minY: number; height: number; addedTips: number };
  trunk: { detailed: boolean; topY: number; scaleX: number; scaleY: number; youngPath: string; youngWidth: number };
  soilStage: number;
};

type RowPoint = { center: Point; row: number; column: number; columns: number };
type ModelShape = {
  stage: number;
  capacity: number;
  rowCounts: readonly number[];
  topY: number;
  rowGap: number;
  halfWidth: number;
  branchWidth: number;
  leafScale: number;
  leafDetail: number;
  trunkTop: number;
  trunkScaleX: number;
  canvasMinY: number;
};

export const TREE_PROPORTION = { x: .98, y: 1.06 } as const;
export const TREE_NODE_CAPACITY = 12;

// These match fruitHangAt(). Keeping the tiny offsets here lets the geometry
// reserve actual fruit centres without importing browser-facing layout code.
const FRUIT_HANG_OFFSETS = [
  [-8, 8], [10, 5], [-3, -8], [6, -2], [-9, 1], [2, -8],
  [-10, -8], [9, -10], [-2, 4], [4, 7], [-2, 9], [3, 11],
] as const;

const BACK_SOURCES = [9, 0, 2, 7, 8, 1, 3] as const;
const FRONT_SOURCES = [18, 11, 12, 19, 20, 13, 14, 17] as const;
const SCATTER_X = [-2, -1.25, -.5, .75, 1.5, 2] as const;
const SCATTER_Y = [-8, -6, -4, -2, 2, 4, 6, 8] as const;
const PHONE_LAYOUT_WIDTH = 320;
const FRUIT_TARGET_WIDTH = 44;
const FRUIT_TARGET_HEIGHT = 52;

// The fixed twelve-tip silhouette from main. In classic mode only the tree
// geometry is restored; the current fruit lifecycle and interactions remain.
const CLASSIC_BRANCHES: readonly BranchSpec[] = [
  { id: "classic-0", tip: [80, 252], origin: [188, 282], bend: [150, 269], shoulder: [129, 242], width: 14 },
  { id: "classic-1", tip: [302, 228], origin: [197, 267], bend: [236, 232], shoulder: [273, 242], width: 15 },
  { id: "classic-2", tip: [145, 88], origin: [185, 248], bend: [142, 209], shoulder: [170, 139], width: 13 },
  { id: "classic-3", tip: [310, 155], origin: { branch: 1, at: .52 }, bend: [287, 216], shoulder: [287, 175], width: 5 },
  { id: "classic-4", tip: [75, 176], origin: { branch: 0, at: .6 }, bend: [105, 230], shoulder: [86, 203], width: 5 },
  { id: "classic-5", tip: [224, 105], origin: [209, 225], bend: [236, 192], shoulder: [216, 136], width: 12 },
  { id: "classic-6", tip: [75, 96], origin: { branch: 4, at: .6 }, bend: [77, 171], shoulder: [69, 132], width: 3 },
  { id: "classic-7", tip: [295, 77], origin: { branch: 3, at: .52 }, bend: [311, 162], shoulder: [314, 114], width: 3 },
  { id: "classic-8", tip: [155, 164], origin: { branch: 2, at: .35 }, bend: [132, 175], shoulder: [136, 162], width: 3.5 },
  { id: "classic-9", tip: [230, 180], origin: { branch: 5, at: .36 }, bend: [224, 173], shoulder: [239, 170], width: 3.5 },
  { id: "classic-10", tip: [154, 242], origin: { branch: 0, at: .4 }, bend: [149, 251], shoulder: [158, 233], width: 3 },
  { id: "classic-11", tip: [226, 253], origin: { branch: 1, at: .32 }, bend: [233, 246], shoulder: [232, 249], width: 3 },
];

const CLASSIC_TREE_SCALES = [.18, .18, .32, .47, .61, .76, .89, 1] as const;
const CLASSIC_BOUGH_COUNTS = [0, 0, 0, 5, 8, 10, 12, 12] as const;

function safeCount(count: number) {
  return Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
}

/** The first seven uploads have individual stages. Eight through twelve share
 * one mature skeleton; after that the whole tree changes only at band edges. */
export function getTreeAppearanceStage(count: number, mode: TreeDisplayMode = "expanding") {
  const photos = safeCount(count);
  if (mode === "classic") return Math.min(7, photos);
  if (photos <= 7) return photos;
  if (photos <= 12) return 8;
  if (photos <= 18) return 9;
  if (photos <= 24) return 10;
  if (photos <= 31) return 11;
  return 11 + Math.ceil((photos - 31) / 7);
}

export function getTreeVisibleCount(count: number, mode: TreeDisplayMode = "expanding") {
  const photos = safeCount(count);
  return mode === "classic" ? Math.min(TREE_NODE_CAPACITY, photos) : photos;
}

function overflowRowCounts(overflowStage: number) {
  const rows = 6 + overflowStage * 2;
  const capacity = 31 + overflowStage * 7;
  const counts = Array.from({ length: rows }, () => 3);
  let remaining = capacity - rows * 3;
  const pairs = Array.from({ length: Math.ceil(rows / 2) }, (_, offset) => {
    const left = Math.floor((rows - 1) / 2) - offset;
    const right = rows - 1 - left;
    return left < 0 ? [] : left === right ? [left] : [left, right];
  });
  for (const pair of pairs) {
    while (remaining > 0 && pair.some(row => counts[row] < 6)) {
      for (const row of pair) {
        if (remaining === 0) break;
        if (counts[row] >= 6) continue;
        counts[row]++;
        remaining--;
      }
    }
    if (remaining === 0) break;
  }
  while (remaining > 0) {
    for (let row = 0; row < rows && remaining > 0; row++) {
      if (remaining === 0) break;
      if (counts[row] >= 6) continue;
      counts[row]++;
      remaining--;
    }
  }
  return counts;
}

function shapeFor(count: number): ModelShape {
  const photos = safeCount(count);
  const stage = getTreeAppearanceStage(photos);
  if (stage === 0) return { stage, capacity: 0, rowCounts: [], topY: 0, rowGap: 0, halfWidth: 0,
    branchWidth: 0, leafScale: 0, leafDetail: 0, trunkTop: 385, trunkScaleX: 0, canvasMinY: 0 };
  if (stage === 1 || stage === 2) return { stage, capacity: stage, rowCounts: [], topY: 0, rowGap: 0, halfWidth: 0,
    branchWidth: 0, leafScale: 0, leafDetail: 0, trunkTop: 340, trunkScaleX: 0, canvasMinY: 0 };
  if (stage === 3) return { stage, capacity: 3, rowCounts: [3], topY: 244, rowGap: 0, halfWidth: 52,
    branchWidth: .32, leafScale: .48, leafDetail: 0, trunkTop: 238, trunkScaleX: .28, canvasMinY: 0 };
  if (stage === 4) return { stage, capacity: 4, rowCounts: [2, 2], topY: 190, rowGap: 72, halfWidth: 72,
    branchWidth: .4, leafScale: .58, leafDetail: 0, trunkTop: 207, trunkScaleX: .38, canvasMinY: 0 };

  // Five, six and seven deliberately share the same seven-tip topology. Only
  // reach, girth and foliage density change, so the tree never swaps shape.
  if (stage === 5) return { stage, capacity: 7, rowCounts: [2, 3, 2], topY: 150, rowGap: 65, halfWidth: 104,
    branchWidth: .56, leafScale: .66, leafDetail: 0, trunkTop: 210, trunkScaleX: .64, canvasMinY: 0 };
  if (stage === 6) return { stage, capacity: 7, rowCounts: [2, 3, 2], topY: 126, rowGap: 76, halfWidth: 128,
    branchWidth: .72, leafScale: .78, leafDetail: 1, trunkTop: 195, trunkScaleX: .79, canvasMinY: 0 };
  if (stage === 7) return { stage, capacity: 7, rowCounts: [2, 3, 2], topY: 102, rowGap: 88, halfWidth: 148,
    branchWidth: .88, leafScale: .9, leafDetail: 2, trunkTop: 180, trunkScaleX: .93, canvasMinY: 0 };
  if (stage === 8) return { stage, capacity: 12, rowCounts: [3, 6, 3], topY: 54, rowGap: 96, halfWidth: 150,
    branchWidth: 1, leafScale: .96, leafDetail: 2, trunkTop: 165, trunkScaleX: 1, canvasMinY: 0 };
  if (stage === 9) return { stage, capacity: 18, rowCounts: [3, 6, 6, 3], topY: 18, rowGap: 76, halfWidth: 153,
    branchWidth: 1.08, leafScale: .98, leafDetail: 2, trunkTop: 153, trunkScaleX: 1.08, canvasMinY: -18 };
  if (stage === 10) return { stage, capacity: 24, rowCounts: [3, 6, 6, 6, 3], topY: -38, rowGap: 73, halfWidth: 156,
    branchWidth: 1.16, leafScale: 1, leafDetail: 2, trunkTop: 139, trunkScaleX: 1.16, canvasMinY: -74 };
  if (stage === 11) return { stage, capacity: 31, rowCounts: [3, 5, 6, 6, 6, 5], topY: -105, rowGap: 73, halfWidth: 160,
    branchWidth: 1.24, leafScale: 1.02, leafDetail: 2, trunkTop: 124, trunkScaleX: 1.24, canvasMinY: -142 };

  const overflowStage = stage - 11;
  const rowCounts = overflowRowCounts(overflowStage);
  const topY = 260 - (rowCounts.length - 1) * 73;
  return { stage, capacity: 31 + overflowStage * 7, rowCounts, topY, rowGap: 73, halfWidth: 160,
    branchWidth: 1.24 + Math.min(.34, overflowStage * .035), leafScale: 1.02, leafDetail: 2,
    trunkTop: Math.max(topY + 142, 124 - overflowStage * 58), trunkScaleX: 1.24 + Math.min(.42, overflowStage * .045),
    canvasMinY: topY - 38 };
}

function rowWidth(columns: number, halfWidth: number) {
  if (columns <= 1) return 0;
  if (columns === 2) return halfWidth * .58;
  if (columns === 3) return halfWidth * .52;
  if (columns === 4) return halfWidth * .72;
  if (columns === 5) return halfWidth * .82;
  return halfWidth;
}

function makeRows(shape: ModelShape) {
  return shape.rowCounts.map((columns, row) => {
    const half = rowWidth(columns, shape.halfWidth);
    return Array.from({ length: columns }, (_, column): RowPoint => ({
      center: [columns === 1 ? 190 : 190 - half + column * half * 2 / (columns - 1), shape.topY + row * shape.rowGap],
      row,
      column,
      columns,
    }));
  });
}

function balancedPoints(rows: readonly RowPoint[][]) {
  const remaining = rows.flat();
  const selected: RowPoint[] = [];
  const normalized = (point: RowPoint): Point => [
    point.columns <= 1 ? .5 : point.column / (point.columns - 1),
    rows.length <= 1 ? .5 : point.row / (rows.length - 1),
  ];
  while (remaining.length) {
    const nextIndex = selected.length === 0
      ? remaining.reduce((best, point, index) => {
        const [x, y] = normalized(point);
        const [bestX, bestY] = normalized(remaining[best]);
        const score = Math.abs(x - .5) + Math.abs(y - .5) * .3;
        const bestScore = Math.abs(bestX - .5) + Math.abs(bestY - .5) * .3;
        return score < bestScore ? index : best;
      }, 0)
      : remaining.reduce((best, point, index) => {
        const [x, y] = normalized(point);
        const distance = Math.min(...selected.map(other => {
          const [otherX, otherY] = normalized(other);
          return Math.hypot((x - otherX) * 1.15, y - otherY);
        }));
        const bestPoint = remaining[best];
        const [bestX, bestY] = normalized(bestPoint);
        const bestDistance = Math.min(...selected.map(other => {
          const [otherX, otherY] = normalized(other);
          return Math.hypot((bestX - otherX) * 1.15, bestY - otherY);
        }));
        return distance > bestDistance ? index : best;
      }, 0);
    selected.push(remaining.splice(nextIndex, 1)[0]);
  }
  return selected;
}

function canvasMinYFor(shape: ModelShape) {
  const projectedCrownTop = 383 + (shape.topY - 383) * TREE_PROPORTION.y;
  return shape.stage >= 3 ? Math.min(shape.canvasMinY, projectedCrownTop - 42) : 0;
}

function scatterHash(point: RowPoint, slot: number) {
  let hash = Math.imul(point.row + 1, 0x9e3779b1)
    ^ Math.imul(point.column + 1, 0x85ebca6b)
    ^ Math.imul(slot + 1, 0xc2b2ae35);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  return (hash ^ (hash >>> 15)) >>> 0;
}

function fruitTargetPoint(center: Point, slot: number, canvasMinY: number) {
  const [hangX, hangY] = FRUIT_HANG_OFFSETS[slot % FRUIT_HANG_OFFSETS.length];
  const scale = PHONE_LAYOUT_WIDTH / 380;
  const slotX = center[0] - hangX;
  const slotY = center[1] - hangY;
  return {
    x: (190 + (slotX - 190) * TREE_PROPORTION.x + hangX) * scale,
    y: (383 + (slotY + 23 - 383) * TREE_PROPORTION.y + hangY - canvasMinY) * scale,
  };
}

/** Break up the visible rows without making fruit jump between renders. The
 * original point is always the final fallback, so small screens retain the
 * same hit-target guarantees as the regular grid. */
function scatterPoints(points: readonly RowPoint[], shape: ModelShape) {
  if (shape.stage < 8) return points;
  const canvasMinY = canvasMinYFor(shape);
  const canvasHeight = (420 - canvasMinY) * PHONE_LAYOUT_WIDTH / 380;
  const acceptedTargets: { x: number; y: number }[] = [];
  return points.map((point, slot): RowPoint => {
    const hash = scatterHash(point, slot);
    const desiredX = Math.abs(point.center[0] - 190) < 6 ? 0 : SCATTER_X[hash % SCATTER_X.length];
    const desiredY = SCATTER_Y[(hash >>> 8) % SCATTER_Y.length];
    const attempts: Point[] = [
      [desiredX, desiredY],
      [desiredX * .75, desiredY * .75],
      [desiredX * .5, desiredY * .5],
      [0, desiredY * .5],
      [0, 0],
    ];
    for (const [offsetX, offsetY] of attempts) {
      const center: Point = [point.center[0] + offsetX, point.center[1] + offsetY];
      const target = fruitTargetPoint(center, slot, canvasMinY);
      const insideCanvas = target.x >= FRUIT_TARGET_WIDTH / 2
        && target.x <= PHONE_LAYOUT_WIDTH - FRUIT_TARGET_WIDTH / 2
        && target.y >= FRUIT_TARGET_HEIGHT / 2
        && target.y <= canvasHeight - FRUIT_TARGET_HEIGHT / 2;
      const separate = acceptedTargets.every(other => Math.abs(target.x - other.x) >= FRUIT_TARGET_WIDTH
        || Math.abs(target.y - other.y) >= FRUIT_TARGET_HEIGHT);
      if (!insideCanvas || !separate) continue;
      acceptedTargets.push(target);
      return { ...point, center };
    }
    // The unshifted layout is already collision-tested, so this is defensive.
    const target = fruitTargetPoint(point.center, slot, canvasMinY);
    acceptedTargets.push(target);
    return point;
  });
}

function pointOnBranch(branch: BranchSpec, t: number, branches: readonly BranchSpec[]): Point {
  const start = branchOrigin(branch, branches);
  const u = 1 - t;
  const coordinate = (axis: 0 | 1) => u ** 3 * start[axis]
    + 3 * u ** 2 * t * branch.bend[axis] + 3 * u * t ** 2 * branch.shoulder[axis]
    + t ** 3 * branch.tip[axis];
  return [coordinate(0), coordinate(1)];
}

function branchOrigin(branch: BranchSpec, branches: readonly BranchSpec[]): Point {
  return "branch" in branch.origin ? pointOnBranch(branches[branch.origin.branch], branch.origin.at, branches) : branch.origin;
}

function renderBranch(
  branch: BranchSpec,
  branches: readonly BranchSpec[],
  segments = 20,
  taper = 1.28,
  tipWidth = .6,
): RenderedTreeBranch {
  const origin = branchOrigin(branch, branches);
  const sides: Point[][] = [[], []];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const p = [0, 1].map(axis => u ** 3 * origin[axis] + 3 * u ** 2 * t * branch.bend[axis]
      + 3 * u * t ** 2 * branch.shoulder[axis] + t ** 3 * branch.tip[axis]);
    const d = [0, 1].map(axis => 3 * u ** 2 * (branch.bend[axis] - origin[axis])
      + 6 * u * t * (branch.shoulder[axis] - branch.bend[axis]) + 3 * t ** 2 * (branch.tip[axis] - branch.shoulder[axis]));
    const radius = (branch.width * (1 - t) ** taper + tipWidth) / 2;
    const length = Math.hypot(d[0], d[1]) || 1;
    for (const side of [0, 1]) {
      const sign = side === 0 ? 1 : -1;
      sides[side].push([p[0] - sign * d[1] / length * radius, p[1] + sign * d[0] / length * radius]);
    }
  }
  const outline = [...sides[0], ...sides[1].reverse()].map(point => point.map(value => value.toFixed(2)).join(" "));
  return {
    id: branch.id,
    x: branch.tip[0],
    y: branch.tip[1] - 14,
    origin,
    width: branch.width,
    path: `M${origin.join(" ")} C${branch.bend.join(" ")} ${branch.shoulder.join(" ")} ${branch.tip.join(" ")}`,
    surface: `M${outline.join(" L")}Z`,
  };
}

function makeBranches(rows: readonly RowPoint[][], ordered: readonly RowPoint[], shape: ModelShape) {
  const specs: BranchSpec[] = [];
  const rowParents = rows.map((points, row) => {
    const y = shape.topY + row * shape.rowGap;
    const originY = Math.min(330, Math.max(shape.trunkTop + 34, y + 104));
    const makeMain = (side: -1 | 1) => {
      const sidePoints = points.filter(point => side < 0 ? point.center[0] < 190 : point.center[0] >= 190);
      if (sidePoints.length === 0) return -1;
      const outer = side < 0 ? Math.min(...sidePoints.map(point => point.center[0])) : Math.max(...sidePoints.map(point => point.center[0]));
      const tip: Point = [outer - side * 12, y + 25];
      const start: Point = [190 + side * (4 + shape.trunkScaleX * 2.4), originY];
      const dx = tip[0] - start[0];
      const dy = tip[1] - start[1];
      const index = specs.length;
      specs.push({ id: `main-${row}-${side < 0 ? "left" : "right"}`, origin: start, tip,
        bend: [start[0] + dx * .28 - side * 9, start[1] + dy * .2],
        shoulder: [start[0] + dx * .76 + side * 5, start[1] + dy * .72],
        width: Math.max(2.8, (8.5 - row * .32) * shape.branchWidth) });
      return index;
    };
    return { left: makeMain(-1), right: makeMain(1) };
  });

  ordered.forEach((point, slot) => {
    const [hangX, hangY] = FRUIT_HANG_OFFSETS[slot % FRUIT_HANG_OFFSETS.length];
    const tip: Point = [point.center[0] - hangX, point.center[1] - hangY + 14];
    const side = point.center[0] < 190 ? "left" : "right";
    const parent = rowParents[point.row][side];
    const fallback = rowParents[point.row][side === "left" ? "right" : "left"];
    const parentIndex = parent >= 0 ? parent : fallback;
    const at = point.columns <= 2 ? .76 : .43 + point.column / Math.max(1, point.columns - 1) * .48;
    const parentAt = Math.max(.38, Math.min(.9, at));
    const start = pointOnBranch(specs[parentIndex], parentAt, specs);
    const dx = tip[0] - start[0];
    const dy = tip[1] - start[1];
    const direction = Math.sign(dx) || (slot % 2 ? 1 : -1);
    specs.push({ id: `tip-${slot}`, origin: { branch: parentIndex, at: parentAt }, tip,
      bend: [start[0] + dx * .34 + direction * 4, start[1] + dy * .22],
      shoulder: [start[0] + dx * .78 - direction * 2, start[1] + dy * .72],
      width: Math.max(1.25, (3.2 - point.row * .08) * shape.branchWidth) });
  });
  return specs.map(branch => renderBranch(branch, specs));
}

function makeCanopy(rows: readonly RowPoint[][], shape: ModelShape): TreeCanopyClump[] {
  const clumps: TreeCanopyClump[] = [];
  rows.flat().forEach((point, index) => {
    const front = (point.row + point.column) % 3 !== 0;
    const sources = front ? FRONT_SOURCES : BACK_SOURCES;
    clumps.push({ id: `leaf-${point.row}-${point.column}`, x: point.center[0], y: point.center[1] - 12,
      source: sources[index % sources.length], scaleX: shape.leafScale * (point.columns <= 3 ? 1.04 : .88),
      scaleY: shape.leafScale * .82, front });
  });
  if (shape.leafDetail >= 1) {
    rows.forEach((points, row) => points.slice(1).forEach((point, column) => {
      const previous = points[column];
      const front = (row + column) % 2 === 0;
      const sources = front ? FRONT_SOURCES : BACK_SOURCES;
      clumps.push({ id: `fill-${row}-${column}`, x: (previous.center[0] + point.center[0]) / 2,
        y: point.center[1] + 10, source: sources[(row * 3 + column) % sources.length],
        scaleX: shape.leafScale * .66, scaleY: shape.leafScale * .58, front });
    }));
  }
  if (shape.leafDetail >= 2) {
    rows.slice(1).forEach((points, row) => {
      const y = shape.topY + (row + .5) * shape.rowGap;
      const front = row % 2 === 1;
      const sources = front ? FRONT_SOURCES : BACK_SOURCES;
      clumps.push({ id: `bridge-${row}`, x: 190 + (row % 2 ? -12 : 12), y,
        source: sources[row % sources.length], scaleX: shape.leafScale * 1.02,
        scaleY: shape.leafScale * .68, front });
    });
  }
  return clumps;
}

function youngPath(topY: number) {
  return `M190 384 C${194 + (238 - topY) * .025} 340 ${184 - (238 - topY) * .018} ${topY + 48} 192 ${topY}`;
}

function getClassicTreeGrowthModel(count: number): TreeGrowthModel {
  const photos = safeCount(count);
  const stage = getTreeAppearanceStage(photos, "classic");
  const slots = CLASSIC_BRANCHES.map((branch): Point => [branch.tip[0], branch.tip[1] - 14]);
  const boughCount = CLASSIC_BOUGH_COUNTS[stage];
  return {
    mode: "classic",
    stage,
    count: photos,
    capacity: TREE_NODE_CAPACITY,
    contentScale: CLASSIC_TREE_SCALES[stage],
    slots,
    branches: CLASSIC_BRANCHES.slice(0, boughCount).map((branch) => renderBranch(branch, CLASSIC_BRANCHES, 24, 1.35, .65)),
    canopy: [],
    canvas: { minX: 0, width: 380, minY: 0, height: 420, addedTips: 0 },
    trunk: {
      detailed: stage >= 4,
      topY: 185,
      scaleX: 1,
      scaleY: 1,
      youngPath: "M188 384 C197 343 181 296 194 251 Q206 210 200 165",
      youngWidth: 6,
    },
    soilStage: stage,
  };
}

export function getTreeGrowthModel(count: number, mode: TreeDisplayMode = "expanding"): TreeGrowthModel {
  if (mode === "classic") return getClassicTreeGrowthModel(count);
  const photos = safeCount(count);
  const shape = shapeFor(photos);
  const rows = makeRows(shape);
  const ordered = balancedPoints(rows);
  const positioned = scatterPoints(ordered, shape);
  const slots = positioned.map((point, slot): Point => {
    const [hangX, hangY] = FRUIT_HANG_OFFSETS[slot % FRUIT_HANG_OFFSETS.length];
    return [point.center[0] - hangX, point.center[1] - hangY];
  });
  const scaleY = (388 - shape.trunkTop) / (388 - 185);
  const canvasMinY = canvasMinYFor(shape);
  return {
    mode: "expanding",
    stage: shape.stage,
    count: photos,
    capacity: shape.capacity,
    contentScale: 1,
    slots,
    branches: shape.stage >= 3 ? makeBranches(rows, positioned, shape) : [],
    canopy: shape.stage >= 3 ? makeCanopy(rows, shape) : [],
    canvas: { minX: 0, width: 380, minY: canvasMinY, height: 420 - canvasMinY,
      addedTips: Math.max(0, photos - TREE_NODE_CAPACITY) },
    trunk: { detailed: shape.stage >= 5, topY: shape.trunkTop, scaleX: shape.trunkScaleX, scaleY,
      youngPath: youngPath(shape.trunkTop), youngWidth: shape.stage === 3 ? 7.4 : 8.2 },
    soilStage: Math.min(11, shape.stage),
  };
}

export function getTreeSlot(model: TreeGrowthModel, index: number, mirrored: boolean) {
  const point = model.slots[Math.max(0, Math.min(model.slots.length - 1, Math.floor(index)))] ?? [190, 383];
  return { x: mirrored ? 380 - point[0] : point[0], y: point[1] };
}

export function getTreeCanvasMetrics(count: number, mode: TreeDisplayMode = "expanding") {
  return getTreeGrowthModel(count, mode).canvas;
}

/** Occupied tips remain stable inside a growth band. Harvesting leaves a hole;
 * the next upload reuses it before extending the slot list. */
export function placeTreeItems(
  items: MemoryTreeItem[],
  previousSlots: readonly (string | null)[] = [],
  maximumSlots?: number,
) {
  const pending = new Map(items.flatMap(item => item.stage === "harvested" ? [] : [[item.id, item] as const]));
  const assigned = new Set<string>();
  // Harvested items remain in `items`, so their holes stay stable. A deleted
  // memory leaves `items` entirely and intentionally lets the tree shrink.
  const capacity = maximumSlots === undefined
    ? items.length
    : Math.max(0, Math.floor(Number.isFinite(maximumSlots) ? maximumSlots : 0));
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
  if (maximumSlots === undefined) {
    while (next < waiting.length) slots.push(waiting[next++]);
  }
  const visibleItems = slots.flatMap((id, fruitSlot) => {
    const item = id ? pending.get(id) : undefined;
    return item ? [{ ...item, fruitSlot }] : [];
  });
  return { slots, visibleItems };
}
