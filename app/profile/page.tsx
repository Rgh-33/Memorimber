"use client";

import Image from "next/image";
import { Camera, Check, Pencil, UserRound } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import { ProfileLevelOverview } from "@/components/profile-level-overview";
import { ProfileRecordGrid } from "@/components/profile-record-grid";
import { useMemories } from "@/lib/memories-context";
import { type ProfileActivityStats } from "@/lib/profile-data";
import { useProfileLevel } from "@/lib/profile-level-context";
import { useProcessing } from "@/lib/processing-context";
import { useProfile } from "@/lib/profile-context";

export default function ProfilePage() {
  const { memories } = useMemories();
  const { nickname, avatarDataUrl, setNickname, setAvatarFile } = useProfile();
  const { activityTotals, levelProgress } = useProfileLevel();
  const { startProcessing, stopProcessing } = useProcessing();
  const [nicknameEditing, setNicknameEditing] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(nickname);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const stats = useMemo<ProfileActivityStats>(() => ({
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
  }), [activityTotals, memories]);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setProfileError(null);
    startProcessing();
    try {
      await setAvatarFile(file);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "プロフィール写真を保存できませんでした。");
    } finally {
      stopProcessing();
    }
  };

  const startNicknameEditing = () => {
    setNicknameDraft(nickname);
    setNicknameEditing(true);
  };

  const saveNickname = async () => {
    const nextNickname = nicknameDraft.trim();
    if (!nextNickname || profileSaving) return;
    setProfileError(null);
    setProfileSaving(true);
    try {
      await setNickname(nextNickname);
      setNicknameEditing(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "ユーザー名を保存できませんでした。");
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="page-pad">
      <section className="pt-8 text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-coral">MY PROFILE</p>
        <h1 className="mt-2 text-[25px] font-semibold tracking-[0.1em] text-ink">プロフィール</h1>
      </section>

      <section className="mt-7 px-1">
        <label htmlFor="profile-avatar" className="group relative z-10 mx-auto block w-fit cursor-pointer text-center">
          <span className="profile-avatar-control">
            <span className="profile-avatar-image relative grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-coral bg-paper text-coral shadow-card ring-4 ring-coral/10">
              {avatarDataUrl ? (
                <Image src={avatarDataUrl} alt="選択したプロフィールアイコン" fill sizes="96px" className="object-cover" unoptimized />
              ) : (
                <UserRound size={45} strokeWidth={1.35} />
              )}
            </span>
            <span className="profile-avatar-camera grid h-8 w-8 place-items-center rounded-full border-2 border-ivory bg-coral text-white shadow-sm" aria-hidden="true">
              <Camera size={15} />
            </span>
            <span className="sr-only">プロフィール画像を変更</span>
          </span>
        </label>
        <input id="profile-avatar" type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />

        <ProfileLevelOverview levelProgress={levelProgress} />

        <div className="mt-4">
          {nicknameEditing ? (
            <form
              className="relative flex min-h-[58px] items-center justify-center border-b border-coral/35 px-11"
              onSubmit={(event) => {
                event.preventDefault();
                void saveNickname();
              }}
            >
              <input
                type="text"
                value={nicknameDraft}
                maxLength={20}
                autoFocus
                onChange={(event) => setNicknameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setNicknameEditing(false);
                }}
                aria-label="ユーザー名を編集"
                className="min-w-0 w-full bg-transparent py-2.5 text-center text-[28px] font-semibold leading-[1.3] tracking-[0.04em] text-coral outline-none"
              />
              <button
                type="submit"
                disabled={!nicknameDraft.trim() || profileSaving}
                className="absolute right-0 grid h-9 w-9 place-items-center rounded-full bg-coral text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="ユーザー名を確定"
              >
                <Check size={16} strokeWidth={2} />
              </button>
            </form>
          ) : (
            <div className="relative flex min-h-[58px] items-center justify-center px-11">
              <p className="min-w-0 max-w-full truncate py-1.5 text-[28px] font-semibold leading-[1.3] tracking-[0.04em] text-coral">{nickname || "ユーザー名未設定"}</p>
              <button
                type="button"
                onClick={startNicknameEditing}
                className="absolute right-0 grid h-9 w-9 place-items-center rounded-full text-coral transition hover:bg-coral/10"
                aria-label="ユーザー名を編集"
              >
                <Pencil size={16} strokeWidth={1.8} />
              </button>
            </div>
          )}
        </div>
        {profileError && <p role="alert" className="mt-3 text-center text-xs font-medium text-red-500">{profileError}</p>}
      </section>

      <div className="profile-record-divider mx-auto mt-8" aria-hidden="true" />

      <ProfileRecordGrid stats={stats} />
    </div>
  );
}
