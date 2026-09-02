"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { HarvestFlight } from "@/components/harvest-flight";
import { useTree } from "@/lib/tree-context";

type Flight = { memoryId: string; word: string };
type HarvestContextValue = {
  launch: (id: string, word: string) => boolean;
  busy: boolean;
  arrivingMemoryId: string | null;
  completeArrival: (id: string) => void;
};
const HarvestContext = createContext<HarvestContextValue | null>(null);

export function HarvestProvider({ children }: { children: React.ReactNode }) {
  const tree = useTree();
  const [flight, setFlight] = useState<Flight | null>(null);
  const [arrivingMemoryId, setArrivingMemoryId] = useState<string | null>(null);
  const active = useRef(false);
  const lastMemory = useRef<string | null>(null);
  const finish = useCallback(() => {
    active.current = false;
    setArrivingMemoryId(lastMemory.current);
    setFlight(null);
  }, []);
  const completeArrival = useCallback((id: string) => {
    setArrivingMemoryId((current) => current === id ? null : current);
  }, []);

  const launch = (id: string, word: string) => {
    if (active.current) return false;
    active.current = true;
    setArrivingMemoryId(null);
    // Commit first: interrupted animation, refresh or a hidden tab cannot lose
    // the word. The provider survives the quiz disappearing after this commit.
    if (!tree.harvest(id, word)) { active.current = false; return false; }
    lastMemory.current = id;
    setFlight({ memoryId: id, word: word.trim() });
    return true;
  };

  useEffect(() => {
    if (flight || !lastMemory.current) return;
    const petal = document.querySelector<HTMLButtonElement>(`.memory-floating-word[data-memory-id="${CSS.escape(lastMemory.current)}"]`);
    // Restore keyboard navigation to the tree without outlining a floating
    // petal after a pointer submission. The next Tab reaches its first petal.
    petal?.closest<HTMLElement>(".konoha-scene")?.focus({ preventScroll: true });
    lastMemory.current = null;
  }, [flight]);

  useEffect(() => {
    if (!arrivingMemoryId) return;
    const timer = window.setTimeout(() => setArrivingMemoryId(null), 1_300);
    return () => window.clearTimeout(timer);
  }, [arrivingMemoryId]);

  return <HarvestContext.Provider value={{ launch, busy: Boolean(flight), arrivingMemoryId, completeArrival }}>
    <div inert={flight ? true : undefined}>{children}</div>
    {flight && <HarvestFlight word={flight.word} saved={tree.petals.some(petal => petal.id === flight.memoryId)} onFinish={finish} />}
  </HarvestContext.Provider>;
}

export function useHarvest() {
  const context = useContext(HarvestContext);
  if (!context) throw new Error("useHarvest must be used within HarvestProvider");
  return context;
}
