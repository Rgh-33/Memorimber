"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type ProfileContextValue = {
  nickname: string;
  avatarDataUrl: string | null;
  setNickname: (nickname: string) => void;
  setAvatarDataUrl: (dataUrl: string | null) => void;
};

const NICKNAME_STORAGE_KEY = "memorimber-profile-nickname";
const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [nickname, setNicknameState] = useState("メモリさん");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const savedNickname = window.localStorage.getItem(NICKNAME_STORAGE_KEY);
    if (savedNickname) setNicknameState(savedNickname);

    if (!isSupabaseConfigured() || ["/login", "/signup"].includes(window.location.pathname)) return;

    const controller = new AbortController();
    void fetch("/api/profile", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{
          profile?: { display_name?: string | null; avatar_url?: string | null };
        }>;
      })
      .then((data) => {
        const profile = data?.profile;
        if (!profile) return;
        if (profile.display_name) {
          const displayName = profile.display_name.slice(0, 20);
          setNicknameState(displayName);
          window.localStorage.setItem(NICKNAME_STORAGE_KEY, displayName);
        }
        if (profile.avatar_url) setAvatarDataUrl(profile.avatar_url);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });

    return () => controller.abort();
  }, []);

  const setNickname = useCallback((nextNickname: string) => {
    const limitedNickname = nextNickname.slice(0, 20);
    setNicknameState(limitedNickname);
    window.localStorage.setItem(NICKNAME_STORAGE_KEY, limitedNickname);
  }, []);

  const value = useMemo(() => ({
    nickname,
    avatarDataUrl,
    setNickname,
    setAvatarDataUrl,
  }), [nickname, avatarDataUrl, setNickname]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used within ProfileProvider");
  return context;
}
