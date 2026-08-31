"use client";

import { MemoriesProvider } from "@/lib/memories-context";
import { BackgroundMusic } from "@/components/background-music";
import { PreferencesProvider } from "@/lib/preferences-context";
import { ProcessingProvider } from "@/lib/processing-context";
import { ProfileProvider } from "@/lib/profile-context";
import { TreeProvider } from "@/lib/tree-context";
import { HarvestProvider } from "@/lib/harvest-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <BackgroundMusic />
      <ProcessingProvider>
        <ProfileProvider>
          <MemoriesProvider><TreeProvider><HarvestProvider>{children}</HarvestProvider></TreeProvider></MemoriesProvider>
        </ProfileProvider>
      </ProcessingProvider>
    </PreferencesProvider>
  );
}
