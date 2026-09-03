"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ALBUM_APPEARANCE,
  type AlbumAppearance,
  type AlbumBackground,
  type AlbumFont,
  type AlbumLayout,
  type AlbumOrientation,
  type AlbumPattern,
  type AlbumTextColor,
} from "./album-appearance";

export type {
  AlbumAppearance,
  AlbumBackground,
  AlbumFont,
  AlbumLayout,
  AlbumOrientation,
  AlbumPattern,
  AlbumTextColor,
} from "./album-appearance";

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
  albumFont: AlbumFont;
  albumLayout: AlbumLayout;
  albumTextColor: AlbumTextColor;
  albumBackground: AlbumBackground;
  albumPattern: AlbumPattern;
  albumOrientation: AlbumOrientation;
  albumAppearance: AlbumAppearance;
  bgmVolume: number;
  soundEffectVolume: number;
  setTheme: (theme: AppTheme) => void;
  setColorMode: (mode: AppColorMode) => void;
  setAlbumFont: (font: AlbumFont) => void;
  setAlbumLayout: (layout: AlbumLayout) => void;
  setAlbumTextColor: (color: AlbumTextColor) => void;
  setAlbumBackground: (background: AlbumBackground) => void;
  setAlbumPattern: (pattern: AlbumPattern) => void;
  setAlbumOrientation: (orientation: AlbumOrientation) => void;
  setAlbumAppearance: (appearance: AlbumAppearance) => void;
  setBgmVolume: (volume: number) => void;
  setSoundEffectVolume: (volume: number) => void;
};

const THEME_STORAGE_KEY = "memorimber-theme";
const COLOR_MODE_STORAGE_KEY = "memorimber-color-mode";
const ALBUM_FONT_STORAGE_KEY = "memorimber-album-font";
const ALBUM_LAYOUT_STORAGE_KEY = "memorimber-album-layout";
const ALBUM_TEXT_COLOR_STORAGE_KEY = "memorimber-album-text-color";
const ALBUM_BACKGROUND_STORAGE_KEY = "memorimber-album-background";
const ALBUM_PATTERN_STORAGE_KEY = "memorimber-album-pattern";
const ALBUM_ORIENTATION_STORAGE_KEY = "memorimber-album-orientation";
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
  const [theme, setThemeState] = useState<AppTheme>("light-blue");
  const [colorMode, setColorModeState] = useState<AppColorMode>("light");
  const [albumFont, setAlbumFontState] = useState<AlbumFont>(DEFAULT_ALBUM_APPEARANCE.font);
  const [albumLayout, setAlbumLayoutState] = useState<AlbumLayout>(DEFAULT_ALBUM_APPEARANCE.layout);
  const [albumTextColor, setAlbumTextColorState] = useState<AlbumTextColor>(DEFAULT_ALBUM_APPEARANCE.textColor);
  const [albumBackground, setAlbumBackgroundState] = useState<AlbumBackground>(DEFAULT_ALBUM_APPEARANCE.background);
  const [albumPattern, setAlbumPatternState] = useState<AlbumPattern>(DEFAULT_ALBUM_APPEARANCE.pattern);
  const [albumOrientation, setAlbumOrientationState] = useState<AlbumOrientation>(DEFAULT_ALBUM_APPEARANCE.orientation);
  const [bgmVolume, setBgmVolumeState] = useState(55);
  const [soundEffectVolume, setSoundEffectVolumeState] = useState(70);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const savedColorMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    const savedAlbumFont = window.localStorage.getItem(ALBUM_FONT_STORAGE_KEY);
    const savedAlbumLayout = window.localStorage.getItem(ALBUM_LAYOUT_STORAGE_KEY);
    const savedAlbumTextColor = window.localStorage.getItem(ALBUM_TEXT_COLOR_STORAGE_KEY);
    const savedAlbumBackground = window.localStorage.getItem(ALBUM_BACKGROUND_STORAGE_KEY);
    const savedAlbumPattern = window.localStorage.getItem(ALBUM_PATTERN_STORAGE_KEY);
    const savedAlbumOrientation = window.localStorage.getItem(ALBUM_ORIENTATION_STORAGE_KEY);
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
    if (isAlbumFont(savedAlbumFont)) {
      setAlbumFontState(savedAlbumFont);
    }
    if (isAlbumLayout(savedAlbumLayout)) setAlbumLayoutState(savedAlbumLayout);
    if (isAlbumTextColor(savedAlbumTextColor)) setAlbumTextColorState(savedAlbumTextColor);
    if (isAlbumBackground(savedAlbumBackground)) setAlbumBackgroundState(savedAlbumBackground);
    if (isAlbumPattern(savedAlbumPattern)) setAlbumPatternState(savedAlbumPattern);
    if (isAlbumOrientation(savedAlbumOrientation)) setAlbumOrientationState(savedAlbumOrientation);
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

  const setAlbumFont = useCallback((nextFont: AlbumFont) => {
    setAlbumFontState(nextFont);
    window.localStorage.setItem(ALBUM_FONT_STORAGE_KEY, nextFont);
  }, []);

  const setAlbumLayout = useCallback((nextLayout: AlbumLayout) => {
    setAlbumLayoutState(nextLayout);
    window.localStorage.setItem(ALBUM_LAYOUT_STORAGE_KEY, nextLayout);
  }, []);

  const setAlbumTextColor = useCallback((nextColor: AlbumTextColor) => {
    setAlbumTextColorState(nextColor);
    window.localStorage.setItem(ALBUM_TEXT_COLOR_STORAGE_KEY, nextColor);
  }, []);

  const setAlbumBackground = useCallback((nextBackground: AlbumBackground) => {
    setAlbumBackgroundState(nextBackground);
    window.localStorage.setItem(ALBUM_BACKGROUND_STORAGE_KEY, nextBackground);
  }, []);

  const setAlbumPattern = useCallback((nextPattern: AlbumPattern) => {
    setAlbumPatternState(nextPattern);
    window.localStorage.setItem(ALBUM_PATTERN_STORAGE_KEY, nextPattern);
  }, []);

  const setAlbumOrientation = useCallback((nextOrientation: AlbumOrientation) => {
    setAlbumOrientationState(nextOrientation);
    window.localStorage.setItem(ALBUM_ORIENTATION_STORAGE_KEY, nextOrientation);
  }, []);

  const setAlbumAppearance = useCallback((appearance: AlbumAppearance) => {
    setAlbumFontState(appearance.font);
    setAlbumLayoutState(appearance.layout);
    setAlbumTextColorState(appearance.textColor);
    setAlbumBackgroundState(appearance.background);
    setAlbumPatternState(appearance.pattern);
    setAlbumOrientationState(appearance.orientation);
    window.localStorage.setItem(ALBUM_FONT_STORAGE_KEY, appearance.font);
    window.localStorage.setItem(ALBUM_LAYOUT_STORAGE_KEY, appearance.layout);
    window.localStorage.setItem(ALBUM_TEXT_COLOR_STORAGE_KEY, appearance.textColor);
    window.localStorage.setItem(ALBUM_BACKGROUND_STORAGE_KEY, appearance.background);
    window.localStorage.setItem(ALBUM_PATTERN_STORAGE_KEY, appearance.pattern);
    window.localStorage.setItem(ALBUM_ORIENTATION_STORAGE_KEY, appearance.orientation);
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

  const albumAppearance = useMemo<AlbumAppearance>(() => ({
    font: albumFont,
    layout: albumLayout,
    textColor: albumTextColor,
    background: albumBackground,
    pattern: albumPattern,
    orientation: albumOrientation,
  }), [albumBackground, albumFont, albumLayout, albumOrientation, albumPattern, albumTextColor]);

  const value = useMemo(() => ({
    theme,
    colorMode,
    albumFont,
    albumLayout,
    albumTextColor,
    albumBackground,
    albumPattern,
    albumOrientation,
    albumAppearance,
    bgmVolume,
    soundEffectVolume,
    setTheme,
    setColorMode,
    setAlbumFont,
    setAlbumLayout,
    setAlbumTextColor,
    setAlbumBackground,
    setAlbumPattern,
    setAlbumOrientation,
    setAlbumAppearance,
    setBgmVolume,
    setSoundEffectVolume,
  }), [theme, colorMode, albumFont, albumLayout, albumTextColor, albumBackground, albumPattern, albumOrientation, albumAppearance, bgmVolume, soundEffectVolume, setTheme, setColorMode, setAlbumFont, setAlbumLayout, setAlbumTextColor, setAlbumBackground, setAlbumPattern, setAlbumOrientation, setAlbumAppearance, setBgmVolume, setSoundEffectVolume]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
}
