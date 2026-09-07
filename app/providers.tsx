"use client";

import { usePathname } from "next/navigation";
import { SessionBoundary } from "@/components/session-boundary";
import { isPublicAuthPath } from "@/lib/browser-session-data";
import { MemoriesProvider } from "@/lib/memories-context";
import { BackgroundMusic } from "@/components/background-music";
import { PreferencesProvider } from "@/lib/preferences-context";
import { ProcessingProvider } from "@/lib/processing-context";
import { ProfileProvider } from "@/lib/profile-context";
import { ProfileLevelProvider } from "@/lib/profile-level-context";
import { TreeProvider } from "@/lib/tree-context";
import { HarvestProvider } from "@/lib/harvest-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { PwaThemeMetadata } from "@/components/pwa-theme-metadata";

export function Providers({ children }: { children: React.ReactNode }) {
  const publicPage = isPublicAuthPath(usePathname());
  return <SessionBoundary>
    {publicPage ? <ProcessingProvider>{children}</ProcessingProvider> : <PrivateProviders>{children}</PrivateProviders>}
  </SessionBoundary>;
}

function PrivateProviders({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <PwaThemeMetadata />
      <BackgroundMusic>
        <ProcessingProvider>
          <NotificationsProvider>
            <ProfileProvider>
              <MemoriesProvider><ProfileLevelProvider><TreeProvider><HarvestProvider>{children}</HarvestProvider></TreeProvider></ProfileLevelProvider></MemoriesProvider>
            </ProfileProvider>
          </NotificationsProvider>
        </ProcessingProvider>
      </BackgroundMusic>
    </PreferencesProvider>
  );
}
