"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AppTheme = "light-blue" | "orange" | "blue" | "black" | "green" | "purple";
export type AppColorMode = "light" | "dark";

export const APP_THEMES: Array<{ id: AppTheme; label: string; swatch: string }> = [
  { id: "light-blue", label: "ライトブルー", swatch: "#4a90e2" },
  { id: "orange", label: "オレンジ", swatch: "#e88444" },
  { id: "blue", label: "ブルー", swatch: "#2868bd" },
  { id: "black", label: "ブラック", swatch: "#24272b" },
  { id: "green", label: "グリーン", swatch: "#3f9169" },
  { id: "purple", label: "パープル", swatch: "#8262bd" },
];

export const APP_COLOR_MODES: Array<{ id: AppColorMode; label: string }> = [
  { id: "light", label: "ライト" },
  { id: "dark", label: "ダーク" },
];

type PreferencesContextValue = {
  theme: AppTheme;
  colorMode: AppColorMode;
  bgmVolume: number;
  soundEffectVolume: number;
  setTheme: (theme: AppTheme) => void;
  setColorMode: (mode: AppColorMode) => void;
  setBgmVolume: (volume: number) => void;
  setSoundEffectVolume: (volume: number) => void;
};

const THEME_STORAGE_KEY = "memorimber-theme";
const COLOR_MODE_STORAGE_KEY = "memorimber-color-mode";
const BGM_VOLUME_STORAGE_KEY = "memorimber-bgm-volume";
const SOUND_EFFECT_VOLUME_STORAGE_KEY = "memorimber-sound-effect-volume";

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function clampVolume(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isAppTheme(value: string | null): value is AppTheme {
  return APP_THEMES.some((theme) => theme.id === value);
}

function isAppColorMode(value: string | null): value is AppColorMode {
  return APP_COLOR_MODES.some((mode) => mode.id === value);
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("light-blue");
  const [colorMode, setColorModeState] = useState<AppColorMode>("light");
  const [bgmVolume, setBgmVolumeState] = useState(55);
  const [soundEffectVolume, setSoundEffectVolumeState] = useState(70);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const savedColorMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    const savedBgmVolume = window.localStorage.getItem(BGM_VOLUME_STORAGE_KEY);
    const savedSoundEffectVolume = window.localStorage.getItem(SOUND_EFFECT_VOLUME_STORAGE_KEY);

    if (isAppTheme(savedTheme)) {
      setThemeState(savedTheme);
      document.documentElement.dataset.accent = savedTheme;
    }
    if (isAppColorMode(savedColorMode)) {
      setColorModeState(savedColorMode);
      document.documentElement.dataset.mode = savedColorMode;
    }
    if (savedBgmVolume !== null && Number.isFinite(Number(savedBgmVolume))) {
      setBgmVolumeState(clampVolume(Number(savedBgmVolume)));
    }
    if (savedSoundEffectVolume !== null && Number.isFinite(Number(savedSoundEffectVolume))) {
      setSoundEffectVolumeState(clampVolume(Number(savedSoundEffectVolume)));
    }
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    document.documentElement.dataset.accent = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }, []);

  const setColorMode = useCallback((nextMode: AppColorMode) => {
    setColorModeState(nextMode);
    document.documentElement.dataset.mode = nextMode;
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, nextMode);
  }, []);

  const setBgmVolume = useCallback((volume: number) => {
    const nextVolume = clampVolume(volume);
    setBgmVolumeState(nextVolume);
    window.localStorage.setItem(BGM_VOLUME_STORAGE_KEY, String(nextVolume));
  }, []);

  const setSoundEffectVolume = useCallback((volume: number) => {
    const nextVolume = clampVolume(volume);
    setSoundEffectVolumeState(nextVolume);
    window.localStorage.setItem(SOUND_EFFECT_VOLUME_STORAGE_KEY, String(nextVolume));
  }, []);

  const value = useMemo(() => ({
    theme,
    colorMode,
    bgmVolume,
    soundEffectVolume,
    setTheme,
    setColorMode,
    setBgmVolume,
    setSoundEffectVolume,
  }), [theme, colorMode, bgmVolume, soundEffectVolume, setTheme, setColorMode, setBgmVolume, setSoundEffectVolume]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
}
