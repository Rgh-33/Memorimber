"use client";

import { MemoriesProvider } from "@/lib/memories-context";
import { PreferencesProvider } from "@/lib/preferences-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <MemoriesProvider>{children}</MemoriesProvider>
    </PreferencesProvider>
  );
}
