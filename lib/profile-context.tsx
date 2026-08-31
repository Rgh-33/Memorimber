"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type ProfileContextValue = {
  nickname: string;
  avatarDataUrl: string | null;
  setNickname: (nickname: string) => Promise<void>;
  setAvatarFile: (file: File) => Promise<void>;
};

type ProfileResponse = { profile?: { display_name?: string | null; avatar_url?: string | null }; error?: string };
const NICKNAME_STORAGE_KEY = "memorimber-profile-nickname";
const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [nickname, setNicknameState] = useState("メモリさん");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const localAvatarUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (localAvatarUrlRef.current) URL.revokeObjectURL(localAvatarUrlRef.current);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      const savedNickname = window.localStorage.getItem(NICKNAME_STORAGE_KEY);
      if (savedNickname) setNicknameState(savedNickname);
      return;
    }
    if (["/login", "/signup"].includes(window.location.pathname)) return;

    const controller = new AbortController();
    void fetch("/api/profile", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<ProfileResponse> : null)
      .then((data) => {
        if (!data?.profile) return;
        setNicknameState(data.profile.display_name?.slice(0, 20) || "メモリさん");
        setAvatarDataUrl(data.profile.avatar_url ?? null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);

  const setNickname = useCallback(async (nextNickname: string) => {
    const limitedNickname = nextNickname.trim().slice(0, 20);
    if (!limitedNickname) throw new Error("ユーザー名を入力してください。");
    if (!isSupabaseConfigured()) {
      setNicknameState(limitedNickname);
      window.localStorage.setItem(NICKNAME_STORAGE_KEY, limitedNickname);
      return;
    }
    const response = await fetch("/api/profile", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: limitedNickname }),
    });
    const data = await response.json() as ProfileResponse;
    if (!response.ok || !data.profile?.display_name) throw new Error(data.error || "ユーザー名を保存できませんでした。");
    setNicknameState(data.profile.display_name);
  }, []);

  const setAvatarFile = useCallback(async (file: File) => {
    if (!isSupabaseConfigured()) {
      const nextAvatarUrl = URL.createObjectURL(file);
      if (localAvatarUrlRef.current) URL.revokeObjectURL(localAvatarUrlRef.current);
      localAvatarUrlRef.current = nextAvatarUrl;
      setAvatarDataUrl(nextAvatarUrl);
      return;
    }
    const body = new FormData();
    body.set("avatar", file);
    const response = await fetch("/api/profile", { method: "POST", credentials: "same-origin", body });
    const data = await response.json() as ProfileResponse;
    if (!response.ok || !data.profile?.avatar_url) throw new Error(data.error || "プロフィール写真を保存できませんでした。");
    setAvatarDataUrl(data.profile.avatar_url);
  }, []);

  const value = useMemo(() => ({ nickname, avatarDataUrl, setNickname, setAvatarFile }), [nickname, avatarDataUrl, setNickname, setAvatarFile]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used within ProfileProvider");
  return context;
}
