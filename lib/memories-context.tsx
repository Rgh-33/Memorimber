"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { SAMPLE_MEMORIES, getMonthKey } from "./data";
import { Memory, MemoryInput } from "./types";

type MemoriesContextValue = {
  memories: Memory[];
  addMemory: (input: MemoryInput) => string;
  getMemory: (id: string) => Memory | undefined;
  getMonthMemories: (monthKey: string) => Memory[];
  getRelatedMemories: (memory: Memory) => Memory[];
  resetDemo: () => void;
};

const MemoriesContext = createContext<MemoriesContextValue | null>(null);

export function MemoriesProvider({ children }: { children: React.ReactNode }) {
  const [memories, setMemories] = useState<Memory[]>(SAMPLE_MEMORIES);

  const value = useMemo<MemoriesContextValue>(
    () => ({
      memories,
      addMemory: (input) => {
        const id = `memory-${Date.now()}`;
        setMemories((current) => [{ id, ...input }, ...current]);
        return id;
      },
      getMemory: (id) => memories.find((memory) => memory.id === id),
      getMonthMemories: (monthKey) =>
        memories
          .filter((memory) => getMonthKey(memory.date) === monthKey)
          .sort((a, b) => b.date.localeCompare(a.date)),
      getRelatedMemories: (memory) =>
        memories
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
      resetDemo: () => setMemories(SAMPLE_MEMORIES),
    }),
    [memories],
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
