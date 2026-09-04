export const AUDIO_VOLUME_LEVELS = [0, 1, 2, 3, 4, 5] as const;

export type AudioVolumeLevel = (typeof AUDIO_VOLUME_LEVELS)[number];

export const DEFAULT_AUDIO_VOLUME_LEVEL: AudioVolumeLevel = 4;

const BGM_GAIN_BY_LEVEL: Record<AudioVolumeLevel, number> = {
  0: 0,
  1: 0.02,
  2: 0.055,
  3: 0.12,
  4: 0.23,
  5: 0.36,
};

export function isAudioVolumeLevel(value: number): value is AudioVolumeLevel {
  return Number.isInteger(value) && value >= 0 && value <= 5;
}

export function clampAudioVolumeLevel(value: number): AudioVolumeLevel {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, Math.round(value))) as AudioVolumeLevel;
}

export function legacyPercentToAudioVolumeLevel(value: number): AudioVolumeLevel {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value <= 15) return 1;
  if (value <= 30) return 2;
  if (value <= 50) return 3;
  if (value <= 75) return 4;
  return 5;
}

export function bgmGainForLevel(level: number) {
  return BGM_GAIN_BY_LEVEL[clampAudioVolumeLevel(level)];
}
