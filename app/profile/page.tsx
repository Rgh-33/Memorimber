"use client";

import Image from "next/image";
import { CalendarDays, Camera, Check, ChevronRight, Images, Lightbulb, Medal, Pencil, Sprout, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type Ref } from "react";
import { AppHeader } from "@/components/app-header";
import { useMemories } from "@/lib/memories-context";
import {
  getProfileLevelProgress,
  PROFILE_LEVEL_REQUIREMENTS,
  PROFILE_MEDALS,
  type LevelActivityBaselines,
  type ProfileActivityStats,
  type ProfileLevelRequirement,
  type ProfileMedal,
} from "@/lib/profile-data";
import { useProcessing } from "@/lib/processing-context";
import { useProfile } from "@/lib/profile-context";
import { TREE_PREVIEW_ITEMS } from "@/lib/tree-data";

const MEDAL_ICONS = {
  photo: Images,
  fruit: Sprout,
  quiz: Lightbulb,
  calendar: CalendarDays,
} as const;

// 将来は、各レベル到達時の活動カウンターを保存してこの値へ渡す。
// 写真枚数は累計のまま、追加条件だけを直前レベル到達後の差分で判定できる。
const PREVIEW_LEVEL_ACTIVITY_BASELINES: LevelActivityBaselines = {};

function LevelRequirementCard({
  requirement,
  isCurrent = false,
  itemRef,
}: {
  requirement: ProfileLevelRequirement | null;
  isCurrent?: boolean;
  itemRef?: Ref<HTMLElement>;
}) {
  const level = requirement?.level ?? 1;

  return (
    <article ref={itemRef} className={`profile-level-requirement ${isCurrent ? "profile-level-requirement--current" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">レベル {level}</p>
        {isCurrent && <span className="profile-current-level-badge">現在地</span>}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] leading-5">
        {requirement ? <span>写真を{requirement.photosRequired}枚追加</span> : <span>思い出の記録をはじめる</span>}
        {requirement?.additionalCondition && <span>{requirement.additionalCondition.label}</span>}
      </div>
    </article>
  );
}

export default function ProfilePage() {
  const { memories } = useMemories();
  const { nickname, avatarDataUrl, setNickname, setAvatarFile } = useProfile();
  const { startProcessing, stopProcessing } = useProcessing();
  const [selectedMedalId, setSelectedMedalId] = useState(PROFILE_MEDALS[0].id);
  const [levelDetailsOpen, setLevelDetailsOpen] = useState(false);
  const [nicknameEditing, setNicknameEditing] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(nickname);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const levelListRef = useRef<HTMLDivElement>(null);
  const currentLevelRef = useRef<HTMLElement>(null);

  const stats = useMemo<ProfileActivityStats>(() => ({
    uploadedPhotos: memories.length,
    harvestedFruits: TREE_PREVIEW_ITEMS.filter((item) => item.stage === "harvested").length,
    correctQuizAnswers: 6,
    activeMonths: new Set(memories.map((memory) => memory.date.slice(0, 7))).size,
    sharedMemories: 1,
    friendQuizSessions: 1,
  }), [memories]);
  const levelProgress = getProfileLevelProgress(stats, PREVIEW_LEVEL_ACTIVITY_BASELINES);
  const selectedMedal = PROFILE_MEDALS.find((medal) => medal.id === selectedMedalId) ?? PROFILE_MEDALS[0];
  const allLevelRequirements: Array<ProfileLevelRequirement | null> = [null, ...PROFILE_LEVEL_REQUIREMENTS];

  useEffect(() => {
    if (!levelDetailsOpen) return;
    const frameId = window.requestAnimationFrame(() => {
      const list = levelListRef.current;
      const currentLevel = currentLevelRef.current;
      if (!list || !currentLevel) return;
      list.scrollTop += currentLevel.getBoundingClientRect().top - list.getBoundingClientRect().top;
    });
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLevelDetailsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [levelDetailsOpen]);

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
      <AppHeader />

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

        <div className="profile-level-summary" aria-label={`現在のレベルは${levelProgress.level}です`}>
          <div className="relative w-fit text-left text-coral">
              <span className="block text-[38px] font-semibold leading-none tabular-nums">{levelProgress.level}</span>
              <span className="mt-1.5 block text-[10px] font-semibold tracking-[0.12em]">レベル</span>
            <button
              type="button"
              onClick={() => setLevelDetailsOpen(true)}
              className="absolute left-full top-2 ml-1 grid h-8 w-8 place-items-center rounded-full text-coral transition hover:bg-coral/10"
              aria-label="すべてのレベル条件を見る"
            >
              <ChevronRight size={20} strokeWidth={2} />
            </button>
          </div>
          <div className="profile-level-track mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(levelProgress.progress * 100)}>
            <div className="profile-level-progress" style={{ width: `${levelProgress.progress * 100}%` }} />
          </div>
          <p className="profile-level-fraction mt-2" aria-label={`${levelProgress.photosIntoLevel}/${levelProgress.photosForNextLevel}`}>
            <span className="profile-level-fraction-current">{levelProgress.photosIntoLevel}</span>
            <span className="profile-level-fraction-slash" aria-hidden="true">/</span>
            <span>{levelProgress.photosForNextLevel}</span>
          </p>
        </div>

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

      <section className="mt-4 px-1" aria-labelledby="profile-medals-heading">
        <div className="flex items-center gap-2.5">
          <Medal size={24} className="text-coral" strokeWidth={1.8} />
          <h2 id="profile-medals-heading" className="text-lg font-semibold text-ink">記録</h2>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {PROFILE_MEDALS.map((medal: ProfileMedal) => {
            const Icon = MEDAL_ICONS[medal.icon];
            const selected = selectedMedal.id === medal.id;
            return (
              <button
                key={medal.id}
                type="button"
                onClick={() => setSelectedMedalId(medal.id)}
                aria-pressed={selected}
                aria-label={medal.label}
                className={`mx-auto grid h-14 w-14 place-items-center rounded-full border transition ${
                  selected ? "border-coral bg-coral text-white shadow-card" : "border-line bg-paper text-coral hover:border-coral"
                }`}
              >
                <Icon size={23} strokeWidth={1.7} />
              </button>
            );
          })}
        </div>
        <div className="mt-5 rounded-xl border border-line bg-paper px-4 py-4 text-center">
          <p className="text-xs font-semibold text-coral">{selectedMedal.label}</p>
          <p className="mt-2 text-xs leading-6 text-ink/60">{selectedMedal.describe(stats)}</p>
        </div>
      </section>

      {levelDetailsOpen && (
        <div className="profile-level-overlay" onClick={() => setLevelDetailsOpen(false)}>
          <section
            className="profile-level-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-level-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-coral">LEVEL GUIDE</p>
                <h2 id="profile-level-dialog-title" className="mt-1 text-lg font-semibold text-ink">レベルアップ条件</h2>
              </div>
              <button type="button" onClick={() => setLevelDetailsOpen(false)} className="grid h-8 w-8 place-items-center rounded-full border border-line bg-ivory text-ink" aria-label="閉じる">
                <X size={17} />
              </button>
            </div>

            <p className="mb-2 mt-5 text-[10px] font-semibold tracking-[0.14em] text-ink/45">レベル1〜20</p>
            <div ref={levelListRef} className="profile-level-list">
              <div className="space-y-2.5">
                {allLevelRequirements.map((requirement) => {
                  const level = requirement?.level ?? 1;
                  const isCurrent = level === levelProgress.level;
                  return (
                    <LevelRequirementCard
                      key={level}
                      requirement={requirement}
                      isCurrent={isCurrent}
                      itemRef={isCurrent ? currentLevelRef : undefined}
                    />
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
