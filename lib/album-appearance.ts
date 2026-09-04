export type AlbumFont = "zen-kurenaido" | "gothic" | "mincho" | "rounded";
export type AlbumLayout = "scrapbook" | "gallery" | "diary";
export type AlbumTextColor = "cocoa" | "navy" | "rose" | "forest";
export type AlbumBackground = "cream" | "white" | "blush" | "mist";
export type AlbumPattern = "botanical" | "plain" | "dots" | "grid";
export type AlbumOrientation = "portrait" | "landscape";

export type AlbumAppearance = {
  font: AlbumFont;
  layout: AlbumLayout;
  textColor: AlbumTextColor;
  background: AlbumBackground;
  pattern: AlbumPattern;
  orientation: AlbumOrientation;
};

export const DEFAULT_ALBUM_APPEARANCE: AlbumAppearance = {
  font: "zen-kurenaido",
  layout: "scrapbook",
  textColor: "cocoa",
  background: "cream",
  pattern: "botanical",
  orientation: "portrait",
};

const FONTS: AlbumFont[] = ["zen-kurenaido", "gothic", "mincho", "rounded"];
const LAYOUTS: AlbumLayout[] = ["scrapbook", "gallery", "diary"];
const TEXT_COLORS: AlbumTextColor[] = ["cocoa", "navy", "rose", "forest"];
const BACKGROUNDS: AlbumBackground[] = ["cream", "white", "blush", "mist"];
const PATTERNS: AlbumPattern[] = ["botanical", "plain", "dots", "grid"];
const ORIENTATIONS: AlbumOrientation[] = ["portrait", "landscape"];

export function isAlbumAppearance(value: unknown): value is AlbumAppearance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const appearance = value as Record<string, unknown>;
  return Object.keys(appearance).length === 6
    && FONTS.includes(appearance.font as AlbumFont)
    && LAYOUTS.includes(appearance.layout as AlbumLayout)
    && TEXT_COLORS.includes(appearance.textColor as AlbumTextColor)
    && BACKGROUNDS.includes(appearance.background as AlbumBackground)
    && PATTERNS.includes(appearance.pattern as AlbumPattern)
    && ORIENTATIONS.includes(appearance.orientation as AlbumOrientation);
}

export function resolveAlbumAppearance(
  memoryAppearance?: AlbumAppearance | null,
  accountAppearance?: AlbumAppearance | null,
): AlbumAppearance {
  return memoryAppearance ?? accountAppearance ?? DEFAULT_ALBUM_APPEARANCE;
}
