"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE_MEMORIES } from "./data";
import { useMemories } from "./memories-context";
import type { Memory } from "./types";
import { addTeaMemories, drinkPearl, emptyTea, localMonth, nextMonth, readTeaState, rollTeaMonth, type TeaState } from "./tea-state";

function previewMemories(count: number, month: string): Memory[] {
  return Array.from({ length: count }, (_, index) => ({
    ...SAMPLE_MEMORIES[index % SAMPLE_MEMORIES.length],
    sourceMemoryId: SAMPLE_MEMORIES[index % SAMPLE_MEMORIES.length].id,
    id: `tea-preview-${index + 1}`,
    createdAt: `${month}-${String(Math.min(index + 1, 28)).padStart(2, "0")}T12:00:00`,
  }));
}

function previewState(month: string) {
  let state = addTeaMemories(emptyTea(month), previewMemories(12, month));
  for (let index = 0; index < 3; index++) state = drinkPearl(state, state.pearls[0], true);
  return state;
}

type TeaContextValue = {
  state: TeaState;
  memories: Memory[];
  loaded: boolean;
  isPreview: boolean;
  storageWarning: boolean;
  lastSip: string | null;
  enteringIds: string[];
  completeQuiz: (id: string, correct: boolean) => boolean;
  clearSip: () => void;
  settlePearls: () => void;
  dismissRollover: () => void;
  startPreview: () => void;
  exitPreview: () => void;
  addPreview: () => void;
  advancePreviewMonth: () => void;
  resetPreview: () => void;
};
const TeaContext = createContext<TeaContextValue | null>(null);

export function TeaProvider({ children }: { children: React.ReactNode }) {
  const { ownerId, isDemo } = useMemories();
  const [preview, setPreview] = useState(false);
  const isPreview = isDemo || preview;
  return <TeaSession key={isPreview ? "preview" : ownerId ?? "signed-out"} ownerId={ownerId} isPreview={isPreview} startPreview={() => setPreview(true)} exitPreview={() => setPreview(false)}>{children}</TeaSession>;
}

function TeaSession({ children, ownerId, isPreview, startPreview, exitPreview }: {
  children: React.ReactNode; ownerId: string | null; isPreview: boolean;
  startPreview: () => void; exitPreview: () => void;
}) {
  const { memories: savedMemories, isLoading, error } = useMemories();
  // Stable server snapshot: the browser's local month is applied on mount.
  const [state, setState] = useState<TeaState>(() => emptyTea("2000-01"));
  const stateRef = useRef(state);
  const [loaded, setLoaded] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [lastSip, setLastSip] = useState<string | null>(null);
  const [enteringIds, setEnteringIds] = useState<string[]>([]);
  const hasSyncedMemories = useRef(false);
  const storageKey = isPreview ? "memorimber-tapioca-preview-v1" : ownerId ? `memorimber-tapioca-v1:${ownerId}` : null;

  const commit = useCallback((update: (current: TeaState) => TeaState) => {
    const previous = stateRef.current;
    const next = update(previous);
    stateRef.current = next;
    setState(next);
    return next !== previous;
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    let initial = emptyTea(localMonth());
    try {
      const raw = window.localStorage.getItem(storageKey);
      initial = isPreview && !raw ? previewState(localMonth()) : readTeaState(raw, localMonth());
    } catch {
      setStorageWarning(true);
      if (isPreview) initial = previewState(localMonth());
    }
    commit(() => initial);
    setLoaded(true);
  }, [storageKey, isPreview, commit]);

  useEffect(() => {
    if (!loaded || isPreview || isLoading || error) return;
    const previous = stateRef.current;
    const next = addTeaMemories(rollTeaMonth(previous, localMonth()), savedMemories);
    const additions = next.seen.filter((id) => !previous.seen.includes(id));
    if (hasSyncedMemories.current && additions.length) setEnteringIds(additions);
    hasSyncedMemories.current = true;
    commit(() => next);
  }, [savedMemories, isPreview, isLoading, error, loaded, commit]);

  useEffect(() => {
    if (!loaded || !storageKey) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch { setStorageWarning(true); }
  }, [state, storageKey, loaded]);

  useEffect(() => {
    if (!loaded || isPreview) return;
    const check = () => {
      if (document.visibilityState === "visible") commit((current) => rollTeaMonth(current, localMonth()));
    };
    const timer = window.setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, [loaded, isPreview, commit]);

  // Another tab's updates replace this local cache; no account data is ever
  // mixed with preview state. This prototype is intentionally browser-local.
  useEffect(() => {
    if (!storageKey) return;
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue) commit(() => readTeaState(event.newValue, isPreview ? stateRef.current.month : localMonth()));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [storageKey, isPreview, commit]);

  const completeQuiz = useCallback((id: string, correct: boolean) => {
    if (!loaded || (!isPreview && (isLoading || error))) return false;
    if (!isPreview) commit((current) => rollTeaMonth(current, localMonth()));
    const changed = commit((current) => drinkPearl(current, id, correct));
    if (changed) setLastSip(id);
    return changed;
  }, [commit, loaded, isPreview, isLoading, error]);

  const memories = useMemo(() => isPreview ? previewMemories(state.seen.length, state.month) : savedMemories, [isPreview, savedMemories, state.seen.length, state.month]);
  const value: TeaContextValue = {
    state, memories, loaded: loaded && (isPreview || (!isLoading && !error)), isPreview, storageWarning, lastSip, enteringIds,
    completeQuiz, startPreview, exitPreview,
    clearSip: useCallback(() => setLastSip(null), []),
    settlePearls: useCallback(() => setEnteringIds([]), []),
    dismissRollover: () => commit((current) => ({ ...current, rollover: null })),
    addPreview: () => { if (isPreview) { const next = addTeaMemories(stateRef.current, previewMemories(stateRef.current.seen.length + 1, stateRef.current.month)); setEnteringIds([next.seen[next.seen.length - 1]]); commit(() => next); } },
    advancePreviewMonth: () => { if (isPreview) commit((current) => rollTeaMonth(current, nextMonth(current.month))); },
    resetPreview: () => { if (isPreview) { setLastSip(null); setEnteringIds([]); commit(() => previewState(localMonth())); } },
  };
  return <TeaContext.Provider value={value}>{children}</TeaContext.Provider>;
}

export function useTea() {
  const context = useContext(TeaContext);
  if (!context) throw new Error("useTea must be used inside TeaProvider");
  return context;
}
