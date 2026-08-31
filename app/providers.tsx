"use client";

import { MemoriesProvider } from "@/lib/memories-context";
import { BackgroundMusic } from "@/components/background-music";
import { PreferencesProvider } from "@/lib/preferences-context";
import { ProcessingProvider } from "@/lib/processing-context";
import { ProfileProvider } from "@/lib/profile-context";
import { TeaProvider } from "@/lib/tea-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <BackgroundMusic />
      <ProcessingProvider>
        <ProfileProvider>
          <MemoriesProvider><TeaProvider>{children}</TeaProvider></MemoriesProvider>
        </ProfileProvider>
      </ProcessingProvider>
    </PreferencesProvider>
  );
}
