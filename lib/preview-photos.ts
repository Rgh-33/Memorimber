import { SAMPLE_MEMORIES } from "./data";
import type { Memory } from "./types";

// Only PreviewProvider / preview uploads use these photographs. Keep the
// ordinary demo data and real account memories unchanged.
const originals = [
  ["ice-cream", "photo-1511632765486-a01980e01a18"],
  ["classroom", "photo-1523240795612-9a054b0db644"],
  ["sports", "photo-1516627145497-ae6968895b74"],
  ["sunset", "photo-1500534623283-312aade485b7"],
  ["lunch", "photo-1492684223066-81342ee5ff30"],
  ["rain", "photo-1504306665891-9f6e5d8b5d0a"],
  ["cafe", "photo-1517248135467-4c7edcad34c4"],
  ["sky", "photo-1490730141103-6cac27aaab94"],
] as const;

const photo = (name: string) => `/images/preview-photos/${name}.jpg`;

export const PREVIEW_SAMPLE_MEMORIES: Memory[] = [
  ...SAMPLE_MEMORIES.map((memory, index) => ({ ...memory, imageUrl: photo(originals[index][0]) })),
  { id: "preview-river", date: "2026-09-01", imageUrl: photo("river"), caption: "川沿いの帰り道、少しだけ遠回りした。", people: [], tags: ["帰り道"] },
  { id: "preview-flowers", date: "2026-09-02", imageUrl: photo("flowers"), caption: "道ばたのコスモスに、秋を見つけた。", people: [], tags: ["散歩"] },
];

/** Upgrade only known sample sources in saved preview state; preserve uploads. */
export function restorePreviewPhoto(memory: Memory): Memory {
  let originalName: string | undefined;
  for (const [name, remoteId] of originals) {
    if (memory.imageUrl === `/images/demo/${name}.svg`) { originalName = name; break; }
    try {
      const url = new URL(memory.imageUrl);
      if (url.origin === "https://images.unsplash.com" && url.pathname === `/${remoteId}`) {
        originalName = name; break;
      }
    } catch { /* Local photos and user-created data URLs are preserved. */ }
  }
  return originalName ? { ...memory, imageUrl: photo(originalName), thumbnailUrl: undefined } : memory;
}
