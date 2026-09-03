"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_TREE_DISPLAY_MODE,
  parseTreeDisplayMode,
  TREE_DISPLAY_MODE_STORAGE_KEY,
  type TreeDisplayMode,
} from "./tree-preferences";

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
  treeMode: TreeDisplayMode;
  preferencesReady: boolean;
  setTheme: (theme: AppTheme) => void;
  setColorMode: (mode: AppColorMode) => void;
  setBgmVolume: (volume: number) => void;
  setSoundEffectVolume: (volume: number) => void;
  setTreeMode: (mode: TreeDisplayMode) => void;
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
  const [treeMode, setTreeModeState] = useState<TreeDisplayMode>(DEFAULT_TREE_DISPLAY_MODE);
  const [preferencesReady, setPreferencesReady] = useState(false);

  useEffect(() => {
    let savedTheme: string | null = null;
    let savedColorMode: string | null = null;
    let savedBgmVolume: string | null = null;
    let savedSoundEffectVolume: string | null = null;
    let savedTreeMode: string | null = null;
    try {
      savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      savedColorMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
      savedBgmVolume = window.localStorage.getItem(BGM_VOLUME_STORAGE_KEY);
      savedSoundEffectVolume = window.localStorage.getItem(SOUND_EFFECT_VOLUME_STORAGE_KEY);
      savedTreeMode = window.localStorage.getItem(TREE_DISPLAY_MODE_STORAGE_KEY);
    } catch { /* Keep all defaults when browser storage is unavailable. */ }

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
    setTreeModeState(parseTreeDisplayMode(savedTreeMode));
    setPreferencesReady(true);
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

  const setTreeMode = useCallback((mode: TreeDisplayMode) => {
    setTreeModeState(mode);
    try { window.localStorage.setItem(TREE_DISPLAY_MODE_STORAGE_KEY, mode); } catch { /* In-memory choice still works. */ }
  }, []);

  const value = useMemo(() => ({
    theme,
    colorMode,
    bgmVolume,
    soundEffectVolume,
    treeMode,
    preferencesReady,
    setTheme,
    setColorMode,
    setBgmVolume,
    setSoundEffectVolume,
    setTreeMode,
  }), [theme, colorMode, bgmVolume, soundEffectVolume, treeMode, preferencesReady,
    setTheme, setColorMode, setBgmVolume, setSoundEffectVolume, setTreeMode]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
}
