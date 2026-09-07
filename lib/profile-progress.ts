import { createEmptyLevelActivityStats, createEmptyProfileActivityStats, PROFILE_LEVEL_REQUIREMENTS, type ProfileActivityStats, type LevelActivityStats } from "./profile-data.ts";

export type ProfileProgressSnapshot = {
  achievedLevel: number;
  revision: number;
  photosIntoLevel: number;
  photosForNextLevel: number;
  stats: Partial<ProfileActivityStats & LevelActivityStats>;
};
export function profileProgressView(snapshot: ProfileProgressSnapshot | null) {
  const level = snapshot?.achievedLevel ?? 1;
  const numerator = snapshot?.photosIntoLevel ?? 0;
  const denominator = snapshot?.photosForNextLevel ?? 1;
  return {
    activityTotals: { ...createEmptyLevelActivityStats(), ...snapshot?.stats },
    stats: { ...createEmptyProfileActivityStats(), ...snapshot?.stats },
    levelProgress: {
      level,
      progress: level === 20 ? 1 : numerator / denominator,
      photosIntoLevel: numerator,
      photosForNextLevel: denominator,
      nextRequirement: PROFILE_LEVEL_REQUIREMENTS.find((item) => item.level === level + 1) ?? null,
    },
  };
}
