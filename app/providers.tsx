"use client";

import { MemoriesProvider } from "@/lib/memories-context";
import { BackgroundMusic } from "@/components/background-music";
import { PreferencesProvider } from "@/lib/preferences-context";
import { ProcessingProvider } from "@/lib/processing-context";
import { ProfileProvider } from "@/lib/profile-context";
import { TreeProvider } from "@/lib/tree-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <BackgroundMusic />
      <ProcessingProvider>
        <ProfileProvider>
          <MemoriesProvider><TreeProvider>{children}</TreeProvider></MemoriesProvider>
        </ProfileProvider>
      </ProcessingProvider>
    </PreferencesProvider>
  );
}
