"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SAMPLE_MEMORIES } from "./data";
import { useMemories } from "./memories-context";
import { advanceDate, buildPetals, buildTreeItems, localDate, monthlyQueue, recordHarvest, type Harvests } from "./tree-growth";
import { placeTreeItems, TREE_SLOT_STORAGE_LIMIT } from "./tree-branches";
import type { Memory } from "./types";

type TreeState = { preview: boolean; date: string; uploads: Memory[]; harvests: Harvests; previewHarvests: Harvests; serial: number; slots: Record<string, (string | null)[]> };
const emptyState = (preview: boolean): TreeState => ({ preview, date: `${localDate().slice(0, 7)}-01`, uploads: [], harvests: {}, previewHarvests: {}, serial: 0, slots: {} });

function readState(raw: string | null, preview: boolean): TreeState {
  const fallback = emptyState(preview);
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value.preview !== "boolean" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)
      || !Number.isFinite(new Date(`${value.date}T12:00:00`).getTime()) || !Array.isArray(value.uploads)
      || !Number.isSafeInteger(value.serial) || value.serial < 0) return fallback;
    const harvests = (input: unknown): Harvests => Object.fromEntries(Object.entries(input && typeof input === "object" ? input : {})
      .filter(([, item]) => item && typeof item.word === "string" && [...item.word].length <= 12 && typeof item.harvestedAt === "string"));
    return { preview: value.preview, date: value.date, serial: value.serial,
      uploads: value.uploads.filter((item: Memory) => typeof item?.id === "string" && item.id.startsWith("konoha-preview-")
        && typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) && typeof item.date === "string"
        && typeof item.caption === "string" && typeof item.imageUrl === "string" && Array.isArray(item.people) && Array.isArray(item.tags)),
      harvests: harvests(value.harvests), previewHarvests: harvests(value.previewHarvests),
      // Older saved previews have no placements. Preserve their photos/words
      // and allocate positions on first use instead of resetting the preview.
      slots: Object.fromEntries(Object.entries(value.slots && typeof value.slots === "object" ? value.slots : {})
        .filter(([key, ids]) => /^(preview|real):\d{4}-(0[1-9]|1[0-2])$/.test(key) && Array.isArray(ids))
        .map(([key, ids]) => [key, (ids as unknown[]).slice(0, TREE_SLOT_STORAGE_LIMIT).map(id => typeof id === "string" ? id : null)])) };
  } catch { return fallback; }
}

function useTreeState() {
  const { memories, isDemo, isLoading } = useMemories();
  const [today, setToday] = useState(() => localDate());
  const [state, setState] = useState<TreeState>(() => emptyState(isDemo));
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // Real words are scoped to their authenticated image owner. Preview records
  // never enter MemoriesProvider, Storage uploads, album counts or the database.
  const owner = isDemo ? "demo" : memories[0]?.imagePath?.split("/")[0] ?? "anonymous";
  const storageKey = `memorimber-konohaan-v1:${owner}`;
  const ready = loadedKey === storageKey && !isLoading;

  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(storageKey); } catch { /* In-memory preview still works. */ }
    setState(readState(raw, isDemo));
    setLoadedKey(storageKey);
  }, [storageKey, isDemo]);

  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Storage may be disabled. */ }
  }, [state, loadedKey, storageKey]);

  useEffect(() => {
    const tick = () => setToday(localDate());
    const timer = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    return () => { clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);

  const date = state.preview ? state.date : today;
  const source = state.preview ? state.uploads : memories;
  const harvests = state.preview ? state.previewHarvests : state.harvests;
  const items = useMemo(() => ready ? buildTreeItems(source, date, harvests) : [], [source, date, harvests, ready]);
  const petals = useMemo(() => ready ? buildPetals(source, date, harvests) : [], [source, date, harvests, ready]);
  const count = ready ? monthlyQueue(source, date).length : 0;
  const slotKey = `${state.preview ? "preview" : "real"}:${date.slice(0, 7)}`;
  const placement = useMemo(() => placeTreeItems(items, state.slots[slotKey]), [items, state.slots, slotKey]);

  useEffect(() => {
    if (!ready) return;
    setState(current => {
      const previous = current.slots[slotKey] ?? [];
      if (placement.slots.every((id, index) => id === (previous[index] ?? null))) return current;
      return { ...current, slots: { ...current.slots, [slotKey]: placement.slots } };
    });
  }, [placement.slots, ready, slotKey]);

  return {
    ready, date, preview: state.preview, items, visibleItems: placement.visibleItems, petals, memories: source, count,
    setPreview: (preview: boolean) => setState((current) => ({ ...current, preview })),
    setDate: (next: string) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(next) && Number.isFinite(Date.parse(next))) setState((current) => ({ ...current, preview: true, date: next }));
    },
    advance: (days: number, months = 0) => setState((current) => ({ ...current, preview: true, date: advanceDate(current.date, days, months) })),
    upload: () => setState((current) => {
      const serial = current.serial + 1;
      const sample = SAMPLE_MEMORIES[(serial - 1) % SAMPLE_MEMORIES.length];
      const lastUploadTime = Math.max(0, ...current.uploads.filter((entry) => entry.createdAt?.slice(0, 10) === current.date)
        .map((entry) => Date.parse(entry.createdAt!)));
      const time = Math.max(new Date(`${current.date}T12:00:00`).getTime(), lastUploadTime + 1);
      const createdAt = `${current.date}T${new Date(time).toTimeString().slice(0, 8)}.${String(time % 1000).padStart(3, "0")}`;
      const memory = { ...sample, id: `konoha-preview-${String(serial).padStart(8, "0")}`, date: current.date, createdAt };
      return { ...current, preview: true, serial, uploads: [...current.uploads, memory] };
    }),
    reset: () => setState((current) => ({ ...emptyState(true), harvests: current.harvests,
      slots: Object.fromEntries(Object.entries(current.slots).filter(([key]) => key.startsWith("real:"))) })),
    harvest: (id: string, word: string) => {
      if (!ready || !items.some((item) => item.id === id && item.stage === "quiz-ready") || !word.trim() || [...word.trim()].length > 12) return false;
      setState((current) => current.preview
        ? { ...current, previewHarvests: recordHarvest(current.uploads, current.date, current.previewHarvests, id, word) }
        : { ...current, harvests: recordHarvest(memories, today, current.harvests, id, word) });
      return true;
    },
  };
}

const TreeContext = createContext<ReturnType<typeof useTreeState> | null>(null);
export function TreeProvider({ children }: { children: React.ReactNode }) {
  const value = useTreeState();
  return <TreeContext.Provider value={value}>{children}</TreeContext.Provider>;
}
export function useTree() {
  const context = useContext(TreeContext);
  if (!context) throw new Error("useTree must be used within TreeProvider");
  return context;
}
