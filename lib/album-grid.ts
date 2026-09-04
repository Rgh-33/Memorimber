import type { Memory } from "./types";

export const ALBUM_GRID_COLUMNS = 3;

export function orderAlbumMemories(memories: Memory[]) {
  return [...memories].sort((a, b) => a.date.localeCompare(b.date)
    || (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id.localeCompare(b.id));
}

/** Right-align the oldest partial row so the newest item always lands in the
 * bottom-right cell while time flows left-to-right within each row. */
export function getAlbumFirstColumn(memoryCount: number) {
  const remainder = Math.max(0, memoryCount) % ALBUM_GRID_COLUMNS;
  return remainder === 0 ? 1 : ALBUM_GRID_COLUMNS - remainder + 1;
}
