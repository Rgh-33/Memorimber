export const FRUIT_VARIETY_POOL = [
  "le-lectier",
  "apple",
  "breadfruit",
  "apple",
  "dragon-fruit",
  "jatropha-curcas",
  "apple",
  "nikkori-pear",
] as const;

export type FruitVariety = typeof FRUIT_VARIETY_POOL[number];
export type FruitAppearance = { variety: FruitVariety; tilt: number; size: number };

const HANG_OFFSETS = [
  [-8, 8], [10, 5], [-3, -8], [6, -2], [-9, 1], [2, -8],
  [-10, -8], [9, -10], [-2, 4], [4, 7], [-2, 9], [3, 11],
] as const;

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

/** Each photo receives a random-looking fruit while staying stable through
 * refreshes, quiz navigation and hydration. */
export function fruitAppearanceFor(memoryId: string): FruitAppearance {
  const hash = hashText(memoryId);
  return {
    variety: FRUIT_VARIETY_POOL[hash % FRUIT_VARIETY_POOL.length],
    tilt: ((hash >>> 8) % 13) - 6,
    size: .93 + ((hash >>> 16) % 15) / 100,
  };
}

export function fruitHangAt(slot: number, mirrored: boolean) {
  const index = ((Math.floor(slot) % HANG_OFFSETS.length) + HANG_OFFSETS.length) % HANG_OFFSETS.length;
  const [x, y] = HANG_OFFSETS[index];
  return { x: mirrored ? -x : x, y };
}
