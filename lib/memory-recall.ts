import type { MemoryTreeItem } from "./tree-data";

export const MEMORY_RECALL_STORAGE_KEY = "memorimber-memory-recall-v1";
export const MEMORY_RECALL_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export type MemoryRecallState = {
  reviewedAt: Record<string, number>;
  featuredId: string | null;
};

export const EMPTY_MEMORY_RECALL_STATE: MemoryRecallState = { reviewedAt: {}, featuredId: null };

export function readMemoryRecallState(raw: string | null): MemoryRecallState {
  try {
    const value = JSON.parse(raw ?? "null") as Partial<MemoryRecallState> | null;
    if (!value || typeof value !== "object") return EMPTY_MEMORY_RECALL_STATE;
    const reviewedAt = Object.fromEntries(Object.entries(value.reviewedAt ?? {})
      .filter(([id, timestamp]) => Boolean(id) && typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp >= 0));
    return {
      reviewedAt,
      featuredId: typeof value.featuredId === "string" && value.featuredId ? value.featuredId : null,
    };
  } catch {
    return EMPTY_MEMORY_RECALL_STATE;
  }
}

export function chooseFadingMemoryId(
  petals: Extract<MemoryTreeItem, { stage: "harvested" }>[],
  state: MemoryRecallState,
  now: number,
  options: { ignoreAge?: boolean; random?: () => number } = {},
) {
  const eligible = petals.filter((petal) => {
    if (options.ignoreAge) return true;
    const memoryId = petal.memoryId ?? petal.id;
    const harvestedAt = Date.parse(petal.harvestedAt ?? "");
    const lastRemembered = Math.max(Number.isFinite(harvestedAt) ? harvestedAt : now, state.reviewedAt[memoryId] ?? 0);
    return now - lastRemembered >= MEMORY_RECALL_STALE_MS;
  });
  if (eligible.length === 0) return null;
  const existing = eligible.find((petal) => (petal.memoryId ?? petal.id) === state.featuredId);
  if (existing) return state.featuredId;
  const index = Math.min(eligible.length - 1, Math.floor(Math.max(0, (options.random ?? Math.random)()) * eligible.length));
  return eligible[index].memoryId ?? eligible[index].id;
}

export function recordMemoryReview(state: MemoryRecallState, memoryId: string, now: number): MemoryRecallState {
  return {
    reviewedAt: { ...state.reviewedAt, [memoryId]: now },
    featuredId: state.featuredId === memoryId ? null : state.featuredId,
  };
}
