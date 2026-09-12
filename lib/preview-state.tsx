"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SAMPLE_MEMORIES } from "./data";
import type { Memory } from "./types";

const STORAGE_KEY = "memorimber-preview-state-v2";

type PreviewState = {
  active: boolean;
  currentDate: string;
  memories: Memory[];
  serial: number;
};

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function initialMemories(date: string): Memory[] {
  const [year, month] = date.split("-");
  // Keep all eight in the selected month's opening days so the initial tree
  // already demonstrates the existing seven-later-uploads ripening rule.
  const days = [1, 2, 3, 4, 5, 6, 7, 8];
  const current = days.map((day, index) => ({
    ...SAMPLE_MEMORIES[index % SAMPLE_MEMORIES.length],
    id: `preview-sample-${index + 1}`,
    date: `${year}-${month}-${String(day).padStart(2, "0")}`,
    createdAt: `${year}-${month}-${String(day).padStart(2, "0")}T12:00:00.000`,
  }));
  const anniversary = SAMPLE_MEMORIES.slice(0, 2).map((memory, index) => ({
    ...memory,
    id: `preview-anniversary-${index + 1}`,
    date: `${Number(year) - index - 1}-${month}-${String(Math.max(1, Number(date.slice(8)) - index)).padStart(2, "0")}`,
    createdAt: `${Number(year) - index - 1}-${month}-01T12:00:00.000`,
  }));
  return [...current, ...anniversary];
}

function freshState(active = false): PreviewState {
  const currentDate = localDate();
  return { active, currentDate, memories: initialMemories(currentDate), serial: 0 };
}

function clearedState(active: boolean): PreviewState {
  return { active, currentDate: localDate(), memories: [], serial: 0 };
}

function restore(): PreviewState {
  const fallback = freshState(false);
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as Partial<PreviewState> | null;
    if (!value || typeof value.active !== "boolean" || typeof value.currentDate !== "string"
      || !/^\d{4}-\d{2}-\d{2}$/.test(value.currentDate) || !Array.isArray(value.memories)) return fallback;
    const memories = value.memories.filter((memory): memory is Memory => Boolean(memory && typeof memory.id === "string"
      && typeof memory.date === "string" && typeof memory.imageUrl === "string" && typeof memory.caption === "string"
      && Array.isArray(memory.people) && Array.isArray(memory.tags)));
    // An empty list is intentional after the user resets the preview. Do not
    // silently restore the sample photos on the next navigation or reload.
    return { active: value.active, currentDate: value.currentDate, memories, serial: Number.isSafeInteger(value.serial) ? value.serial! : 0 };
  } catch { return fallback; }
}

type PreviewContextValue = PreviewState & {
  ready: boolean;
  setActive: (active: boolean) => void;
  setCurrentDate: (date: string) => void;
  addMemory: (input: Omit<Memory, "id">) => Memory;
  updateMemory: (memory: Memory) => void;
  removeMemory: (id: string) => void;
  reset: () => void;
};

const PreviewContext = createContext<PreviewContextValue | null>(null);

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PreviewState>(() => freshState(false));
  const [ready, setReady] = useState(false);
  useEffect(() => { setState(restore()); setReady(true); }, []);
  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Large browser-only photos may remain in React memory. */ }
  }, [ready, state]);
  const addMemory = useCallback((input: Omit<Memory, "id">) => {
    const added: Memory = { ...input, id: `preview-memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    setState((current) => {
      const serial = current.serial + 1;
      return { ...current, active: true, serial, memories: [...current.memories, added] };
    });
    return added;
  }, []);
  const value = useMemo<PreviewContextValue>(() => ({ ...state, ready,
    setActive: (active) => setState((current) => ({ ...current, active })),
    setCurrentDate: (currentDate) => { if (/^\d{4}-\d{2}-\d{2}$/.test(currentDate)) setState((current) => ({ ...current, active: true, currentDate })); },
    addMemory,
    updateMemory: (memory) => setState((current) => ({ ...current, memories: current.memories.map((item) => item.id === memory.id ? memory : item) })),
    removeMemory: (id) => setState((current) => ({ ...current, memories: current.memories.filter((item) => item.id !== id) })),
    reset: () => setState((current) => clearedState(current.active)),
  }), [addMemory, ready, state]);
  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export function usePreviewState() {
  const value = useContext(PreviewContext);
  if (!value) throw new Error("usePreviewState must be used within PreviewProvider");
  return value;
}
