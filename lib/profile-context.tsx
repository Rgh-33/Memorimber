"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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
