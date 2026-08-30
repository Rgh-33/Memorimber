"use client";

import { MemoriesProvider } from "@/lib/memories-context";
import { PreferencesProvider } from "@/lib/preferences-context";
import { ProcessingProvider } from "@/lib/processing-context";
import { ProfileProvider } from "@/lib/profile-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <ProcessingProvider>
        <ProfileProvider>
          <MemoriesProvider>{children}</MemoriesProvider>
        </ProfileProvider>
      </ProcessingProvider>
    </PreferencesProvider>
  );
}
