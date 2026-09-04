import type { Memory } from "./types";

/** Keep the tab-local working copy unique by id while preserving list order. */
export function addMemoryToCache(memories: Memory[], memory: Memory) {
  return [memory, ...memories.filter((candidate) => candidate.id !== memory.id)];
}

/** An update can hydrate a detail-only record that was not in the initial list. */
export function updateMemoryInCache(memories: Memory[], memory: Memory) {
  const existing = memories.find((candidate) => candidate.id === memory.id);
  if (!existing) return addMemoryToCache(memories, memory);
  const updated = {
    ...existing,
    ...memory,
    // Metadata updates do not issue a new signed URL.
    imageUrl: memory.imageUrl || existing.imageUrl,
  };
  return memories.map((candidate) => candidate.id === memory.id ? updated : candidate);
}

export function removeMemoryFromCache(memories: Memory[], id: string) {
  return memories.filter((memory) => memory.id !== id);
}
