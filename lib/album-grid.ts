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

/** Reserve complete rows for the fullest month so changing months never
 * moves the controls or changes the document height. */
export function getAlbumGridSlotCount(monthCounts: number[]) {
  const maximum = Math.max(0, ...monthCounts.map((count) => Math.max(0, count)));
  return Math.max(ALBUM_GRID_COLUMNS, Math.ceil(maximum / ALBUM_GRID_COLUMNS) * ALBUM_GRID_COLUMNS);
}
