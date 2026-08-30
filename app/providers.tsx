"use client";

import { MemoriesProvider } from "@/lib/memories-context";
import { BackgroundMusic } from "@/components/background-music";
import { PreferencesProvider } from "@/lib/preferences-context";
import { ProcessingProvider } from "@/lib/processing-context";
import { ProfileProvider } from "@/lib/profile-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <BackgroundMusic />
      <ProcessingProvider>
        <ProfileProvider>
          <MemoriesProvider>{children}</MemoriesProvider>
        </ProfileProvider>
      </ProcessingProvider>
    </PreferencesProvider>
  );
}
