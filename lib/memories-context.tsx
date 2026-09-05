"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE_MEMORIES, getMonthKey } from "./data";
import { orderAlbumMemories } from "./album-grid";
import { getMemoryDisplayUrl, type Memory } from "./types";
import { addMemoryToCache, removeMemoryFromCache, updateMemoryInCache } from "./memories-cache";
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
  addMemory: (memory: Memory) => void;
  updateMemory: (memory: Memory) => void;
  removeMemory: (id: string) => void;
  getMemory: (id: string) => Memory | undefined;
  getMonthMemories: (monthKey: string) => Memory[];
  getRelatedMemories: (memory: Memory) => Memory[];
  resetDemo: () => void;
};

const MemoriesContext = createContext<MemoriesContextValue | null>(null);

export function MemoriesProvider({ children }: { children: React.ReactNode }) {
  const isDemo = !isSupabaseConfigured();
  const [memories, setMemories] = useState<Memory[]>(isDemo ? SAMPLE_MEMORIES : []);
  const [isLoading, setIsLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const lastSuccessfulRefresh = useRef(0);
  const activeUserId = useRef<string | null>(null);

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
      activeUserId.current = result.userId;
      lastSuccessfulRefresh.current = Date.now();
    } catch (cause) {
      if (version !== requestVersion.current) return;
      setWarning(null);
      setError(cause instanceof Error ? cause.message : "思い出を読み込めませんでした。");
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [isDemo]);

  const prepareLocalChange = useCallback(() => {
    // A response from an older full refresh must not overwrite a newer,
    // successfully persisted mutation.
    requestVersion.current += 1;
    setIsLoading(false);
    setError(null);
  }, []);

  const addMemory = useCallback((memory: Memory) => {
    prepareLocalChange();
    setMemories((current) => addMemoryToCache(current, memory));
    if (!getMemoryDisplayUrl(memory)) setWarning("一部の写真を読み込めませんでした。時間をおいて再読み込みしてください。");
  }, [prepareLocalChange]);

  const updateMemory = useCallback((memory: Memory) => {
    prepareLocalChange();
    setMemories((current) => updateMemoryInCache(current, memory));
  }, [prepareLocalChange]);

  const removeMemory = useCallback((id: string) => {
    prepareLocalChange();
    setMemories((current) => removeMemoryFromCache(current, id));
  }, [prepareLocalChange]);

  useEffect(() => {
    if (isDemo) return;
    const invalidateRequests = () => { requestVersion.current++; };
    const clearPrivateData = () => {
      invalidateRequests();
      setMemories([]);
      setIsLoading(false);
      setError(null);
      setWarning(null);
      activeUserId.current = null;
      lastSuccessfulRefresh.current = 0;
    };
    void refreshMemories();
    // Renew signed URLs before expiry, and after returning from a sleeping tab.
    const refreshIfStale = () => {
      const refreshAge = Date.now() - lastSuccessfulRefresh.current;
      if (document.visibilityState === "visible" && refreshAge >= MEMORY_IMAGE_URL_LIFETIME * 1000 / 2) {
        void refreshMemories();
      }
    };
    const interval = window.setInterval(refreshIfStale, MEMORY_IMAGE_URL_LIFETIME * 1000 / 2);
    document.addEventListener("visibilitychange", refreshIfStale);
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (event === "INITIAL_SESSION") {
        activeUserId.current = nextUserId;
        if (!nextUserId) clearPrivateData();
        return;
      }
      if (event === "SIGNED_OUT") {
        clearTimeout(refreshTimer);
        clearPrivateData();
        return;
      }
      if (event !== "SIGNED_IN" || nextUserId === activeUserId.current) return;
      clearTimeout(refreshTimer);
      clearPrivateData();
      activeUserId.current = nextUserId;
      // Auth callbacks must not await another Supabase auth call (lock).
      refreshTimer = setTimeout(() => { void refreshMemories(); }, 0);
    });
    return () => {
      invalidateRequests();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfStale);
      subscription.unsubscribe();
      clearTimeout(refreshTimer);
    };
  }, [isDemo, refreshMemories]);

  const value = useMemo<MemoriesContextValue>(
    () => ({
      memories,
      isLoading, error, warning, isDemo, refreshMemories, addMemory, updateMemory, removeMemory,
      // Tree/quiz integration is a separate issue: existing prototype links
      // still resolve their sample IDs without mixing samples into the album.
      getMemory: (id) => memories.find((memory) => memory.id === id) ?? SAMPLE_MEMORIES.find((memory) => memory.id === id),
      getMonthMemories: (monthKey) =>
        orderAlbumMemories(memories.filter((memory) => getMonthKey(memory.date) === monthKey)),
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
    [memories, isLoading, error, warning, isDemo, refreshMemories, addMemory, updateMemory, removeMemory],
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
