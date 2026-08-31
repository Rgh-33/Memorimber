// Plastic-cup artwork uses a 1024 × 1536 frame. The drink reaches
// the inner base at 95.6%; keep the photographic base intact at every level.
export function getTeaCupGeometry(remaining: number, pearlCount = 0) {
  const level = Number.isFinite(remaining) ? Math.max(0, Math.min(1, remaining)) : 0;
  const bottomRadius = 0.192;
  const radiusChange = 0.108;
  const volume = (height: number) => bottomRadius ** 2 * height
    + bottomRadius * radiusChange * height ** 2
    + radiusChange ** 2 * height ** 3 / 3;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2;
    if (volume(middle) < level * volume(1)) low = middle;
    else high = middle;
  }
  const height = level === 0 ? 0 : level === 1 ? 1 : (low + high) / 2;
  // The full photograph's front-center meniscus is at y≈543/1536 (35.4%).
  const top = 95.6 - 60.2 * height;
  const width = (bottomRadius + radiusChange * height) * 200;
  // Ice keeps its physical size instead of shrinking with the liquid surface.
  // The oblique photograph includes padding and upward-facing facets.
  // Its image-space waterline is not the ice's physical submerged volume:
  // 46% exposes the top faces, while the lower facets disappear into the tea.
  const iceWidth = 37;
  const iceDepth = iceWidth / 4.5;
  const safePearlCount = Number.isFinite(pearlCount) ? Math.max(0, Math.min(14, pearlCount)) : 0;
  const iceFloor = 95.3 - safePearlCount / 14 * 5;
  const iceTop = Math.min(iceFloor - iceDepth, Math.max(32.2, top - iceDepth * .46));
  const iceWaterline = Math.max(0, Math.min(100, (top - iceTop) / iceDepth * 100));
  return {
    level,
    height,
    top,
    width,
    surfaceDepth: 1.1 + 1.7 * height,
    iceWidth,
    iceTop,
    iceDepth,
    iceWaterline,
    iceFloor,
  };
}
