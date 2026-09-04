"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ALBUM_APPEARANCE,
  isAlbumAppearance,
  resolveAlbumAppearance,
  type AlbumAppearance,
  type AlbumBackground,
  type AlbumFont,
  type AlbumLayout,
  type AlbumOrientation,
  type AlbumPattern,
  type AlbumTextColor,
} from "./album-appearance";
import { createClient } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/config";
import { loadAccountAlbumAppearance, updateAccountAlbumAppearance } from "./supabase/album-preferences";
import {
  clampAudioVolumeLevel,
  DEFAULT_AUDIO_VOLUME_LEVEL,
  isAudioVolumeLevel,
  legacyPercentToAudioVolumeLevel,
} from "./audio-volume";

export type {
  AlbumAppearance,
  AlbumBackground,
  AlbumFont,
  AlbumLayout,
  AlbumOrientation,
  AlbumPattern,
  AlbumTextColor,
} from "./album-appearance";
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

export const ALBUM_FONTS: Array<{ id: AlbumFont; label: string; description: string }> = [
  { id: "zen-kurenaido", label: "ZEN紅道", description: "細いペンで書いたような手書き文字" },
  { id: "gothic", label: "ゴシック", description: "すっきり読みやすい標準的な書体" },
  { id: "mincho", label: "明朝", description: "本の本文のような落ち着いた書体" },
  { id: "rounded", label: "やわらかゴシック", description: "親しみやすい、やさしい印象の書体" },
];

export const ALBUM_LAYOUTS: Array<{ id: AlbumLayout; label: string; description: string }> = [
  { id: "scrapbook", label: "スクラップブック", description: "チェキと走り書きを楽しむ今のレイアウト" },
  { id: "gallery", label: "写真集", description: "写真をまっすぐ大きく見せる端正なレイアウト" },
  { id: "diary", label: "日記", description: "写真と手紙をゆったり読めるレイアウト" },
];

export const ALBUM_TEXT_COLORS: Array<{ id: AlbumTextColor; label: string; color: string }> = [
  { id: "cocoa", label: "ココア", color: "#493225" },
  { id: "navy", label: "ネイビー", color: "#243a59" },
  { id: "rose", label: "ローズ", color: "#794656" },
  { id: "forest", label: "フォレスト", color: "#3c5146" },
];

export const ALBUM_BACKGROUNDS: Array<{ id: AlbumBackground; label: string; color: string }> = [
  { id: "cream", label: "クリーム", color: "#fbf8f0" },
  { id: "white", label: "ホワイト", color: "#fffdfa" },
  { id: "blush", label: "ピンクベージュ", color: "#fff3f0" },
  { id: "mist", label: "ミストブルー", color: "#f1f7f8" },
];

export const ALBUM_PATTERNS: Array<{ id: AlbumPattern; label: string; description: string }> = [
  { id: "botanical", label: "ボタニカル", description: "葉っぱと小さな光の模様" },
  { id: "plain", label: "プレーン", description: "模様を入れないシンプルな紙面" },
  { id: "dots", label: "小さなドット", description: "控えめな水玉を散らした紙面" },
  { id: "grid", label: "方眼ノート", description: "淡い方眼を重ねたノート風の紙面" },
];

export const ALBUM_ORIENTATIONS: Array<{ id: AlbumOrientation; label: string; description: string }> = [
  { id: "portrait", label: "L判・縦向き", description: "89 × 127mm。縦写真や本の1ページ向け" },
  { id: "landscape", label: "L判・横向き", description: "127 × 89mm。横写真を広く見せる向き" },
];

type PreferencesContextValue = {
  theme: AppTheme;
  colorMode: AppColorMode;
  accountAlbumAppearance: AlbumAppearance | null;
  albumAppearance: AlbumAppearance;
  albumAppearanceReady: boolean;
  albumAppearanceLoading: boolean;
  albumAppearanceSaving: boolean;
  albumAppearanceError: string | null;
  bgmVolume: number;
  soundEffectVolume: number;
  treeMode: TreeDisplayMode;
  preferencesReady: boolean;
  setTheme: (theme: AppTheme) => void;
  setColorMode: (mode: AppColorMode) => void;
  setAlbumAppearance: (appearance: AlbumAppearance) => Promise<void>;
  reloadAlbumAppearance: () => Promise<void>;
  setBgmVolume: (volume: number) => void;
  setSoundEffectVolume: (volume: number) => void;
  setTreeMode: (mode: TreeDisplayMode) => void;
};

const THEME_STORAGE_KEY = "memorimber-theme";
const COLOR_MODE_STORAGE_KEY = "memorimber-color-mode";
const ALBUM_FONT_STORAGE_KEY = "memorimber-album-font";
const ALBUM_LAYOUT_STORAGE_KEY = "memorimber-album-layout";
const ALBUM_TEXT_COLOR_STORAGE_KEY = "memorimber-album-text-color";
const ALBUM_BACKGROUND_STORAGE_KEY = "memorimber-album-background";
const ALBUM_PATTERN_STORAGE_KEY = "memorimber-album-pattern";
const ALBUM_ORIENTATION_STORAGE_KEY = "memorimber-album-orientation";
const BGM_VOLUME_STORAGE_KEY = "memorimber-bgm-volume-level";
const SOUND_EFFECT_VOLUME_STORAGE_KEY = "memorimber-sound-effect-volume-level";
const LEGACY_BGM_VOLUME_STORAGE_KEY = "memorimber-bgm-volume";
const LEGACY_SOUND_EFFECT_VOLUME_STORAGE_KEY = "memorimber-sound-effect-volume";

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function isAppTheme(value: string | null): value is AppTheme {
  return APP_THEMES.some((theme) => theme.id === value);
}

function isAppColorMode(value: string | null): value is AppColorMode {
  return APP_COLOR_MODES.some((mode) => mode.id === value);
}

function isAlbumFont(value: string | null): value is AlbumFont {
  return ALBUM_FONTS.some((font) => font.id === value);
}

function isAlbumLayout(value: string | null): value is AlbumLayout {
  return ALBUM_LAYOUTS.some((layout) => layout.id === value);
}

function isAlbumTextColor(value: string | null): value is AlbumTextColor {
  return ALBUM_TEXT_COLORS.some((color) => color.id === value);
}

function isAlbumBackground(value: string | null): value is AlbumBackground {
  return ALBUM_BACKGROUNDS.some((background) => background.id === value);
}

function isAlbumPattern(value: string | null): value is AlbumPattern {
  return ALBUM_PATTERNS.some((pattern) => pattern.id === value);
}

function isAlbumOrientation(value: string | null): value is AlbumOrientation {
  return ALBUM_ORIENTATIONS.some((orientation) => orientation.id === value);
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [theme, setThemeState] = useState<AppTheme>("light-blue");
  const [colorMode, setColorModeState] = useState<AppColorMode>("light");
  const [accountAlbumAppearance, setAccountAlbumAppearance] = useState<AlbumAppearance | null>(null);
  const [albumAppearanceReady, setAlbumAppearanceReady] = useState(false);
  const [albumAppearanceLoading, setAlbumAppearanceLoading] = useState(configured);
  const [albumAppearanceSaving, setAlbumAppearanceSaving] = useState(false);
  const [albumAppearanceError, setAlbumAppearanceError] = useState<string | null>(null);
  const [bgmVolume, setBgmVolumeState] = useState<number>(DEFAULT_AUDIO_VOLUME_LEVEL);
  const [soundEffectVolume, setSoundEffectVolumeState] = useState<number>(DEFAULT_AUDIO_VOLUME_LEVEL);
  const [treeMode, setTreeModeState] = useState<TreeDisplayMode>(DEFAULT_TREE_DISPLAY_MODE);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const albumRequestVersion = useRef(0);
  const albumSaveInFlight = useRef(false);

  useEffect(() => {
    let savedTheme: string | null = null;
    let savedColorMode: string | null = null;
    let savedAlbumFont: string | null = null;
    let savedAlbumLayout: string | null = null;
    let savedAlbumTextColor: string | null = null;
    let savedAlbumBackground: string | null = null;
    let savedAlbumPattern: string | null = null;
    let savedAlbumOrientation: string | null = null;
    let savedBgmVolume: string | null = null;
    let savedSoundEffectVolume: string | null = null;
    let savedTreeMode: string | null = null;
    try {
      savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      savedColorMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
      // Album localStorage belongs only to the unconfigured demo. Authenticated
      // accounts must never import an unscoped value left by another user.
      if (!configured) {
        savedAlbumFont = window.localStorage.getItem(ALBUM_FONT_STORAGE_KEY);
        savedAlbumLayout = window.localStorage.getItem(ALBUM_LAYOUT_STORAGE_KEY);
        savedAlbumTextColor = window.localStorage.getItem(ALBUM_TEXT_COLOR_STORAGE_KEY);
        savedAlbumBackground = window.localStorage.getItem(ALBUM_BACKGROUND_STORAGE_KEY);
        savedAlbumPattern = window.localStorage.getItem(ALBUM_PATTERN_STORAGE_KEY);
        savedAlbumOrientation = window.localStorage.getItem(ALBUM_ORIENTATION_STORAGE_KEY);
      }
      savedBgmVolume = window.localStorage.getItem(BGM_VOLUME_STORAGE_KEY);
      savedSoundEffectVolume = window.localStorage.getItem(SOUND_EFFECT_VOLUME_STORAGE_KEY);
      if (savedBgmVolume === null) {
        const legacyValue = window.localStorage.getItem(LEGACY_BGM_VOLUME_STORAGE_KEY);
        if (legacyValue !== null && Number.isFinite(Number(legacyValue))) {
          savedBgmVolume = String(legacyPercentToAudioVolumeLevel(Number(legacyValue)));
        }
      }
      if (savedSoundEffectVolume === null) {
        const legacyValue = window.localStorage.getItem(LEGACY_SOUND_EFFECT_VOLUME_STORAGE_KEY);
        if (legacyValue !== null && Number.isFinite(Number(legacyValue))) {
          savedSoundEffectVolume = String(legacyPercentToAudioVolumeLevel(Number(legacyValue)));
        }
      }
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
    if (!configured) {
      setAccountAlbumAppearance({
        font: isAlbumFont(savedAlbumFont) ? savedAlbumFont : DEFAULT_ALBUM_APPEARANCE.font,
        layout: isAlbumLayout(savedAlbumLayout) ? savedAlbumLayout : DEFAULT_ALBUM_APPEARANCE.layout,
        textColor: isAlbumTextColor(savedAlbumTextColor) ? savedAlbumTextColor : DEFAULT_ALBUM_APPEARANCE.textColor,
        background: isAlbumBackground(savedAlbumBackground) ? savedAlbumBackground : DEFAULT_ALBUM_APPEARANCE.background,
        pattern: isAlbumPattern(savedAlbumPattern) ? savedAlbumPattern : DEFAULT_ALBUM_APPEARANCE.pattern,
        orientation: isAlbumOrientation(savedAlbumOrientation) ? savedAlbumOrientation : DEFAULT_ALBUM_APPEARANCE.orientation,
      });
      setAlbumAppearanceReady(true);
      setAlbumAppearanceLoading(false);
    }
    if (savedBgmVolume !== null && isAudioVolumeLevel(Number(savedBgmVolume))) {
      setBgmVolumeState(Number(savedBgmVolume));
    }
    if (savedSoundEffectVolume !== null && isAudioVolumeLevel(Number(savedSoundEffectVolume))) {
      setSoundEffectVolumeState(Number(savedSoundEffectVolume));
    }
    setTreeModeState(parseTreeDisplayMode(savedTreeMode));
    setPreferencesReady(true);
  }, [configured]);

  const reloadAlbumAppearance = useCallback(async () => {
    if (!configured) return;
    const version = ++albumRequestVersion.current;
    setAlbumAppearanceLoading(true);
    setAlbumAppearanceReady(false);
    setAlbumAppearanceError(null);
    try {
      const appearance = await loadAccountAlbumAppearance(createClient());
      if (version !== albumRequestVersion.current) return;
      setAccountAlbumAppearance(appearance);
      setAlbumAppearanceReady(true);
    } catch (cause) {
      if (version !== albumRequestVersion.current) return;
      setAlbumAppearanceError(cause instanceof Error ? cause.message : "アルバム設定を読み込めませんでした。");
    } finally {
      if (version === albumRequestVersion.current) setAlbumAppearanceLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const clearPrivateAlbumPreference = () => {
      albumRequestVersion.current += 1;
      albumSaveInFlight.current = false;
      setAccountAlbumAppearance(null);
      setAlbumAppearanceReady(false);
      setAlbumAppearanceLoading(false);
      setAlbumAppearanceSaving(false);
      setAlbumAppearanceError(null);
    };

    if (["/login", "/signup"].includes(window.location.pathname)) clearPrivateAlbumPreference();
    else void reloadAlbumAppearance();

    const { data: { subscription } } = createClient().auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT" && event !== "SIGNED_IN") return;
      clearTimeout(refreshTimer);
      clearPrivateAlbumPreference();
      // Supabase auth callbacks hold an internal lock, so defer the next auth call.
      if (event === "SIGNED_IN") refreshTimer = setTimeout(() => { void reloadAlbumAppearance(); }, 0);
    });

    return () => {
      albumRequestVersion.current += 1;
      subscription.unsubscribe();
      clearTimeout(refreshTimer);
    };
  }, [configured, reloadAlbumAppearance]);

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

  const setAlbumAppearance = useCallback(async (appearance: AlbumAppearance) => {
    if (albumSaveInFlight.current) return;
    if (!isAlbumAppearance(appearance)) {
      setAlbumAppearanceError("アルバムの見た目設定が正しくありません。");
      return;
    }
    if (configured && !albumAppearanceReady) {
      setAlbumAppearanceError("アルバム設定を読み込んでから、もう一度お試しください。");
      return;
    }

    const previous = accountAlbumAppearance;
    const version = ++albumRequestVersion.current;
    albumSaveInFlight.current = true;
    setAccountAlbumAppearance(appearance);
    setAlbumAppearanceSaving(true);
    setAlbumAppearanceError(null);
    try {
      if (configured) {
        const saved = await updateAccountAlbumAppearance(createClient(), appearance);
        if (version === albumRequestVersion.current) setAccountAlbumAppearance(saved);
      } else {
        window.localStorage.setItem(ALBUM_FONT_STORAGE_KEY, appearance.font);
        window.localStorage.setItem(ALBUM_LAYOUT_STORAGE_KEY, appearance.layout);
        window.localStorage.setItem(ALBUM_TEXT_COLOR_STORAGE_KEY, appearance.textColor);
        window.localStorage.setItem(ALBUM_BACKGROUND_STORAGE_KEY, appearance.background);
        window.localStorage.setItem(ALBUM_PATTERN_STORAGE_KEY, appearance.pattern);
        window.localStorage.setItem(ALBUM_ORIENTATION_STORAGE_KEY, appearance.orientation);
      }
    } catch (cause) {
      if (version !== albumRequestVersion.current) return;
      setAccountAlbumAppearance(previous);
      setAlbumAppearanceError(cause instanceof Error ? cause.message : "アルバム設定を保存できませんでした。");
    } finally {
      albumSaveInFlight.current = false;
      if (version === albumRequestVersion.current) setAlbumAppearanceSaving(false);
    }
  }, [accountAlbumAppearance, albumAppearanceReady, configured]);

  const setBgmVolume = useCallback((volume: number) => {
    const nextVolume = clampAudioVolumeLevel(volume);
    setBgmVolumeState(nextVolume);
    window.localStorage.setItem(BGM_VOLUME_STORAGE_KEY, String(nextVolume));
  }, []);

  const setSoundEffectVolume = useCallback((volume: number) => {
    const nextVolume = clampAudioVolumeLevel(volume);
    setSoundEffectVolumeState(nextVolume);
    window.localStorage.setItem(SOUND_EFFECT_VOLUME_STORAGE_KEY, String(nextVolume));
  }, []);

  const setTreeMode = useCallback((mode: TreeDisplayMode) => {
    setTreeModeState(mode);
    try { window.localStorage.setItem(TREE_DISPLAY_MODE_STORAGE_KEY, mode); } catch { /* In-memory choice still works. */ }
  }, []);

  const albumAppearance = useMemo(
    () => resolveAlbumAppearance(null, accountAlbumAppearance),
    [accountAlbumAppearance],
  );

  const value = useMemo(() => ({
    theme,
    colorMode,
    accountAlbumAppearance,
    albumAppearance,
    albumAppearanceReady,
    albumAppearanceLoading,
    albumAppearanceSaving,
    albumAppearanceError,
    bgmVolume,
    soundEffectVolume,
    treeMode,
    preferencesReady,
    setTheme,
    setColorMode,
    setAlbumAppearance,
    reloadAlbumAppearance,
    setBgmVolume,
    setSoundEffectVolume,
    setTreeMode,
  }), [theme, colorMode, accountAlbumAppearance, albumAppearance, albumAppearanceReady,
    albumAppearanceLoading, albumAppearanceSaving, albumAppearanceError, bgmVolume, soundEffectVolume,
    treeMode, preferencesReady, setTheme, setColorMode, setAlbumAppearance, reloadAlbumAppearance,
    setBgmVolume, setSoundEffectVolume, setTreeMode]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
}
