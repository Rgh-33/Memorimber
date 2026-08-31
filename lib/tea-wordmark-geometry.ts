// Image-space measurements at the wordmark's height. The PET wall narrows
// by about 0.12 units per vertical unit; its rim is seen from slightly above.
const RADIUS = 126;
const TAPER = .12;
const VIEW_ANGLE = 8 * Math.PI / 180;
export const WORDMARK_WIDTH = 104;
const STRIP_COUNT = 72;

export function projectWordmarkPoint(u: number, v: number) {
  const angle = u / RADIUS;
  const radius = RADIUS - TAPER * v;
  return {
    x: radius * Math.sin(angle),
    y: v * Math.cos(VIEW_ANGLE) + (radius * Math.cos(angle) - RADIUS) * Math.sin(VIEW_ANGLE),
  };
}

// Affine slices preserve the typeset word's kerning, and warp the glyphs
// themselves: horizontal foreshortening, baseline depth and tapered stems.
// This is a local approximation of the same cone, not individually rotated letters.
export const WORDMARK_STRIPS = Array.from({ length: STRIP_COUNT }, (_, index) => {
  const width = WORDMARK_WIDTH / STRIP_COUNT;
  const left = -WORDMARK_WIDTH / 2 + index * width;
  const middle = left + width / 2;
  const angle = middle / RADIUS;
  const point = projectWordmarkPoint(middle, 0);
  const a = Math.cos(angle);
  const b = -Math.sin(angle) * Math.sin(VIEW_ANGLE);
  const c = -TAPER * Math.sin(angle);
  const d = Math.cos(VIEW_ANGLE) - TAPER * Math.cos(angle) * Math.sin(VIEW_ANGLE);
  // Trigonometric last bits differ between Node and browser engines. Fixed
  // precision avoids hydration mismatches without a visible pixel change.
  const matrix = [a, b, c, d, point.x - a * middle, point.y - b * middle].map((value) => Number(value.toFixed(6)));
  return { left, width, matrix };
});
