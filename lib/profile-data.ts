export type ProfileActivityStats = {
  uploadedPhotos: number;
  harvestedFruits: number;
  correctQuizAnswers: number;
  activeMonths: number;
  sharedMemories: number;
  friendQuizSessions: number;
};

export type LevelActivityMetric = "harvestedFruits" | "correctQuizAnswers" | "sharedMemories" | "friendQuizSessions";

export type LevelAdditionalCondition = {
  metric: LevelActivityMetric;
  target: number;
  label: string;
  scope: "since-previous-level";
};

export type LevelActivityBaselines = Partial<
  Record<number, Partial<Record<LevelActivityMetric, number>>>
>;

export type ProfileLevelRequirement = {
  level: number;
  photosRequired: number;
  cumulativePhotosRequired: number;
  additionalCondition?: LevelAdditionalCondition;
};

export type ProfileMedal = {
  id: string;
  label: string;
  icon: "photo" | "fruit" | "quiz" | "calendar";
  describe: (stats: ProfileActivityStats) => string;
};

const LEVEL_ADDITIONAL_CONDITIONS: Partial<Record<number, LevelAdditionalCondition>> = {
  10: { metric: "correctQuizAnswers", target: 3, label: "クイズに3問正解", scope: "since-previous-level" },
  11: { metric: "harvestedFruits", target: 5, label: "思い出のタピオカを5粒味わう", scope: "since-previous-level" },
  12: { metric: "sharedMemories", target: 1, label: "思い出を1回共有", scope: "since-previous-level" },
  13: { metric: "friendQuizSessions", target: 1, label: "友達とクイズを1回", scope: "since-previous-level" },
  14: { metric: "correctQuizAnswers", target: 10, label: "クイズに10問正解", scope: "since-previous-level" },
  15: { metric: "harvestedFruits", target: 10, label: "思い出のタピオカを10粒味わう", scope: "since-previous-level" },
  16: { metric: "sharedMemories", target: 3, label: "思い出を3回共有", scope: "since-previous-level" },
  17: { metric: "friendQuizSessions", target: 2, label: "友達とクイズを2回", scope: "since-previous-level" },
  18: { metric: "correctQuizAnswers", target: 20, label: "クイズに20問正解", scope: "since-previous-level" },
  19: { metric: "sharedMemories", target: 5, label: "思い出を5回共有", scope: "since-previous-level" },
  20: { metric: "friendQuizSessions", target: 5, label: "友達とクイズを5回", scope: "since-previous-level" },
};

function getPhotosRequiredForLevel(level: number) {
  if (level === 2) return 1;
  if (level === 3) return 5;
  if (level === 4) return 7;
  if (level === 5) return 10;
  if (level >= 6 && level <= 9) return level + 5;
  return 15;
}

let cumulativePhotos = 0;
export const PROFILE_LEVEL_REQUIREMENTS: ProfileLevelRequirement[] = Array.from({ length: 19 }, (_, index) => {
  const level = index + 2;
  const photosRequired = getPhotosRequiredForLevel(level);
  cumulativePhotos += photosRequired;
  return {
    level,
    photosRequired,
    cumulativePhotosRequired: cumulativePhotos,
    additionalCondition: LEVEL_ADDITIONAL_CONDITIONS[level],
  };
});

export const PROFILE_MEDALS: ProfileMedal[] = [
  {
    id: "memory-collector",
    label: "思い出コレクター",
    icon: "photo",
    describe: (stats) => `今まで${stats.uploadedPhotos}枚の思い出写真を残しました！`,
  },
  {
    id: "fruit-harvester",
    label: "思い出のテイスター",
    icon: "fruit",
    describe: (stats) => `今まで${stats.harvestedFruits}粒の思い出を味わいました。`,
  },
  {
    id: "quiz-master",
    label: "記憶クイズ名人",
    icon: "quiz",
    describe: (stats) => `今まで${stats.correctQuizAnswers}回クイズに正解しました！`,
  },
  {
    id: "season-keeper",
    label: "季節の記録係",
    icon: "calendar",
    describe: (stats) => `今まで${stats.activeMonths}か月分の思い出を残しました！`,
  },
];

export function getActivityValue(stats: ProfileActivityStats, metric: LevelActivityMetric) {
  return stats[metric];
}

export function getLevelConditionValue(
  requirement: ProfileLevelRequirement,
  stats: ProfileActivityStats,
  baselines: LevelActivityBaselines,
) {
  const condition = requirement.additionalCondition;
  if (!condition) return 0;

  const valueAtPreviousLevel = baselines[requirement.level]?.[condition.metric] ?? 0;
  return Math.max(0, getActivityValue(stats, condition.metric) - valueAtPreviousLevel);
}

export function isProfileLevelRequirementMet(
  requirement: ProfileLevelRequirement,
  stats: ProfileActivityStats,
  baselines: LevelActivityBaselines = {},
) {
  const photosMet = stats.uploadedPhotos >= requirement.cumulativePhotosRequired;
  const conditionMet = !requirement.additionalCondition
    || getLevelConditionValue(requirement, stats, baselines) >= requirement.additionalCondition.target;
  return photosMet && conditionMet;
}

export function getProfileLevelProgress(stats: ProfileActivityStats, baselines: LevelActivityBaselines = {}) {
  let level = 1;
  for (const requirement of PROFILE_LEVEL_REQUIREMENTS) {
    if (!isProfileLevelRequirementMet(requirement, stats, baselines)) break;
    level = requirement.level;
  }

  const currentRequirement = PROFILE_LEVEL_REQUIREMENTS.find((requirement) => requirement.level === level);
  const nextRequirement = PROFILE_LEVEL_REQUIREMENTS.find((requirement) => requirement.level === level + 1);

  if (!nextRequirement) {
    const photosForLevel = currentRequirement?.photosRequired ?? 0;
    return {
      level: 20,
      progress: 1,
      photosIntoLevel: photosForLevel,
      photosForNextLevel: photosForLevel,
      nextRequirement: null,
    };
  }

  const currentCumulativePhotos = currentRequirement?.cumulativePhotosRequired ?? 0;
  const photosIntoLevel = Math.min(
    nextRequirement.photosRequired,
    Math.max(0, stats.uploadedPhotos - currentCumulativePhotos),
  );

  return {
    level,
    progress: photosIntoLevel / nextRequirement.photosRequired,
    photosIntoLevel,
    photosForNextLevel: nextRequirement.photosRequired,
    nextRequirement,
  };
}
