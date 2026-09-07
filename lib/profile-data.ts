export type ProfileActivityStats = {
  uploadedPhotos: number;
  harvestedFruits: number;
  correctQuizAnswers: number;
  activeMonths: number;
  flownPetals: number;
  revivedFadedMemories: number;
  wordRecallReveals: number;
  goldenFruits: number;
  joinedGroups: number;
  createdGroups: number;
  connectedPeople: number;
  sharedQuizChallenges: number;
  sharedQuizWins: number;
  endlessQuizQuestions: number;
  sharedMemories: number;
  designedMemories: number;
};

export function createEmptyProfileActivityStats(): ProfileActivityStats {
  return {
    uploadedPhotos: 0,
    harvestedFruits: 0,
    correctQuizAnswers: 0,
    activeMonths: 0,
    flownPetals: 0,
    revivedFadedMemories: 0,
    wordRecallReveals: 0,
    goldenFruits: 0,
    joinedGroups: 0,
    createdGroups: 0,
    connectedPeople: 0,
    sharedQuizChallenges: 0,
    sharedQuizWins: 0,
    endlessQuizQuestions: 0,
    sharedMemories: 0,
    designedMemories: 0,
  };
}

export const LEVEL_ACTIVITY_METRICS = [
  "harvestedFruits",
  "randomQuizChallenges",
  "fruitQuizCorrectAnswers",
  "createdGroups",
  "revivedFadedMemories",
  "printAttempts",
  "friendQuizSessions",
  "savedAlbumLetters",
  "goldenFruits",
  "correctQuizAnswers",
  "flownPetals",
  "wordRecallReveals",
  "joinedGroups",
  "connectedPeople",
  "sharedQuizChallenges",
  "sharedQuizWins",
  "endlessQuizQuestions",
  "sharedMemories",
] as const;

export type LevelActivityMetric = typeof LEVEL_ACTIVITY_METRICS[number];
export type LevelActivityStats = Record<LevelActivityMetric, number>;
export type ProfileLevelStats = LevelActivityStats & { uploadedPhotos: number };

export type LevelAdditionalCondition = {
  kind: "activity";
  metric: LevelActivityMetric;
  target: number;
  label: string;
  scope: "since-previous-level";
} | {
  kind: "automatic";
  label: string;
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
  icon:
    | "photo"
    | "fruit"
    | "quiz"
    | "calendar"
    | "petal"
    | "revive"
    | "word"
    | "golden"
    | "groups"
    | "groupCreate"
    | "connections"
    | "groupQuiz"
    | "winner"
    | "endless"
    | "share"
    | "design";
  describe: (stats: ProfileActivityStats) => string;
};

const activityCondition = (
  metric: LevelActivityMetric,
  target: number,
  label: string,
): LevelAdditionalCondition => ({ kind: "activity", metric, target, label, scope: "since-previous-level" });

const LEVEL_ADDITIONAL_CONDITIONS: Partial<Record<number, LevelAdditionalCondition>> = {
  10: activityCondition("harvestedFruits", 5, "木の実を5個収穫する"),
  11: activityCondition("randomQuizChallenges", 1, "ランダムクイズに挑戦する"),
  12: activityCondition("harvestedFruits", 15, "木の実を15個収穫する"),
  13: activityCondition("fruitQuizCorrectAnswers", 15, "木の実クイズに15問正解する"),
  14: activityCondition("createdGroups", 1, "グループを作る"),
  15: activityCondition("revivedFadedMemories", 1, "忘れかけた思い出を蘇らせる"),
  16: activityCondition("printAttempts", 1, "思い出を形にする"),
  17: activityCondition("friendQuizSessions", 1, "思い出を分かち合う"),
  18: activityCondition("savedAlbumLetters", 1, "思い出に手紙を添える"),
  19: activityCondition("goldenFruits", 1, "金の木の実を収穫する"),
  20: { kind: "automatic", label: "これまでの思い出を振り返る" },
};

export function createEmptyLevelActivityStats(): LevelActivityStats {
  return Object.fromEntries(LEVEL_ACTIVITY_METRICS.map((metric) => [metric, 0])) as unknown as LevelActivityStats;
}

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
    label: "実りの収穫者",
    icon: "fruit",
    describe: (stats) => `今まで${stats.harvestedFruits}個の木の実を収穫しました！`,
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
  {
    id: "petal-sender",
    label: "花びらの旅人",
    icon: "petal",
    describe: (stats) => `花びらを${stats.flownPetals}枚飛ばしました！`,
  },
  {
    id: "faded-reviver",
    label: "記憶の庭師",
    icon: "revive",
    describe: (stats) => `消えかけた花びらを${stats.revivedFadedMemories}枚復活させました！`,
  },
  {
    id: "word-recaller",
    label: "言葉の案内人",
    icon: "word",
    describe: (stats) => `単語から${stats.wordRecallReveals}回思い出を呼び覚ましました！`,
  },
  {
    id: "golden-harvester",
    label: "黄金の収穫者",
    icon: "golden",
    describe: (stats) => `金の木の実を${stats.goldenFruits}個収穫しました！`,
  },
  {
    id: "group-member",
    label: "輪の仲間",
    icon: "groups",
    describe: (stats) => `グループに${stats.joinedGroups}個参加しています！`,
  },
  {
    id: "group-creator",
    label: "集いのつくり手",
    icon: "groupCreate",
    describe: (stats) => `グループを${stats.createdGroups}個作りました！`,
  },
  {
    id: "group-connector",
    label: "つながりの輪",
    icon: "connections",
    describe: (stats) => `グループで${stats.connectedPeople}人とつながっています！`,
  },
  {
    id: "group-quiz-challenger",
    label: "みんなで挑戦者",
    icon: "groupQuiz",
    describe: (stats) => `グループのクイズに${stats.sharedQuizChallenges}回挑戦しました！`,
  },
  {
    id: "group-quiz-winner",
    label: "クイズチャンピオン",
    icon: "winner",
    describe: (stats) => `みんなでクイズで${stats.sharedQuizWins}回1位になりました！`,
  },
  {
    id: "endless-quiz-challenger",
    label: "総集クイズ挑戦者",
    icon: "endless",
    describe: (stats) => `総集クイズに${stats.endlessQuizQuestions}問挑戦しました！`,
  },
  {
    id: "memory-sharer",
    label: "思い出の分かち手",
    icon: "share",
    describe: (stats) => `グループに写真を${stats.sharedMemories}枚共有しました！`,
  },
  {
    id: "memory-designer",
    label: "思い出デザイナー",
    icon: "design",
    describe: (stats) => `${stats.designedMemories}個のおもいでをデザインしました！`,
  },
];

export function getActivityValue(stats: ProfileLevelStats, metric: LevelActivityMetric) {
  return stats[metric];
}

export function getLevelConditionValue(
  requirement: ProfileLevelRequirement,
  stats: ProfileLevelStats,
  baselines: LevelActivityBaselines,
) {
  const condition = requirement.additionalCondition;
  if (!condition || condition.kind === "automatic") return 0;

  const valueAtPreviousLevel = baselines[requirement.level]?.[condition.metric] ?? 0;
  return Math.max(0, getActivityValue(stats, condition.metric) - valueAtPreviousLevel);
}

export function isProfileLevelRequirementMet(
  requirement: ProfileLevelRequirement,
  stats: ProfileLevelStats,
  baselines: LevelActivityBaselines = {},
) {
  const photosMet = stats.uploadedPhotos >= requirement.cumulativePhotosRequired;
  const condition = requirement.additionalCondition;
  const conditionMet = !condition
    || condition.kind === "automatic"
    || getLevelConditionValue(requirement, stats, baselines) >= condition.target;
  return photosMet && conditionMet;
}

function cloneBaselines(baselines: LevelActivityBaselines): LevelActivityBaselines {
  return Object.fromEntries(
    Object.entries(baselines).map(([level, values]) => [level, { ...values }]),
  );
}

/**
 * Advances from an already-earned level without ever moving backwards. A new
 * activity baseline is captured as soon as its requirement becomes active, so
 * activity completed before the preceding level was earned never counts.
 */
export function resolveProfileLevelAdvancement(
  stats: ProfileLevelStats,
  achievedLevel = 1,
  baselines: LevelActivityBaselines = {},
) {
  let level = Math.max(1, Math.min(20, Math.trunc(achievedLevel)));
  const nextBaselines = cloneBaselines(baselines);

  while (level < 20) {
    const requirement = PROFILE_LEVEL_REQUIREMENTS.find((item) => item.level === level + 1);
    if (!requirement) break;
    const condition = requirement.additionalCondition;
    if (condition?.kind === "activity" && nextBaselines[requirement.level]?.[condition.metric] === undefined) {
      nextBaselines[requirement.level] = {
        ...nextBaselines[requirement.level],
        [condition.metric]: getActivityValue(stats, condition.metric),
      };
    }
    if (!isProfileLevelRequirementMet(requirement, stats, nextBaselines)) break;
    level = requirement.level;
  }

  return { level, baselines: nextBaselines };
}

export function getProfileLevelProgress(
  stats: ProfileLevelStats,
  baselines: LevelActivityBaselines = {},
  achievedLevel = 1,
) {
  const advancement = resolveProfileLevelAdvancement(stats, achievedLevel, baselines);
  const level = advancement.level;
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
  const photosIntoLevel = stats.uploadedPhotos - currentCumulativePhotos;

  return {
    level,
    progress: photosIntoLevel / nextRequirement.photosRequired,
    photosIntoLevel,
    photosForNextLevel: nextRequirement.photosRequired,
    nextRequirement,
  };
}
