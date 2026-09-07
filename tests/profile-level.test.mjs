import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PROFILE_LEVEL_REQUIREMENTS,
  createEmptyLevelActivityStats,
  getProfileLevelProgress,
  resolveProfileLevelAdvancement,
} from "../lib/profile-data.ts";

const stats = (uploadedPhotos, activityOverrides = {}) => ({
  uploadedPhotos,
  ...createEmptyLevelActivityStats(),
  ...activityOverrides,
});

test("existing photo requirements remain unchanged", () => {
  assert.deepEqual(
    PROFILE_LEVEL_REQUIREMENTS.map(({ level, photosRequired, cumulativePhotosRequired }) => ({
      level, photosRequired, cumulativePhotosRequired,
    })),
    [
      { level: 2, photosRequired: 1, cumulativePhotosRequired: 1 },
      { level: 3, photosRequired: 5, cumulativePhotosRequired: 6 },
      { level: 4, photosRequired: 7, cumulativePhotosRequired: 13 },
      { level: 5, photosRequired: 10, cumulativePhotosRequired: 23 },
      { level: 6, photosRequired: 11, cumulativePhotosRequired: 34 },
      { level: 7, photosRequired: 12, cumulativePhotosRequired: 46 },
      { level: 8, photosRequired: 13, cumulativePhotosRequired: 59 },
      { level: 9, photosRequired: 14, cumulativePhotosRequired: 73 },
      ...Array.from({ length: 11 }, (_, index) => ({
        level: index + 10,
        photosRequired: 15,
        cumulativePhotosRequired: 88 + index * 15,
      })),
    ],
  );
});

test("levels 10 through 20 expose only the requested user-facing labels", () => {
  const labels = Object.fromEntries(PROFILE_LEVEL_REQUIREMENTS.map((item) => [item.level, item.additionalCondition?.label]));
  assert.deepEqual(Object.fromEntries(Object.entries(labels).filter(([level]) => Number(level) >= 10)), {
    10: "木の実を5個収穫する",
    11: "ランダムクイズに挑戦する",
    12: "木の実を15個収穫する",
    13: "木の実クイズに15問正解する",
    14: "グループを作る",
    15: "忘れかけた思い出を蘇らせる",
    16: "思い出を形にする",
    17: "思い出を分かち合う",
    18: "思い出に手紙を添える",
    19: "金の木の実を収穫する",
    20: "これまでの思い出を振り返る",
  });
});

test("an earned level never drops and photo progress remains raw", () => {
  const waitingForTen = resolveProfileLevelAdvancement(stats(88), 1, {});
  assert.equal(waitingForTen.level, 9);
  const earnedTen = resolveProfileLevelAdvancement(stats(88, { harvestedFruits: 5 }), waitingForTen.level, waitingForTen.baselines);
  assert.equal(earnedTen.level, 10);

  const afterDeletion = getProfileLevelProgress(stats(87, { harvestedFruits: 5 }), earnedTen.baselines, earnedTen.level);
  assert.equal(afterDeletion.level, 10);
  assert.equal(afterDeletion.photosIntoLevel, -1);
  assert.equal(afterDeletion.photosForNextLevel, 15);
});

test("photo surplus carries across promotion while each activity starts at its activation baseline", () => {
  const atTen = resolveProfileLevelAdvancement(stats(120, { harvestedFruits: 5 }), 10, {
    11: { randomQuizChallenges: 0 },
  });
  const waiting = getProfileLevelProgress(stats(120, { harvestedFruits: 5 }), atTen.baselines, atTen.level);
  assert.equal(waiting.level, 10);
  assert.equal(waiting.photosIntoLevel, 32);

  const atEleven = resolveProfileLevelAdvancement(
    stats(120, { harvestedFruits: 5, randomQuizChallenges: 1 }),
    atTen.level,
    atTen.baselines,
  );
  assert.equal(atEleven.level, 11);
  assert.equal(atEleven.baselines[12]?.harvestedFruits, 5);
  const carried = getProfileLevelProgress(
    stats(120, { harvestedFruits: 5, randomQuizChallenges: 1 }),
    atEleven.baselines,
    atEleven.level,
  );
  assert.equal(carried.photosIntoLevel, 17);
  assert.equal(carried.photosForNextLevel, 15);

  const stillEleven = resolveProfileLevelAdvancement(
    stats(120, { harvestedFruits: 19, randomQuizChallenges: 1 }),
    atEleven.level,
    atEleven.baselines,
  );
  assert.equal(stillEleven.level, 11);
  const atTwelve = resolveProfileLevelAdvancement(
    stats(120, { harvestedFruits: 20, randomQuizChallenges: 1 }),
    stillEleven.level,
    stillEleven.baselines,
  );
  assert.equal(atTwelve.level, 12);
});

test("activity completed before its level becomes active is excluded", () => {
  const atNine = resolveProfileLevelAdvancement(stats(73, { harvestedFruits: 99 }), 1, {});
  assert.equal(atNine.level, 9);
  assert.equal(atNine.baselines[10]?.harvestedFruits, 99);
  assert.equal(resolveProfileLevelAdvancement(stats(88, { harvestedFruits: 103 }), atNine.level, atNine.baselines).level, 9);
  assert.equal(resolveProfileLevelAdvancement(stats(88, { harvestedFruits: 104 }), atNine.level, atNine.baselines).level, 10);
});

test("milestones use transactional persistence and only client observations use client events", () => {
  const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(source("components/fruit-quiz-dialog.tsx"), /usePersistedMemoryQuestion\("fruit"/);
  assert.match(source("app/quiz/page.tsx"), /await answerPersonalQuiz/);
  assert.match(source("components/memory-recall-dialog.tsx"), /await restorePetal/);
  assert.match(source("lib/profile-level-context.tsx"), /metric !== "printAttempts" && metric !== "wordRecallReveals"/);
  assert.match(source("app/album/page.tsx"), /recordActivity\("printAttempts"\)/);
  assert.match(source("app/memory/[id]/page.tsx"), /recordActivity\("printAttempts"\)/);
  assert.doesNotMatch(source("lib/profile-level-context.tsx"), /localStorage|sessionStorage/);
  const sql = source("supabase/migrations/20260907021000_verified_profile_activity_sources.sql");
  for (const metric of ["harvestedFruits", "flownPetals", "goldenFruits", "fruitQuizCorrectAnswers", "correctQuizAnswers", "savedAlbumLetters", "createdGroups", "sharedMemories", "revivedFadedMemories"]) assert.ok(sql.includes(metric));
});
