"use client";

import { useEffect } from "react";
import { usePreferences } from "@/lib/preferences-context";

const BACKGROUND_COLORS = {
  light: "#edf5fd",
  dark: "#11161c",
} as const;

function upsertLink(id: string, rel: string) {
  const existing = document.getElementById(id) ?? document.querySelector(`link[rel="${rel}"]`);
  if (existing instanceof HTMLLinkElement) return existing;
  const link = document.createElement("link");
  link.id = id;
  link.rel = rel;
  document.head.append(link);
  return link;
}

export function PwaThemeMetadata() {
  const { theme, colorMode, preferencesReady } = usePreferences();

  useEffect(() => {
    if (!preferencesReady) return;
    const variant = `${theme}-${colorMode}`;
    const manifest = upsertLink("memorimber-manifest", "manifest");
    const appleTouchIcon = upsertLink("memorimber-apple-touch-icon", "apple-touch-icon");
    let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement("meta");
      themeColor.name = "theme-color";
      document.head.append(themeColor);
    }

    manifest.href = `/pwa/manifest-${variant}.webmanifest`;
    appleTouchIcon.href = `/pwa/icon-${variant}-180.png`;
    themeColor.content = BACKGROUND_COLORS[colorMode];
  }, [colorMode, preferencesReady, theme]);

  return null;
}
