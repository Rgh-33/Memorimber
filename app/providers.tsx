"use client";

import { MemoriesProvider } from "@/lib/memories-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <MemoriesProvider>{children}</MemoriesProvider>;
}
