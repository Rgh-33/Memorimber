"use client";

import { useMemo } from "react";
import { ProfileLevelOverview } from "@/components/profile-level-overview";
import { ProfileRecordGrid } from "@/components/profile-record-grid";
import { SharedMemberAvatar } from "@/components/shared-member-identity";
import { useMemories } from "@/lib/memories-context";
import {
  PROFILE_LEVEL_REQUIREMENTS,
  createEmptyLevelActivityStats,
  createEmptyProfileActivityStats,
  getProfileLevelProgress,
  type ProfileActivityStats,
} from "@/lib/profile-data";
import { useProfileLevel } from "@/lib/profile-level-context";
import { useProfile } from "@/lib/profile-context";
import type { SharedAlbumMember } from "@/lib/supabase/shared-albums";

function previewLevelProgress(level: number) {
  const achievedLevel = Math.max(1, Math.min(20, Math.trunc(level)));
  const currentRequirement = PROFILE_LEVEL_REQUIREMENTS.find((requirement) => requirement.level === achievedLevel);
  return getProfileLevelProgress({
    uploadedPhotos: currentRequirement?.cumulativePhotosRequired ?? 0,
    ...createEmptyLevelActivityStats(),
  }, {}, achievedLevel);
}

export function SharedMemberProfile({
  member,
  currentUserId,
}: {
  member: SharedAlbumMember;
  currentUserId: string;
}) {
  const isCurrentUser = member.userId === currentUserId;
  const { nickname } = useProfile();
  const { memories } = useMemories();
  const { activityTotals, levelProgress: ownLevelProgress } = useProfileLevel();
  const displayName = isCurrentUser ? nickname : member.displayName;
  const memberLevelProgress = useMemo(() => previewLevelProgress(member.level ?? 1), [member.level]);
  const levelProgress = isCurrentUser ? ownLevelProgress : memberLevelProgress;
  const stats = useMemo<ProfileActivityStats>(() => {
    if (!isCurrentUser) return createEmptyProfileActivityStats();
    return {
      uploadedPhotos: memories.length,
      harvestedFruits: activityTotals.harvestedFruits,
      correctQuizAnswers: activityTotals.correctQuizAnswers,
      activeMonths: new Set(memories.map((memory) => memory.date.slice(0, 7))).size,
      flownPetals: activityTotals.flownPetals,
      revivedFadedMemories: activityTotals.revivedFadedMemories,
      wordRecallReveals: activityTotals.wordRecallReveals,
      goldenFruits: activityTotals.goldenFruits,
      joinedGroups: activityTotals.joinedGroups,
      createdGroups: activityTotals.createdGroups,
      connectedPeople: activityTotals.connectedPeople,
      sharedQuizChallenges: activityTotals.sharedQuizChallenges,
      sharedQuizWins: activityTotals.sharedQuizWins,
      endlessQuizQuestions: activityTotals.endlessQuizQuestions,
      sharedMemories: activityTotals.sharedMemories,
      designedMemories: memories.filter((memory) => Boolean(memory.albumAppearance)).length,
    };
  }, [activityTotals, isCurrentUser, memories]);

  return (
    <>
      <section className="pt-4 text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-coral">MEMBER PROFILE</p>
        <h1 className="mt-2 text-[25px] font-semibold tracking-[0.1em] text-ink">プロフィール</h1>
      </section>

      <section className="mt-7 px-1">
        <div className="mx-auto w-fit">
          <SharedMemberAvatar
            displayName={displayName}
            avatarUrl={member.avatarUrl}
            isCurrentUser={isCurrentUser}
            size="profile"
          />
        </div>
        <ProfileLevelOverview levelProgress={levelProgress} />
        <div className="mt-4 flex min-h-[58px] items-center justify-center px-4">
          <p className="min-w-0 max-w-full break-words py-1.5 text-center text-[28px] font-semibold leading-[1.3] tracking-[0.04em] text-coral">
            {displayName || "ユーザー名未設定"}<span className="ml-2 whitespace-nowrap text-sm font-semibold text-coral/70">Lv.{levelProgress.level}</span>
          </p>
        </div>
      </section>

      <div className="profile-record-divider mx-auto mt-8" aria-hidden="true" />
      <ProfileRecordGrid stats={stats} />
    </>
  );
}
