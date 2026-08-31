"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SAMPLE_MEMORIES, getMonthKey } from "./data";
import { Memory } from "./types";
import { createClient } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/config";
import { loadMemories, MEMORY_IMAGE_URL_LIFETIME } from "./supabase/memories";

type MemoriesContextValue = {
  memories: Memory[];
  isLoading: boolean;
  error: string | null;
  warning: string | null;
  isDemo: boolean;
  refreshMemories: () => Promise<void>;
  getMemory: (id: string) => Memory | undefined;
  getMonthMemories: (monthKey: string) => Memory[];
  getRelatedMemories: (memory: Memory) => Memory[];
  resetDemo: () => void;
};

const MemoriesContext = createContext<MemoriesContextValue | null>(null);

export function MemoriesProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDemo = !isSupabaseConfigured();
  const [memories, setMemories] = useState<Memory[]>(isDemo ? SAMPLE_MEMORIES : []);
  const [isLoading, setIsLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const refreshMemories = useCallback(async () => {
    if (isDemo) return;
    const version = ++requestVersion.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await loadMemories(createClient());
      if (version !== requestVersion.current) return;
      setMemories(result.memories);
      setWarning(result.warning);
    } catch (cause) {
      if (version !== requestVersion.current) return;
      setMemories([]);
      setWarning(null);
      setError(cause instanceof Error ? cause.message : "思い出を読み込めませんでした。");
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    if (isDemo) return;
    const invalidateRequests = () => { requestVersion.current++; };
    const clearPrivateData = () => {
      invalidateRequests();
      setMemories([]);
      setIsLoading(false);
      setError(null);
      setWarning(null);
    };
    if (["/login", "/signup"].includes(pathname)) {
      clearPrivateData();
      return;
    }
    void refreshMemories();
    // Renew signed URLs before expiry, and after returning from a sleeping tab.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshMemories();
    };
    const interval = window.setInterval(onVisible, MEMORY_IMAGE_URL_LIFETIME * 1000 / 2);
    document.addEventListener("visibilitychange", onVisible);
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        clearTimeout(refreshTimer);
        clearPrivateData();
        // Auth callbacks must not await another Supabase auth call (lock).
        if (event === "SIGNED_IN") refreshTimer = setTimeout(() => { void refreshMemories(); }, 0);
      }
    });
    return () => {
      invalidateRequests();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      subscription.unsubscribe();
      clearTimeout(refreshTimer);
    };
  }, [isDemo, pathname, refreshMemories]);

  const value = useMemo<MemoriesContextValue>(
    () => ({
      memories,
      isLoading, error, warning, isDemo, refreshMemories,
      // Tree/quiz integration is a separate issue: existing prototype links
      // still resolve their sample IDs without mixing samples into the album.
      getMemory: (id) => memories.find((memory) => memory.id === id) ?? SAMPLE_MEMORIES.find((memory) => memory.id === id),
      getMonthMemories: (monthKey) =>
        memories
          .filter((memory) => getMonthKey(memory.date) === monthKey)
          .sort((a, b) => b.date.localeCompare(a.date)),
      getRelatedMemories: (memory) =>
        (SAMPLE_MEMORIES.some((sample) => sample.id === memory.id) ? SAMPLE_MEMORIES : memories)
          .filter((candidate) => candidate.id !== memory.id)
          .map((candidate) => ({
            candidate,
            score:
              candidate.people.filter((person) => memory.people.includes(person)).length * 3 +
              candidate.tags.filter((tag) => memory.tags.includes(tag)).length * 2 +
              (getMonthKey(candidate.date) === getMonthKey(memory.date) ? 1 : 0),
          }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map(({ candidate }) => candidate),
      // This menu action must never delete persisted photos or database rows.
      resetDemo: () => { if (isDemo) setMemories(SAMPLE_MEMORIES); },
    }),
    [memories, isLoading, error, warning, isDemo, refreshMemories],
  );

  return <MemoriesContext.Provider value={value}>{children}</MemoriesContext.Provider>;
}

export function useMemories() {
  const context = useContext(MemoriesContext);
  if (!context) {
    throw new Error("useMemories must be used inside MemoriesProvider");
  }
  return context;
}
