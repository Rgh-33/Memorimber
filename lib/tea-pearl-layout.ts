// The front and rear of the shallow base ellipse are interleaved. Pearls
// settle in a loose pile instead of seven equally spaced stamped circles.
const POSITIONS = [
  [43.1, 93.3, 7.2, .92], [57.8, 93.6, 6.9, .97], [36.7, 92.9, 6.9, .9],
  [50.4, 93.65, 7.6, .95], [63.8, 92.65, 7.1, .93], [40.2, 90.2, 7, .75],
  [54.5, 90.5, 7.4, .77], [60.4, 89.5, 6.8, .79], [46.9, 90.2, 7.1, .75],
  [33.8, 89.9, 6.4, .72], [65.5, 89.4, 6.4, .74], [43.2, 87.6, 6.6, .67],
  [51.4, 87.6, 7.2, .69], [56.7, 86.7, 6.4, .67],
];
export const MAX_VISIBLE_PEARLS = POSITIONS.length;

export function getPearlAppearance(id: string, slot: number) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const variant = hash % 6;
  const [x, y, size, opacity] = POSITIONS[Math.max(0, Math.min(POSITIONS.length - 1, Math.trunc(slot) || 0))];
  return {
    x, y, size, opacity,
    // The same memory keeps its photographed surface as the queue advances.
    spriteX: (variant % 3) * 50,
    spriteY: Math.floor(variant / 3) * 100,
    turn: hash % 19 - 9,
    depth: Math.round(y * 100),
  };
}
